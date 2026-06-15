import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { initializeDatabase } from './database';
import authRoutes from './routes/auth';
import groupRoutes from './routes/groups';
import expenseRoutes from './routes/expenses';
import settlementRoutes from './routes/settlements';
import importRoutes from './routes/imports';
import adminRoutes from './routes/admin';

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

// Routes
app.get('/', (_req, res) => {
  res.json({
    status: 'ok',
    message: 'FairShare Lite backend is running',
  });
});

app.get('/api', (_req, res) => {
  res.json({
    status: 'ok',
    message: 'FairShare Lite API is available at /api/*',
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/groups', groupRoutes);
app.use('/api/expenses', expenseRoutes);
app.use('/api/settlements', settlementRoutes);
app.use('/api/import-expenses', importRoutes);
app.use('/api/admin', adminRoutes);

const PORT = Number(process.env.PORT || process.env.BACKEND_PORT) || 5000;
const HOST = process.env.HOST || '0.0.0.0';

const startServer = async () => {
  try {
    await initializeDatabase();
    console.log('Database initialized');

    app.listen(PORT, HOST, () => {
      console.log(`Server running on http://${HOST}:${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();
