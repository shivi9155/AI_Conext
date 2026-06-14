const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

const CSV_PATH = path.resolve(__dirname, 'expenses.csv');
const DEFAULT_DB_URL = 'postgresql://postgres:password@localhost:5432/fairshare_lite';
const pool = new Pool({ connectionString: process.env.DATABASE_URL || DEFAULT_DB_URL });
const GROUP_NAME = 'Imported Expenses';
const DEFAULT_USER_PASSWORD = 'password123';

const parseCsvLine = (line) => {
  const values = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (char === ',' && !inQuotes) {
      values.push(current);
      current = '';
      continue;
    }
    current += char;
  }
  values.push(current);
  return values.map((value) => value.trim());
};

const normalizeUsername = (name) => (name || '').trim().replace(/\s+/g, ' ');

const parseDate = (value) => {
  if (!value) return null;
  const normalized = value.trim();

  const monthNames = {
    jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
    jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
  };

  const parts = normalized.split(/[-\/]/).map((part) => part.trim());

  if (parts.length === 2) {
    const [monthToken, dayToken] = parts;
    const monthName = monthToken.toLowerCase();
    const month = monthNames[monthName];
    const day = Number(dayToken);
    if (month && day && day >= 1 && day <= 31) {
      return new Date(2026, month - 1, day);
    }
  }

  if (parts.length === 3) {
    let day = Number(parts[0]);
    let month = Number(parts[1]);
    let year = Number(parts[2]);

    if (parts[0].length === 4 && parts[1].length <= 2) {
      year = Number(parts[0]);
      month = Number(parts[1]);
      day = Number(parts[2]);
    }

    if (year < 100) {
      year += 2000;
    }
    if (!Number.isNaN(day) && !Number.isNaN(month) && !Number.isNaN(year)) {
      return new Date(year, month - 1, day);
    }
  }

  const parsed = Date.parse(normalized);
  return Number.isNaN(parsed) ? null : new Date(parsed);
};

const parseAmount = (value) => {
  if (!value) return 0;
  const cleaned = value.replace(/,/g, '').trim();
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
};

const parseList = (value) => {
  if (!value) return [];
  return value.split(';').map((item) => normalizeUsername(item)).filter(Boolean);
};

const parseDetailPairs = (value) => {
  if (!value) return [];
  return value.split(';').map((item) => item.trim()).filter(Boolean).map((fragment) => {
    const parts = fragment.split(/\s+/);
    const last = parts[parts.length - 1];
    const name = normalizeUsername(parts.slice(0, parts.length - 1).join(' '));
    const amount = Number(last.replace('%', ''));
    return { name, amount };
  }).filter((item) => item.name && Number.isFinite(item.amount));
};

const calculateShares = (amount, participants, splitType, detailText) => {
  const participantsCount = participants.length;
  if (participantsCount === 0) return [];

  const safeAmount = Number(amount) || 0;

  if (splitType === 'unequal') {
    const detailPairs = parseDetailPairs(detailText);
    if (detailPairs.length > 0) {
      return detailPairs.map((item) => ({ username: item.name, amount: Number(item.amount) }));
    }
  }

  if (splitType === 'percentage') {
    const detailPairs = parseDetailPairs(detailText);
    if (detailPairs.length > 0) {
      const shares = detailPairs.map((item) => ({ username: item.name, amount: Number((safeAmount * item.amount / 100).toFixed(2)) }));
      const total = shares.reduce((sum, s) => sum + s.amount, 0);
      const remainder = Number((safeAmount - total).toFixed(2));
      if (remainder !== 0 && shares.length > 0) {
        shares[shares.length - 1].amount += remainder;
      }
      return shares;
    }
  }

  if (splitType === 'share') {
    const detailPairs = parseDetailPairs(detailText);
    if (detailPairs.length > 0) {
      const totalShares = detailPairs.reduce((sum, item) => sum + item.amount, 0);
      if (totalShares > 0) {
        const shares = detailPairs.map((item) => ({ username: item.name, amount: Number((safeAmount * item.amount / totalShares).toFixed(2)) }));
        const total = shares.reduce((sum, s) => sum + s.amount, 0);
        const remainder = Number((safeAmount - total).toFixed(2));
        if (remainder !== 0 && shares.length > 0) {
          shares[shares.length - 1].amount += remainder;
        }
        return shares;
      }
    }
  }

  const equalShare = Number((safeAmount / participantsCount).toFixed(2));
  const shares = participants.map((username) => ({ username, amount: equalShare }));
  const total = shares.reduce((sum, s) => sum + s.amount, 0);
  const remainder = Number((safeAmount - total).toFixed(2));
  if (remainder !== 0) {
    shares[shares.length - 1].amount += remainder;
  }
  return shares;
};

const buildNotes = (originalNotes, date, currency) => {
  const parts = [];
  if (originalNotes) parts.push(originalNotes);
  if (date) parts.push(`Imported date: ${date.toISOString().slice(0, 10)}`);
  if (currency) parts.push(`Currency: ${currency}`);
  return parts.join(' | ') || null;
};

const findOrCreateUser = async (username) => {
  const normalized = normalizeUsername(username);
  if (!normalized) return null;

  const existing = await pool.query('SELECT id, username FROM users WHERE LOWER(username) = LOWER($1) LIMIT 1', [normalized]);
  if (existing.rows.length > 0) {
    return existing.rows[0];
  }

  const userId = uuidv4();
  const email = `${normalized.toLowerCase().replace(/[^a-z0-9]+/g, '_')}@example.com`;
  const passwordHash = await bcrypt.hash(DEFAULT_USER_PASSWORD, 10);

  await pool.query('INSERT INTO users (id, username, email, password_hash) VALUES ($1, $2, $3, $4)', [userId, normalized, email, passwordHash]);
  return { id: userId, username: normalized };
};

const findOrCreateGroup = async () => {
  const existing = await pool.query('SELECT id, name FROM groups WHERE name = $1 LIMIT 1', [GROUP_NAME]);
  if (existing.rows.length > 0) return existing.rows[0];

  const groupId = uuidv4();
  const adminUser = await findOrCreateUser('Importer');
  await pool.query('INSERT INTO groups (id, name, created_by) VALUES ($1, $2, $3)', [groupId, GROUP_NAME, adminUser.id]);
  await pool.query('INSERT INTO group_members (group_id, user_id) VALUES ($1, $2)', [groupId, adminUser.id]);
  return { id: groupId, name: GROUP_NAME, adminUser };
};

const ensureGroupMember = async (groupId, userId) => {
  await pool.query(
    'INSERT INTO group_members (group_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
    [groupId, userId]
  );
};

const importRows = async (rows) => {
  const group = await findOrCreateGroup();
  const importerUser = await findOrCreateUser('Importer');
  await ensureGroupMember(group.id, importerUser.id);
  const unknownUser = await findOrCreateUser('Unknown');
  await ensureGroupMember(group.id, unknownUser.id);

  const usernames = new Set(['Unknown']);
  rows.forEach((row) => {
    if (row.paid_by) usernames.add(normalizeUsername(row.paid_by));
    row.split_with.forEach((name) => usernames.add(name));
    parseDetailPairs(row.split_details).forEach((pair) => usernames.add(pair.name));
  });

  const userMap = {};
  for (const username of Array.from(usernames).filter(Boolean)) {
    const user = await findOrCreateUser(username);
    if (user) {
      userMap[username.toLowerCase()] = user;
      await ensureGroupMember(group.id, user.id);
    }
  }

  for (const row of rows) {
    let paidByName = normalizeUsername(row.paid_by);
    if (!paidByName) {
      paidByName = 'Unknown';
    }
    const paidBy = userMap[paidByName.toLowerCase()] || userMap['unknown'];

    const description = row.description || 'Imported expense';
    const amount = parseAmount(row.amount);
    const currency = row.currency || 'INR';
    const splitType = row.split_type || 'equal';
    const participants = row.split_with.length > 0 ? row.split_with : [paidByName];
    const date = parseDate(row.date);
    const notes = buildNotes(row.notes, date, currency);

    const isSettlement = !row.split_type && row.split_with.length === 1 && participants[0].toLowerCase() !== paidByName.toLowerCase();

    if (isSettlement) {
      const toUser = userMap[participants[0].toLowerCase()];
      if (!toUser) {
        console.warn(`Skipping settlement row because target user was not found: ${row.description}`);
        continue;
      }
      const existingSettlement = await pool.query(
        'SELECT id FROM settlements WHERE group_id = $1 AND from_user = $2 AND to_user = $3 AND amount = $4 LIMIT 1',
        [group.id, paidBy.id, toUser.id, amount]
      );
      if (existingSettlement.rows.length > 0) {
        console.log(`Skipping duplicate settlement: ${row.description}`);
        continue;
      }
      const settlementId = uuidv4();
      await pool.query(
        'INSERT INTO settlements (id, group_id, from_user, to_user, amount, settled_at) VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)',
        [settlementId, group.id, paidBy.id, toUser.id, amount]
      );
      continue;
    }

    const shares = calculateShares(amount, participants, splitType.toLowerCase(), row.split_details);
    const existingExpense = await pool.query(
      'SELECT id FROM expenses WHERE group_id = $1 AND paid_by = $2 AND description = $3 AND amount = $4 LIMIT 1',
      [group.id, paidBy.id, description, amount]
    );
    if (existingExpense.rows.length > 0) {
      console.log(`Skipping duplicate expense: ${description}`);
      continue;
    }
    const expenseId = uuidv4();

    await pool.query(
      'INSERT INTO expenses (id, group_id, paid_by, description, amount, split_type, category, notes) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
      [expenseId, group.id, paidBy.id, description, amount, splitType || 'equal', 'Imported', notes]
    );

    for (const share of shares) {
      const user = userMap[share.username.toLowerCase()];
      if (!user) {
        console.warn(`Skipping share for unknown participant '${share.username}' on expense '${description}'`);
        continue;
      }
      await pool.query(
        'INSERT INTO expense_shares (expense_id, user_id, amount) VALUES ($1, $2, $3)',
        [expenseId, user.id, share.amount]
      );
    }
  }
};

const main = async () => {
  try {
    const csvText = fs.readFileSync(CSV_PATH, 'utf8').trim();
    const lines = csvText.split(/\r?\n/).filter((line) => line.trim().length > 0);
    const header = parseCsvLine(lines.shift());
    const expectedHeader = ['date', 'description', 'paid_by', 'amount', 'currency', 'split_type', 'split_with', 'split_details', 'notes'];

    if (header.length !== expectedHeader.length) {
      console.warn('CSV header length does not match expected format. Proceeding with parsed columns.');
    }

    const rows = lines.map((line) => {
      const columns = parseCsvLine(line);
      return {
        date: columns[0] || '',
        description: columns[1] || '',
        paid_by: columns[2] || '',
        amount: columns[3] || '',
        currency: columns[4] || '',
        split_type: columns[5] || '',
        split_with: parseList(columns[6] || ''),
        split_details: columns[7] || '',
        notes: columns[8] || '',
      };
    });

    await importRows(rows);
    console.log('Import complete.');
  } catch (error) {
    console.error('Failed to import expenses:', error);
  } finally {
    await pool.end();
  }
};

main();
