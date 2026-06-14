import { Router, Request, Response } from 'express';
import { query } from '../db';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { verifyToken } from '../middleware/auth';

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is required');
}

const router = Router();

interface AuthRequest extends Request {
  user?: any;
}

// Register
router.post('/register', async (req: Request, res: Response) => {
  try {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      res.status(400).json({ error: 'Missing required fields' });
      return;
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const userId = uuidv4();

    await query(
      `INSERT INTO users (id, username, email, password_hash) VALUES ($1, $2, $3, $4)`,
      [userId, username, email, hashedPassword]
    );

    const token = jwt.sign({ userId, username }, JWT_SECRET, {
      expiresIn: '7d',
    });

    res.status(201).json({ userId, username, token });
  } catch (error: any) {
    if (error.code === '23505') {
      res.status(400).json({ error: 'Username or email already exists' });
    } else {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
});

// Login
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      res.status(400).json({ error: 'Missing username or password' });
      return;
    }

    const result = await query(`SELECT * FROM users WHERE username = $1`, [username]);

    if (result.rows.length === 0) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    const user = result.rows[0];
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);

    if (!isPasswordValid) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    const token = jwt.sign({ userId: user.id, username: user.username }, JWT_SECRET, {
      expiresIn: '7d',
    });

    res.json({ userId: user.id, username: user.username, token });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Rename user
router.put('/users/:userId', verifyToken, async (req: any, res: Response) => {
  try {
    const { userId } = req.params;
    const { username } = req.body;

    if (!username || !username.trim()) {
      res.status(400).json({ error: 'Username is required' });
      return;
    }

    const userRes = await query(`SELECT * FROM users WHERE id = $1`, [userId]);
    if (userRes.rows.length === 0) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    await query(`UPDATE users SET username = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`, [username, userId]);

    res.json({ message: 'User updated successfully', userId, username });
  } catch (error: any) {
    if (error.code === '23505') {
      res.status(400).json({ error: 'Username already exists' });
    } else {
      console.error('Rename user error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
});

// Delete user
router.delete('/users/:userId', verifyToken, async (req: any, res: Response) => {
  try {
    const { userId } = req.params;

    const userRes = await query(`SELECT * FROM users WHERE id = $1`, [userId]);
    if (userRes.rows.length === 0) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    // Clean up dependencies
    await query(`DELETE FROM comments WHERE user_id = $1`, [userId]);
    await query(`DELETE FROM settlements WHERE from_user = $1 OR to_user = $2`, [userId, userId]);
    await query(`DELETE FROM expense_shares WHERE user_id = $1`, [userId]);
    await query(`DELETE FROM group_members WHERE user_id = $1`, [userId]);

    const userExpensesRes = await query(`SELECT id FROM expenses WHERE paid_by = $1`, [userId]);
    for (const exp of userExpensesRes.rows) {
      await query(`DELETE FROM expenses WHERE id = $1`, [exp.id]);
    }

    await query(`DELETE FROM activity_log WHERE user_id = $1`, [userId]);

    // Handle group creator constraint
    const userGroupsRes = await query(`SELECT id FROM groups WHERE created_by = $1`, [userId]);
    for (const grp of userGroupsRes.rows) {
      const otherMemberRes = await query(`SELECT user_id FROM group_members WHERE group_id = $1 LIMIT 1`, [grp.id]);
      if (otherMemberRes.rows.length > 0) {
        await query(`UPDATE groups SET created_by = $1 WHERE id = $2`, [otherMemberRes.rows[0].user_id, grp.id]);
      } else {
        await query(`DELETE FROM groups WHERE id = $1`, [grp.id]);
      }
    }

    await query(`DELETE FROM users WHERE id = $1`, [userId]);

    res.json({ message: 'User deleted successfully', userId });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

// Demo login route (enabled via ALLOW_DEMO_LOGIN=true).
// This creates or finds a user by `username` and returns a JWT without requiring a password.
// Intended for demo/testing only. Do NOT enable in untrusted production environments.
if (process.env.ALLOW_DEMO_LOGIN === 'true') {
  router.post('/demo-login', async (req: Request, res: Response) => {
    try {
      const { username } = req.body;
      const uname = (username && String(username).trim()) ? String(username).trim() : 'guest';

      const userRes = await query(`SELECT * FROM users WHERE username = $1 LIMIT 1`, [uname]);
      let user: any;
      if (userRes.rows.length === 0) {
        const userId = uuidv4();
        const email = `${uname.toLowerCase().replace(/[^a-z0-9]+/g, '_')}@example.com`;
        const passwordHash = await bcrypt.hash('password', 10);
        await query(`INSERT INTO users (id, username, email, password_hash) VALUES ($1, $2, $3, $4)`, [userId, uname, email, passwordHash]);
        user = { id: userId, username: uname };
      } else {
        user = userRes.rows[0];
      }

      const token = jwt.sign({ userId: user.id, username: user.username }, JWT_SECRET as string, { expiresIn: '7d' });
      res.json({ userId: user.id, username: user.username, token, demo: true });
    } catch (error) {
      console.error('Demo login error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });
}
