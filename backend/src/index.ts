import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { initializeDatabase } from './database';
import authRoutes from './routes/auth';
import groupRoutes from './routes/groups';
import expenseRoutes from './routes/expenses';
import settlementRoutes from './routes/settlements';

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/groups', groupRoutes);
app.use('/api/expenses', expenseRoutes);
app.use('/api/settlements', settlementRoutes);

const PORT = process.env.PORT || process.env.BACKEND_PORT || 5000;

const startServer = async () => {
  try {
    await initializeDatabase();
    console.log('Database initialized');

    app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();
