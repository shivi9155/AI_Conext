import { Request, Response, NextFunction } from 'express';
import { query } from '../db';

export interface AuthenticatedRequest extends Request {
  user?: {
    userId: string;
    username: string;
  };
}

export const authorizeGroupMember = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const groupId = req.params.groupId || req.query.groupId || req.body.groupId;
    if (!groupId) {
      res.status(400).json({ error: 'groupId is required' });
      return;
    }

    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const userId = req.user.userId;
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
    console.error('Authorize group member error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
