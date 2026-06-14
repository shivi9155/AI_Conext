import { query } from '../src/db';

const GROUP_ID = process.argv[2] || '9018b2a9-95a8-4898-9014-bdd7c7603b72';

(async () => {
  try {
    const membersRes = await query(`SELECT u.id, u.username FROM users u JOIN group_members gm ON u.id = gm.user_id WHERE gm.group_id = $1`, [GROUP_ID]);
    const members = membersRes.rows;

    const userMap: Record<string, any> = {};
    for (const m of members) {
      userMap[m.id] = { id: m.id, username: m.username, total_paid: 0, total_owed: 0, balance: 0 };
    }

    const sharesRes = await query(`SELECT e.id AS expense_id, e.paid_by, e.amount AS total_amount, es.user_id AS share_user_id, es.amount AS share_amount FROM expenses e JOIN expense_shares es ON e.id = es.expense_id WHERE e.group_id = $1`, [GROUP_ID]);
    const shares = sharesRes.rows;

    const settlementsRes = await query(`SELECT s.from_user, s.to_user, s.amount FROM settlements s WHERE s.group_id = $1`, [GROUP_ID]);
    const settlements = settlementsRes.rows;

    const processedExpenses = new Set<string>();
    for (const es of shares) {
      if (userMap[es.share_user_id]) {
        userMap[es.share_user_id].total_owed += Number(es.share_amount);
      }
      if (!processedExpenses.has(es.expense_id)) {
        processedExpenses.add(es.expense_id);
        if (userMap[es.paid_by]) {
          userMap[es.paid_by].total_paid += Number(es.total_amount);
        }
      }
    }

    for (const s of settlements) {
      if (userMap[s.from_user]) {
        userMap[s.from_user].total_paid += Number(s.amount);
      }
      if (userMap[s.to_user]) {
        userMap[s.to_user].total_owed += Number(s.amount);
      }
    }

    for (const userId in userMap) {
      userMap[userId].balance = Number((userMap[userId].total_paid - userMap[userId].total_owed).toFixed(2));
    }

    console.log('Balances for group', GROUP_ID);
    const table = Object.values(userMap).map(u => ({ username: u.username, paid: u.total_paid, owed: u.total_owed, balance: u.balance }));
    console.log(JSON.stringify(table, null, 2));

  } catch (err) {
    console.error('Error computing balances:', err);
    process.exit(1);
  } finally {
    process.exit(0);
  }
})();
