import { query } from '../src/db';

(async () => {
  try {
    const groups = await query(`SELECT g.id, g.name, g.created_by, u.username as creator FROM groups g LEFT JOIN users u ON g.created_by = u.id`);
    console.log('GROUPS:', JSON.stringify(groups.rows, null, 2));

    for (const gr of groups.rows) {
      const members = await query('SELECT u.username FROM users u JOIN group_members gm ON u.id = gm.user_id WHERE gm.group_id = $1', [gr.id]);
      const cnt = await query('SELECT COUNT(*) FROM expenses WHERE group_id = $1', [gr.id]);
      console.log(`GROUP: ${gr.name} members: ${members.rows.map(r => r.username).join(', ')} expenses: ${cnt.rows[0].count}`);
    }
  } catch (e) {
    console.error(e);
    process.exit(1);
  } finally {
    process.exit(0);
  }
})();
