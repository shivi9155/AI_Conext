import { Router, Request, Response } from 'express';
import { query } from '../db';
import { v4 as uuidv4 } from 'uuid';
import { verifyToken } from '../middleware/auth';
import { authorizeGroupMember } from '../middleware/authorizeGroupMember';

const router = Router();

// List expenses with filtering and pagination
router.get('/', verifyToken, authorizeGroupMember, async (req: any, res: Response) => {
  try {
    const { groupId, paidBy, search, currency, startDate, endDate, page = '1', limit = '20', sort = 'date_desc' } = req.query;
    if (!groupId) {
      res.status(400).json({ error: 'groupId is required' });
      return;
    }

    const queryParams: any[] = [groupId];
    let filterSql = 'WHERE e.group_id = $1';

    if (paidBy) {
      queryParams.push(paidBy);
      filterSql += ` AND e.paid_by = $${queryParams.length}`;
    }
    if (currency) {
      queryParams.push(currency);
      filterSql += ` AND e.currency = $${queryParams.length}`;
    }
    if (search) {
      queryParams.push(`%${search}%`);
      filterSql += ` AND (e.description ILIKE $${queryParams.length} OR u.username ILIKE $${queryParams.length})`;
    }
    if (startDate) {
      queryParams.push(startDate);
      filterSql += ` AND e.date >= $${queryParams.length}`;
    }
    if (endDate) {
      queryParams.push(endDate);
      filterSql += ` AND e.date <= $${queryParams.length}`;
    }

    const sortClause = sort === 'amount_asc'
      ? 'ORDER BY e.amount ASC'
      : sort === 'amount_desc'
      ? 'ORDER BY e.amount DESC'
      : sort === 'date_asc'
      ? 'ORDER BY e.date ASC'
      : 'ORDER BY e.date DESC';

    const offset = (Number(page) - 1) * Number(limit);
    queryParams.push(Number(limit), offset);

    const expensesRes = await query(
      `SELECT e.*, u.username AS paid_by_username FROM expenses e JOIN users u ON e.paid_by = u.id ${filterSql} ${sortClause} LIMIT $${queryParams.length - 1} OFFSET $${queryParams.length}`,
      queryParams
    );

    const result = [];
    for (const expense of expensesRes.rows) {
      const sharesRes = await query(`SELECT es.user_id, es.amount, u.username FROM expense_splits es JOIN users u ON es.user_id = u.id WHERE es.expense_id = $1`, [expense.id]);
      result.push({
        ...expense,
        amount: Number(expense.amount),
        shares: sharesRes.rows.map((row: any) => ({ userId: row.user_id, username: row.username, amount: Number(row.amount) })),
      });
    }

    res.json({ expenses: result });
  } catch (error) {
    console.error('List expenses error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create expense
router.post('/', verifyToken, authorizeGroupMember, async (req: any, res: Response) => {
  try {
    const { groupId, description, amount, splitType, shares, category, notes } = req.body;
    const userId = req.user?.userId;
    const username = req.user?.username || 'Unknown';

    // Validate required fields more robustly. Allow zero amounts but require a numeric value.
    const parsedAmount = Number(String(amount || '').replace(/,/g, ''));
    if (!groupId || !description || !splitType || !Number.isFinite(parsedAmount)) {
      res.status(400).json({ error: 'Missing or invalid required fields' });
      return;
    }

    const expenseId = uuidv4();
    const finalCategory = category || 'Other';
    const finalNotes = notes || null;

    // Insert expense (ensure amount is numeric)
    await query(
      `INSERT INTO expenses (id, group_id, paid_by, description, amount, split_type, category, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [expenseId, groupId, userId, description, parsedAmount, splitType, finalCategory, finalNotes]
    );

    // Insert shares
    if (shares && Array.isArray(shares)) {
      for (const share of shares) {
        await query(
          `INSERT INTO expense_shares (expense_id, user_id, amount)
           VALUES ($1, $2, $3)`,
          [expenseId, share.userId, Number(share.amount) || 0]
        );
      }
    }

    // Log group activity
    await query(
      `INSERT INTO activity_log (group_id, user_id, action) VALUES ($1, $2, $3)`,
      [groupId, userId, `${username} added expense "${description}" of $${Number(amount).toFixed(2)} (${finalCategory})`]
    );

    res.status(201).json({ id: expenseId, groupId, description, amount, splitType, category: finalCategory, notes: finalNotes });
  } catch (error) {
    console.error('Create expense error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete expense
router.delete('/:expenseId', verifyToken, async (req: any, res: Response) => {
  try {
    const { expenseId } = req.params;
    const userId = req.user.userId;
    const username = req.user.username;

    // Fetch expense before deleting to get its details
    const expenseRes = await query(`SELECT * FROM expenses WHERE id = $1`, [expenseId]);
    if (expenseRes.rows.length === 0) {
      res.status(404).json({ error: 'Expense not found' });
      return;
    }
    const expense = expenseRes.rows[0];

    // Fetch shares so we can return them for undo/redo
    const sharesRes = await query(`SELECT user_id, amount FROM expense_shares WHERE expense_id = $1`, [expenseId]);

    // Delete the expense (cascades to shares and comments in DB)
    await query(`DELETE FROM expenses WHERE id = $1`, [expenseId]);

    // Log group activity
    await query(
      `INSERT INTO activity_log (group_id, user_id, action) VALUES ($1, $2, $3)`,
      [expense.group_id, userId, `${username} deleted expense "${expense.description}" of $${Number(expense.amount).toFixed(2)}`]
    );

    res.json({
      message: 'Expense deleted successfully',
      deletedExpense: {
        groupId: expense.group_id,
        description: expense.description,
        amount: Number(expense.amount),
        splitType: expense.split_type,
        category: expense.category,
        notes: expense.notes,
        shares: sharesRes.rows.map(s => ({ userId: s.user_id, amount: Number(s.amount) })),
      }
    });
  } catch (error) {
    console.error('Delete expense error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get expense details
router.get('/:expenseId', verifyToken, async (req: any, res: Response) => {
  try {
    const { expenseId } = req.params;

    const expenseResult = await query(`SELECT * FROM expenses WHERE id = $1`, [expenseId]);

    if (expenseResult.rows.length === 0) {
      res.status(404).json({ error: 'Expense not found' });
      return;
    }

    const sharesResult = await query(
      `SELECT user_id, amount FROM expense_shares WHERE expense_id = $1`,
      [expenseId]
    );

    const commentsResult = await query(
      `SELECT c.*, u.username FROM comments c
       JOIN users u ON c.user_id = u.id
       WHERE c.expense_id = $1 ORDER BY c.created_at DESC`,
      [expenseId]
    );

    res.json({
      ...expenseResult.rows[0],
      amount: Number(expenseResult.rows[0].amount),
      shares: sharesResult.rows.map(s => ({ ...s, amount: Number(s.amount) })),
      comments: commentsResult.rows,
    });
  } catch (error) {
    console.error('Get expense details error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Add comment to expense
router.post('/:expenseId/comments', verifyToken, async (req: any, res: Response) => {
  try {
    const { expenseId } = req.params;
    const { content } = req.body;
    const userId = req.user.userId;
    const username = req.user.username;

    if (!content) {
      res.status(400).json({ error: 'Comment content is required' });
      return;
    }

    // Fetch expense to log activity in group
    const expenseRes = await query(`SELECT group_id, description FROM expenses WHERE id = $1`, [expenseId]);
    if (expenseRes.rows.length === 0) {
      res.status(404).json({ error: 'Expense not found' });
      return;
    }
    const expense = expenseRes.rows[0];

    const commentId = uuidv4();

    await query(
      `INSERT INTO comments (id, expense_id, user_id, content)
       VALUES ($1, $2, $3, $4)`,
      [commentId, expenseId, userId, content]
    );

    // Log activity
    await query(
      `INSERT INTO activity_log (group_id, user_id, action) VALUES ($1, $2, $3)`,
      [expense.group_id, userId, `${username} commented on "${expense.description}": "${content}"`]
    );

    res.status(201).json({ id: commentId, content, user_id: userId, username });
  } catch (error) {
    console.error('Add comment error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
