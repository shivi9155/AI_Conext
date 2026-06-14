import { query } from '../src/db';

const USERNAME = process.argv[2] || 'Shivani 12';
const GROUP_NAME = 'Imported Expenses';

(async () => {
  try {
    const userRes = await query('SELECT id, username FROM users WHERE username = $1 OR LOWER(username) = LOWER($1) LIMIT 1', [USERNAME]);
    if (userRes.rows.length === 0) {
      console.error(`User not found: ${USERNAME}`);
      process.exit(2);
    }
    const user = userRes.rows[0];

    const groupRes = await query('SELECT id FROM groups WHERE name = $1 LIMIT 1', [GROUP_NAME]);
    if (groupRes.rows.length === 0) {
      console.error(`Group not found: ${GROUP_NAME}`);
      process.exit(2);
    }
    const group = groupRes.rows[0];

    await query('INSERT INTO group_members (group_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [group.id, user.id]);

    console.log(`Added user '${user.username}' (id: ${user.id}) to group '${GROUP_NAME}' (id: ${group.id})`);
    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
})();
