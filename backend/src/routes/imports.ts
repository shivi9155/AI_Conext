import { Router, Request, Response } from 'express';
import { verifyToken } from '../middleware/auth';
import { authorizeGroupMember } from '../middleware/authorizeGroupMember';
import { importExpensesFromCsv, getImportHistory } from '../services/importService';

const router = Router();

interface AuthenticatedRequest extends Request {
  user?: {
    userId: string;
    username: string;
  };
}

router.post('/', verifyToken, authorizeGroupMember, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { groupId, csvText } = req.body;
    if (!groupId || !csvText) {
      res.status(400).json({ error: 'groupId and csvText are required' });
      return;
    }

    const report = await importExpensesFromCsv(csvText, groupId, req.user!.userId);
    res.status(201).json({ report });
  } catch (error: any) {
    console.error('Import expenses error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

router.get('/:groupId', verifyToken, authorizeGroupMember, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { groupId } = req.params;
    const history = await getImportHistory(groupId);
    res.json({ history });
  } catch (error: any) {
    console.error('Get import history error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
