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
      `WITH group_users AS (
         SELECT u.id, u.username
         FROM users u
         JOIN group_members gm ON u.id = gm.user_id
         WHERE gm.group_id = $1
       ),
       total_paid AS (
         SELECT paid_by AS user_id, SUM(amount) AS amount
         FROM expenses
         WHERE group_id = $1
         GROUP BY paid_by
       ),
       total_owed AS (
         SELECT es.user_id, SUM(es.amount) AS amount
         FROM expense_shares es
         JOIN expenses e ON e.id = es.expense_id
         WHERE e.group_id = $1
         GROUP BY es.user_id
       )
       SELECT u.id, u.username,
         COALESCE(tp.amount, 0) AS total_paid,
         COALESCE(to_owed.amount, 0) AS total_owed,
         COALESCE(tp.amount, 0) - COALESCE(to_owed.amount, 0) AS balance
       FROM group_users u
       LEFT JOIN total_paid tp ON tp.user_id = u.id
       LEFT JOIN total_owed to_owed ON to_owed.user_id = u.id`,
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
