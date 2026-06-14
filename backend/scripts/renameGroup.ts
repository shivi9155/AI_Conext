import { query } from '../src/db';

const GROUP_ID = '9018b2a9-95a8-4898-9014-bdd7c7603b72';
const NEW_NAME = 'Shared Household Expense Tracker';

(async () => {
  try {
    const res = await query('UPDATE groups SET name = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING id, name', [NEW_NAME, GROUP_ID]);
    if (res.rows.length === 0) {
      console.error('Group not found:', GROUP_ID);
      process.exit(2);
    }
    console.log('Renamed group:', res.rows[0]);
    process.exit(0);
  } catch (err) {
    console.error('Error renaming group:', err);
    process.exit(1);
  }
})();
