import { query } from '../src/db';

const PATTERN = process.argv[2] || 'shivani';

(async () => {
  try {
    const res = await query('SELECT id, username, email FROM users WHERE LOWER(username) LIKE LOWER($1)', [`%${PATTERN}%`]);
    if (res.rows.length === 0) {
      console.log('No users found matching:', PATTERN);
      process.exit(0);
    }
    console.log('Found users:');
    res.rows.forEach(r => console.log(JSON.stringify(r)));
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
})();
