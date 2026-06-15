import fs from 'node:fs/promises';
import path from 'node:path';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';
import { query } from '../src/db';
import { importExpensesFromCsv } from '../src/services/importService';

const main = async () => {
  const username = 'import_tester';
  const email = 'import_tester@example.com';
  const passwordHash = await bcrypt.hash('ImportTest123!', 10);
  const userId = uuidv4();

  await query(
    `INSERT INTO users (id, username, email, password_hash) VALUES ($1, $2, $3, $4) ON CONFLICT (username) DO NOTHING`,
    [userId, username, email, passwordHash]
  );

  const existingUser = await query(`SELECT id FROM users WHERE username = $1 LIMIT 1`, [username]);
  const importedBy = existingUser.rows[0].id;

  const groupId = uuidv4();
  const groupName = 'Import Validation Group';
  const existingGroup = await query(`SELECT id FROM groups WHERE name = $1 LIMIT 1`, [groupName]);
  let finalGroupId = existingGroup.rows.length > 0 ? existingGroup.rows[0].id : null;
  if (!finalGroupId) {
    finalGroupId = groupId;
    await query(`INSERT INTO groups (id, name, created_by) VALUES ($1, $2, $3)`, [finalGroupId, groupName, importedBy]);
  }

  await query(
    `INSERT INTO group_members (group_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
    [finalGroupId, importedBy]
  );

  const csvPath = path.resolve(__dirname, '..', 'scripts', 'expenses.csv');
  const csvText = await fs.readFile(csvPath, 'utf-8');

  const report = await importExpensesFromCsv(csvText, finalGroupId, importedBy);
  console.log('Import report summary:');
  console.log(`totalRows: ${report.totalRows}`);
  console.log(`importedRows: ${report.importedRows}`);
  console.log(`skippedRows: ${report.skippedRows}`);
  console.log(`duplicateRows: ${report.duplicateRows}`);
  console.log(`settlementRows: ${report.settlementRows}`);
  console.log('Validation errors:', report.validationErrors.length);
  console.log('Alias corrections:', report.aliasCorrections.length);
  console.log('Sample rows:');
  console.log(report.rows.slice(0, 10));
};

main().catch((error) => {
  console.error('Import validation failed:');
  console.error(error);
  process.exit(1);
});
