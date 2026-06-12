import { Router, Request, Response } from 'express';
import { query } from '../db';
import { v4 as uuidv4 } from 'uuid';
import { verifyToken } from '../middleware/auth';

const router = Router();

// Create expense
router.post('/', verifyToken, async (req: any, res: Response) => {
  try {
    const { groupId, description, amount, splitType, shares } = req.body;
    const userId = req.user.userId;

    if (!groupId || !description || !amount || !splitType) {
      res.status(400).json({ error: 'Missing required fields' });
      return;
    }

    const expenseId = uuidv4();

    // Insert expense
    await query(
      `INSERT INTO expenses (id, group_id, paid_by, description, amount, split_type)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [expenseId, groupId, userId, description, amount, splitType]
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

    res.status(201).json({ id: expenseId, groupId, description, amount, splitType });
  } catch (error) {
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
      `SELECT * FROM comments WHERE expense_id = $1 ORDER BY created_at DESC`,
      [expenseId]
    );

    res.json({
      ...expenseResult.rows[0],
      shares: sharesResult.rows,
      comments: commentsResult.rows,
    });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Add comment to expense
router.post('/:expenseId/comments', verifyToken, async (req: any, res: Response) => {
  try {
    const { expenseId } = req.params;
    const { content } = req.body;
    const userId = req.user.userId;

    if (!content) {
      res.status(400).json({ error: 'Comment content is required' });
      return;
    }

    const commentId = uuidv4();

    await query(
      `INSERT INTO comments (id, expense_id, user_id, content)
       VALUES ($1, $2, $3, $4)`,
      [commentId, expenseId, userId, content]
    );

    res.status(201).json({ id: commentId, content, user_id: userId });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
