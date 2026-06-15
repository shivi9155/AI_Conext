import { Request, Response, NextFunction } from 'express';
import { query } from '../db';
import { AuthenticatedRequest } from './auth';

export const authorizeExpenseMember = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const expenseId = req.params.expenseId;
    if (!expenseId) {
      res.status(400).json({ error: 'expenseId is required' });
      return;
    }

    const expenseRes = await query(`SELECT group_id FROM expenses WHERE id = $1 LIMIT 1`, [expenseId]);
    if (expenseRes.rows.length === 0) {
      res.status(404).json({ error: 'Expense not found' });
      return;
    }

    const groupId = expenseRes.rows[0].group_id;
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const membership = await query(
      `SELECT 1 FROM group_members WHERE group_id = $1 AND user_id = $2 LIMIT 1`,
      [groupId, userId]
    );

    if (membership.rows.length === 0) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    next();
  } catch (error) {
    console.error('Authorize expense member error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
