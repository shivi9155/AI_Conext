import { Router, Request, Response } from 'express';
import { query } from '../db';
import { v4 as uuidv4 } from 'uuid';
import { verifyToken } from '../middleware/auth';

const router = Router();

// Get balances for a group
router.get('/balances/:groupId', verifyToken, async (req: any, res: Response) => {
  try {
    const { groupId } = req.params;

    // Calculate balances: who owes what to whom
    const result = await query(
      `WITH user_balances AS (
        SELECT u.id, u.username,
          COALESCE(SUM(CASE WHEN e.paid_by = u.id THEN e.amount ELSE 0 END), 0) as total_paid,
          COALESCE(SUM(es.amount), 0) as total_owed
        FROM users u
        JOIN group_members gm ON u.id = gm.user_id
        LEFT JOIN expenses e ON e.group_id = $1 AND e.paid_by = u.id
        LEFT JOIN expense_shares es ON e.id = es.expense_id AND es.user_id = u.id
        WHERE gm.group_id = $1
        GROUP BY u.id, u.username
      )
      SELECT id, username, (total_paid - total_owed) as balance
      FROM user_balances`,
      [groupId]
    );

    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Record a settlement
router.post('/:groupId/settle', verifyToken, async (req: any, res: Response) => {
  try {
    const { groupId } = req.params;
    const { fromUserId, toUserId, amount } = req.body;

    if (!fromUserId || !toUserId || !amount) {
      res.status(400).json({ error: 'Missing required fields' });
      return;
    }

    const settlementId = uuidv4();

    await query(
      `INSERT INTO settlements (id, group_id, from_user, to_user, amount, settled_at)
       VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)`,
      [settlementId, groupId, fromUserId, toUserId, amount]
    );

    res.status(201).json({ id: settlementId, fromUserId, toUserId, amount });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
