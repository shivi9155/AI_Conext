import { Router, Request, Response } from 'express';
import { query } from '../db';
import { v4 as uuidv4 } from 'uuid';
import { verifyToken } from '../middleware/auth';

const router = Router();

// Get all groups for user
router.get('/', verifyToken, async (req: any, res: Response) => {
  try {
    const userId = req.user.userId;

    const result = await query(
      `SELECT DISTINCT g.* FROM groups g
       JOIN group_members gm ON g.id = gm.group_id
       WHERE gm.user_id = $1
       ORDER BY g.created_at DESC`,
      [userId]
    );

    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get group details
router.get('/:groupId', verifyToken, async (req: any, res: Response) => {
  try {
    const { groupId } = req.params;

    const groupResult = await query(`SELECT * FROM groups WHERE id = $1`, [groupId]);

    if (groupResult.rows.length === 0) {
      res.status(404).json({ error: 'Group not found' });
      return;
    }

    const memberResult = await query(
      `SELECT u.id, u.username FROM users u
       JOIN group_members gm ON u.id = gm.user_id
       WHERE gm.group_id = $1`,
      [groupId]
    );

    const expenseResult = await query(
      `SELECT e.*, u.username AS paid_by_username FROM expenses e
       JOIN users u ON e.paid_by = u.id
       WHERE e.group_id = $1 ORDER BY e.created_at DESC`,
      [groupId]
    );

    // Fetch shares and comments for each expense
    const expensesWithDetails = [];
    for (const expense of expenseResult.rows) {
      const sharesRes = await query(
        `SELECT es.user_id, es.amount, u.username FROM expense_shares es
         JOIN users u ON es.user_id = u.id
         WHERE es.expense_id = $1`,
        [expense.id]
      );
      
      const commentsRes = await query(
        `SELECT c.id, c.content, c.created_at, c.user_id, u.username FROM comments c
         JOIN users u ON c.user_id = u.id
         WHERE c.expense_id = $1 ORDER BY c.created_at ASC`,
        [expense.id]
      );

      expensesWithDetails.push({
        ...expense,
        amount: Number(expense.amount),
        shares: sharesRes.rows.map(s => ({ ...s, amount: Number(s.amount) })),
        comments: commentsRes.rows,
      });
    }

    // Fetch group activity log
    const activityResult = await query(
      `SELECT al.id, al.action, al.created_at, al.user_id, u.username FROM activity_log al
       LEFT JOIN users u ON al.user_id = u.id
       WHERE al.group_id = $1 ORDER BY al.created_at DESC LIMIT 50`,
      [groupId]
    );

    res.json({
      ...groupResult.rows[0],
      members: memberResult.rows,
      expenses: expensesWithDetails,
      activityLog: activityResult.rows,
    });
  } catch (error) {
    console.error('Get group error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create group
router.post('/', verifyToken, async (req: any, res: Response) => {
  try {
    const { name } = req.body;
    const userId = req.user.userId;
    const username = req.user.username;

    if (!name) {
      res.status(400).json({ error: 'Group name is required' });
      return;
    }

    const groupId = uuidv4();

    await query(
      `INSERT INTO groups (id, name, created_by) VALUES ($1, $2, $3)`,
      [groupId, name, userId]
    );

    await query(
      `INSERT INTO group_members (group_id, user_id) VALUES ($1, $2)`,
      [groupId, userId]
    );

    await query(
      `INSERT INTO activity_log (group_id, user_id, action) VALUES ($1, $2, $3)`,
      [groupId, userId, `${username} created the group "${name}"`]
    );

    res.status(201).json({ id: groupId, name, created_by: userId });
  } catch (error) {
    console.error('Create group error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Add member to group
router.post('/:groupId/members', verifyToken, async (req: any, res: Response) => {
  try {
    const { groupId } = req.params;
    const { username } = req.body;
    const currentUserId = req.user.userId;
    const currentUsername = req.user.username;

    if (!username) {
      res.status(400).json({ error: 'Username is required' });
      return;
    }

    const userResult = await query(`SELECT id FROM users WHERE username = $1`, [username]);

    if (userResult.rows.length === 0) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const userId = userResult.rows[0].id;

    await query(
      `INSERT INTO group_members (group_id, user_id) VALUES ($1, $2)`,
      [groupId, userId]
    );

    await query(
      `INSERT INTO activity_log (group_id, user_id, action) VALUES ($1, $2, $3)`,
      [groupId, currentUserId, `${currentUsername} added ${username} to the group`]
    );

    res.status(201).json({ userId, username });
  } catch (error: any) {
    if (error.code === '23505') {
      res.status(400).json({ error: 'User is already a member of this group' });
    } else {
      console.error('Add member error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
});

export default router;
