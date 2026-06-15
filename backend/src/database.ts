import pool from './db';

export const initializeDatabase = async (): Promise<void> => {
  try {
    // Ensure UUID generation support is available in Postgres
    await pool.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto";`);

    // Users table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        username VARCHAR(255) UNIQUE NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // User aliases table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_aliases (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        alias VARCHAR(255) NOT NULL UNIQUE,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Groups table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS groups (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        created_by UUID NOT NULL REFERENCES users(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Group members table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS group_members (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
        user_id UUID NOT NULL REFERENCES users(id),
        joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(group_id, user_id)
      );
    `);

    // Import logs table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS import_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        imported_by UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
        group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
        imported_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        total_rows INTEGER NOT NULL DEFAULT 0,
        imported_rows INTEGER NOT NULL DEFAULT 0,
        skipped_rows INTEGER NOT NULL DEFAULT 0,
        duplicates INTEGER NOT NULL DEFAULT 0,
        settlement_rows INTEGER NOT NULL DEFAULT 0,
        validation_errors JSONB DEFAULT '[]',
        report JSONB DEFAULT '{}'
      );
    `);

    // Expenses table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS expenses (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
        paid_by UUID NOT NULL REFERENCES users(id),
        description VARCHAR(255) NOT NULL,
        amount DECIMAL(10, 2) NOT NULL,
        currency VARCHAR(10),
        split_type VARCHAR(50) NOT NULL,
        date DATE,
        is_settlement BOOLEAN DEFAULT FALSE,
        import_batch_id UUID REFERENCES import_logs(id),
        notes TEXT,
        category VARCHAR(100) DEFAULT 'Other',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await pool.query(`
      ALTER TABLE expenses
      ADD COLUMN IF NOT EXISTS currency VARCHAR(10),
      ADD COLUMN IF NOT EXISTS split_type VARCHAR(50) NOT NULL DEFAULT 'equal',
      ADD COLUMN IF NOT EXISTS date DATE,
      ADD COLUMN IF NOT EXISTS is_settlement BOOLEAN DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS import_batch_id UUID REFERENCES import_logs(id),
      ADD COLUMN IF NOT EXISTS notes TEXT,
      ADD COLUMN IF NOT EXISTS category VARCHAR(100) DEFAULT 'Other';
    `);

    // Expense splits table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS expense_splits (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        expense_id UUID NOT NULL REFERENCES expenses(id) ON DELETE CASCADE,
        user_id UUID NOT NULL REFERENCES users(id),
        amount DECIMAL(10, 2) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Legacy expense shares table (preserved for compatibility)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS expense_shares (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        expense_id UUID NOT NULL REFERENCES expenses(id) ON DELETE CASCADE,
        user_id UUID NOT NULL REFERENCES users(id),
        amount DECIMAL(10, 2) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Comments table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS comments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        expense_id UUID NOT NULL REFERENCES expenses(id) ON DELETE CASCADE,
        user_id UUID NOT NULL REFERENCES users(id),
        content TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Settlements table (to track who owes whom)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS settlements (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
        from_user UUID NOT NULL REFERENCES users(id),
        to_user UUID NOT NULL REFERENCES users(id),
        amount DECIMAL(10, 2) NOT NULL,
        settled_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Import logs table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS import_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        imported_by UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
        group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
        imported_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        total_rows INTEGER NOT NULL DEFAULT 0,
        imported_rows INTEGER NOT NULL DEFAULT 0,
        skipped_rows INTEGER NOT NULL DEFAULT 0,
        duplicates INTEGER NOT NULL DEFAULT 0,
        settlement_rows INTEGER NOT NULL DEFAULT 0,
        validation_errors JSONB DEFAULT '[]',
        report JSONB DEFAULT '{}'
      );
    `);

    // Activity log table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS activity_log (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
        user_id UUID REFERENCES users(id) ON DELETE SET NULL,
        action VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    console.log('Database initialized successfully');
  } catch (error) {
    console.error('Error initializing database:', error);
    throw error;
  }
};
