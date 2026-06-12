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
    const userId = req.user.userId;

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
      `SELECT * FROM expenses WHERE group_id = $1 ORDER BY created_at DESC`,
      [groupId]
    );

    res.json({
      ...groupResult.rows[0],
      members: memberResult.rows,
      expenses: expenseResult.rows,
    });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create group
router.post('/', verifyToken, async (req: any, res: Response) => {
  try {
    const { name } = req.body;
    const userId = req.user.userId;

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

    res.status(201).json({ id: groupId, name, created_by: userId });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Add member to group
router.post('/:groupId/members', verifyToken, async (req: any, res: Response) => {
  try {
    const { groupId } = req.params;
    const { username } = req.body;

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

    res.status(201).json({ userId, username });
  } catch (error: any) {
    if (error.code === '23505') {
      res.status(400).json({ error: 'User is already a member of this group' });
    } else {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
});

export default router;
