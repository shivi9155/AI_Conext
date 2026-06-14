import { Router, Request, Response } from 'express';
import { query } from '../db';
import { v4 as uuidv4 } from 'uuid';
import { verifyToken } from '../middleware/auth';

const router = Router();

// Get balances for a group
router.get('/balances/:groupId', verifyToken, async (req: any, res: Response) => {
  try {
    const { groupId } = req.params;

    // 1. Fetch group members
    const membersResult = await query(
      `SELECT u.id, u.username FROM users u
       JOIN group_members gm ON u.id = gm.user_id
       WHERE gm.group_id = $1`,
      [groupId]
    );
    const members = membersResult.rows;

    // 2. Fetch expense shares
    const sharesResult = await query(
      `SELECT e.id AS expense_id, e.paid_by, e.amount AS total_amount, es.user_id AS share_user_id, es.amount AS share_amount
       FROM expenses e
       JOIN expense_shares es ON e.id = es.expense_id
       WHERE e.group_id = $1`,
      [groupId]
    );
    const shares = sharesResult.rows;

    // 3. Fetch settlements
    const settlementsResult = await query(
      `SELECT s.from_user, s.to_user, s.amount
       FROM settlements s
       WHERE s.group_id = $1`,
      [groupId]
    );
    const settlements = settlementsResult.rows;

    // 4. Calculate Net Balances
    const userMap: Record<string, { id: string; username: string; total_paid: number; total_owed: number; balance: number }> = {};
    for (const m of members) {
      userMap[m.id] = { id: m.id, username: m.username, total_paid: 0, total_owed: 0, balance: 0 };
    }

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

    const balances = Object.values(userMap);

    // 5. Calculate Actual Debts (who owes whom, pairwise netted)
    const grossDebts: Record<string, Record<string, number>> = {};
    for (const m of members) {
      grossDebts[m.id] = {};
      for (const other of members) {
        grossDebts[m.id][other.id] = 0;
      }
    }

    for (const es of shares) {
      if (es.share_user_id !== es.paid_by) {
        if (grossDebts[es.share_user_id] && grossDebts[es.share_user_id][es.paid_by] !== undefined) {
          grossDebts[es.share_user_id][es.paid_by] += Number(es.share_amount);
        }
      }
    }

    for (const s of settlements) {
      if (grossDebts[s.from_user] && grossDebts[s.from_user][s.to_user] !== undefined) {
        grossDebts[s.from_user][s.to_user] -= Number(s.amount);
      }
    }

    interface DebtRelation {
      fromUser: { id: string; username: string };
      toUser: { id: string; username: string };
      amount: number;
    }

    const actualDebts: DebtRelation[] = [];
    for (let i = 0; i < members.length; i++) {
      for (let j = i + 1; j < members.length; j++) {
        const uA = members[i];
        const uB = members[j];
        const debtAToB = grossDebts[uA.id][uB.id] || 0;
        const debtBToA = grossDebts[uB.id][uA.id] || 0;

        if (debtAToB > debtBToA) {
          const netDebt = debtAToB - debtBToA;
          if (netDebt > 0.01) {
            actualDebts.push({
              fromUser: { id: uA.id, username: uA.username },
              toUser: { id: uB.id, username: uB.username },
              amount: Number(netDebt.toFixed(2)),
            });
          }
        } else if (debtBToA > debtAToB) {
          const netDebt = debtBToA - debtAToB;
          if (netDebt > 0.01) {
            actualDebts.push({
              fromUser: { id: uB.id, username: uB.username },
              toUser: { id: uA.id, username: uA.username },
              amount: Number(netDebt.toFixed(2)),
            });
          }
        }
      }
    }

    // 6. Calculate Simplified Debts (Greedy Algorithm)
    const tempBalances = balances.map((b) => ({ id: b.id, username: b.username, balance: b.balance }));
    const debtors = tempBalances.filter((b) => b.balance < -0.01);
    const creditors = tempBalances.filter((b) => b.balance > 0.01);
    const simplifiedDebts: DebtRelation[] = [];

    while (debtors.length > 0 && creditors.length > 0) {
      debtors.sort((a, b) => a.balance - b.balance); // most negative first
      creditors.sort((a, b) => b.balance - a.balance); // most positive first

      const debtor = debtors[0];
      const creditor = creditors[0];
      const amount = Math.min(-debtor.balance, creditor.balance);

      if (amount > 0.01) {
        simplifiedDebts.push({
          fromUser: { id: debtor.id, username: debtor.username },
          toUser: { id: creditor.id, username: creditor.username },
          amount: Number(amount.toFixed(2)),
        });
      }

      debtor.balance += amount;
      creditor.balance -= amount;

      if (Math.abs(debtor.balance) < 0.01) {
        debtors.shift();
      }
      if (Math.abs(creditor.balance) < 0.01) {
        creditors.shift();
      }
    }

    res.json({
      balances,
      actualDebts,
      simplifiedDebts,
    });
  } catch (error) {
    console.error('Balances calculation error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Record a settlement
router.post('/:groupId/settle', verifyToken, async (req: any, res: Response) => {
  try {
    const { groupId } = req.params;
    const { fromUserId, toUserId, amount } = req.body;
    const currentUserId = req.user.userId;

    if (!fromUserId || !toUserId || !amount) {
      res.status(400).json({ error: 'Missing required fields' });
      return;
    }

    const settlementId = uuidv4();

    await query(
      `INSERT INTO settlements (id, group_id, from_user, to_user, amount, settled_at)
       VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)`,
      [settlementId, groupId, fromUserId, toUserId, amount]
    );

    // Fetch usernames for activity logging
    const fromUserRes = await query(`SELECT username FROM users WHERE id = $1`, [fromUserId]);
    const toUserRes = await query(`SELECT username FROM users WHERE id = $1`, [toUserId]);
    
    if (fromUserRes.rows.length > 0 && toUserRes.rows.length > 0) {
      const fromUsername = fromUserRes.rows[0].username;
      const toUsername = toUserRes.rows[0].username;
      
      await query(
        `INSERT INTO activity_log (group_id, user_id, action)
         VALUES ($1, $2, $3)`,
        [groupId, currentUserId, `${fromUsername} settled with ${toUsername} for $${Number(amount).toFixed(2)}`]
      );
    }

    res.status(201).json({ id: settlementId, fromUserId, toUserId, amount });
  } catch (error) {
    console.error('Settle record error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
