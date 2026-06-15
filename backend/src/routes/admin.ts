import { Router, Request, Response } from 'express';
import { exec } from 'child_process';

const router = Router();

// Protected import endpoint. Enable by setting ALLOW_IMPORT=true in the service environment.
router.post('/import-expenses', async (req: Request, res: Response) => {
  // Allow import when explicitly enabled or when running in a non-production environment
  const importAllowed = process.env.ALLOW_IMPORT === 'true' || process.env.NODE_ENV !== 'production';
  if (!importAllowed) {
    res.status(403).json({ error: 'Import endpoint disabled' });
    return;
  }

  // Run the import script that lives in backend/scripts/importExpenses.js
  exec('node backend/scripts/importExpenses.js', { maxBuffer: 20 * 1024 * 1024 }, (err, stdout, stderr) => {
    if (err) {
      console.error('Import script failed:', err, stderr);
      res.status(500).json({ error: err.message, stdout, stderr });
      return;
    }
    res.json({ message: 'Import executed', stdout, stderr });
  });
});

export default router;
