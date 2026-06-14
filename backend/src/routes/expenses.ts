import { Router, Request, Response } from 'express';
import { query } from '../db';
import { v4 as uuidv4 } from 'uuid';
import { verifyToken } from '../middleware/auth';

const router = Router();

// Create expense
router.post('/', verifyToken, async (req: any, res: Response) => {
  try {
    const { groupId, description, amount, splitType, shares, category, notes } = req.body;
    const userId = req.user.userId;
    const username = req.user.username;

    if (!groupId || !description || !amount || !splitType) {
      res.status(400).json({ error: 'Missing required fields' });
      return;
    }

    const expenseId = uuidv4();
    const finalCategory = category || 'Other';
    const finalNotes = notes || null;

    // Insert expense
    await query(
      `INSERT INTO expenses (id, group_id, paid_by, description, amount, split_type, category, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [expenseId, groupId, userId, description, amount, splitType, finalCategory, finalNotes]
    );

    // Insert shares
    if (shares && Array.isArray(shares)) {
      for (const share of shares) {
        await query(
          `INSERT INTO expense_shares (expense_id, user_id, amount)
           VALUES ($1, $2, $3)`,
          [expenseId, share.userId, share.amount]
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
