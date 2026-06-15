import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';
import { query } from '../db';
import { parseCsv, ImportCsvRow } from './csvParser';
import { calculateShares, parseParticipants, parseSplitDetails, SplitType } from './splitCalculator';
import { detectDuplicateStatus, DuplicateStatus } from './duplicateDetector';

const SUPPORTED_CURRENCIES = ['INR', 'USD'];
const PLACEHOLDER_USER = 'Unknown';

const normalizeName = (value: string): string => {
  return String(value || '').trim().replace(/\s+/g, ' ');
};

const normalizeLookup = (value: string): string => normalizeName(value).toLowerCase();

const baseName = (value: string): string => {
  const normalized = normalizeName(value);
  const parts = normalized.split(' ');
  if (parts.length === 2 && /^[A-Za-z]$/.test(parts[1])) {
    return parts[0];
  }
  return normalized;
};

const parseDateValue = (raw: string): string | null => {
  if (!raw || !raw.trim()) return null;

  const value = raw.trim();
  const parsed = Date.parse(value);
  if (!Number.isNaN(parsed)) {
    return new Date(parsed).toISOString().slice(0, 10);
  }

  const monthNames: Record<string, number> = {
    jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
    jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
  };

  const parts = value.split(/[\/\-\.]/).map((part) => part.trim());
  if (parts.length === 3) {
    let [first, second, third] = parts;
    let year = Number(third);
    let month = Number(second);
    let day = Number(first);

    if (isNaN(year) && monthNames[third.toLowerCase()]) {
      year = new Date().getFullYear();
    }
    if (isNaN(month) && monthNames[second.toLowerCase()]) {
      month = monthNames[second.toLowerCase()];
    }
    if (isNaN(day) && monthNames[first.toLowerCase()]) {
      day = month;
      month = monthNames[first.toLowerCase()];
      year = Number(third);
    }

    if (first.length === 4 && Number.isFinite(year) && Number.isFinite(month) && Number.isFinite(day)) {
      year = Number(first);
      month = Number(second);
      day = Number(third);
    }

    if (year < 100) year += 2000;
    if ([year, month, day].every((n) => Number.isFinite(n))) {
      const date = new Date(year, month - 1, day);
      if (!Number.isNaN(date.getTime())) {
        return date.toISOString().slice(0, 10);
      }
    }
  }

  if (parts.length === 2) {
    const [first, second] = parts;
    const month = monthNames[first.toLowerCase()];
    const day = Number(second);
    if (month && Number.isFinite(day)) {
      const year = new Date().getFullYear();
      const date = new Date(year, month - 1, day);
      if (!Number.isNaN(date.getTime())) {
        return date.toISOString().slice(0, 10);
      }
    }
  }

  return null;
};

const parseAmountValue = (raw: string): number => {
  if (!raw || !raw.trim()) return NaN;
  const cleaned = raw.trim().replace(/,/g, '').replace(/[£$₹]/g, '');
  const amount = Number(cleaned);
  return Number.isFinite(amount) ? amount : NaN;
};

const normalizeCurrency = (raw: string): string | null => {
  const currency = normalizeName(raw).toUpperCase();
  if (!currency) return null;
  if (SUPPORTED_CURRENCIES.includes(currency)) return currency;
  return null;
};

const parseSplitType = (raw: string): SplitType => {
  const normalized = normalizeName(raw).toLowerCase();
  if (['equal', 'percentage', 'share', 'unequal'].includes(normalized)) {
    return normalized as SplitType;
  }
  return 'equal';
};

const parseCurrencyFromNotes = (notes: string): string | null => {
  if (!notes) return null;
  const match = notes.match(/currency\s*[:=]\s*(USD|INR)/i);
  if (match) {
    const currency = match[1].toUpperCase();
    return SUPPORTED_CURRENCIES.includes(currency) ? currency : null;
  }
  return null;
};

const isUuid = (value: string): boolean => {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value.trim());
};

const extractSettlementNames = (text: string): { from?: string; to?: string } => {
  const normalized = normalizeName(text).toLowerCase();
  const backMatch = normalized.match(/([a-zA-Z]+) paid ([a-zA-Z]+) back/);
  if (backMatch) {
    return { from: normalizeName(backMatch[1]), to: normalizeName(backMatch[2]) };
  }
  const paidMatch = normalized.match(/([a-zA-Z]+) paid ([a-zA-Z]+)/);
  if (paidMatch) {
    return { from: normalizeName(paidMatch[1]), to: normalizeName(paidMatch[2]) };
  }
  const paidToMatch = normalized.match(/paid ([a-zA-Z]+)/);
  if (paidToMatch) {
    return { to: normalizeName(paidToMatch[1]) };
  }
  return {};
};

const detectRefund = (description: string, notes: string): boolean => {
  const normalized = `${description} ${notes}`.toLowerCase();
  return /refund|returned|cancelled|credit/.test(normalized);
};

interface UserRecord {
  id: string;
  username: string;
}

interface ImportReportRow {
  rowNumber: number;
  description: string;
  status: 'imported' | 'skipped' | 'duplicate' | 'settlement' | 'warning';
  messages: string[];
  duplicateStatus: DuplicateStatus;
}

interface ImportReport {
  importBatchId: string;
  groupId: string;
  importedBy: string;
  totalRows: number;
  importedRows: number;
  skippedRows: number;
  duplicateRows: number;
  settlementRows: number;
  validationErrors: Array<{ rowNumber: number; field?: string; message: string }>;
  aliasCorrections: Array<{ original: string; resolved: string }>;
  rows: ImportReportRow[];
}

const buildUserMap = async (): Promise<{
  usernameMap: Map<string, UserRecord>;
  aliasMap: Map<string, UserRecord>;
}> => {
  const usernameMap = new Map<string, UserRecord>();
  const aliasMap = new Map<string, UserRecord>();

  const usersRes = await query(`SELECT id, username FROM users`);
  usersRes.rows.forEach((row: any) => {
    const normalized = normalizeLookup(row.username);
    usernameMap.set(normalized, { id: row.id, username: row.username });
    const base = normalizeLookup(baseName(row.username));
    if (base && !usernameMap.has(base)) {
      usernameMap.set(base, { id: row.id, username: row.username });
    }
  });

  const aliasRes = await query(`SELECT alias, user_id FROM user_aliases`);
  for (const aliasRow of aliasRes.rows) {
    const alias = normalizeLookup(aliasRow.alias);
    if (!alias) continue;
    const userRes = await query(`SELECT id, username FROM users WHERE id = $1 LIMIT 1`, [aliasRow.user_id]);
    if (userRes.rows.length === 0) continue;
    const user = { id: userRes.rows[0].id, username: userRes.rows[0].username };
    aliasMap.set(alias, user);
  }

  return { usernameMap, aliasMap };
};

const getOrCreatePlaceholderUser = async (): Promise<UserRecord> => {
  const normalized = normalizeLookup(PLACEHOLDER_USER);
  const existing = await query(`SELECT id, username FROM users WHERE LOWER(username) = $1 LIMIT 1`, [normalized]);
  if (existing.rows.length > 0) {
    return { id: existing.rows[0].id, username: existing.rows[0].username };
  }

  const userId = uuidv4();
  const email = 'unknown@example.com';
  const passwordHash = await bcrypt.hash('UnknownUser123!', 10);
  await query(`INSERT INTO users (id, username, email, password_hash) VALUES ($1, $2, $3, $4)`, [userId, PLACEHOLDER_USER, email, passwordHash]);
  return { id: userId, username: PLACEHOLDER_USER };
};

const createUser = async (username: string): Promise<UserRecord> => {
  const normalized = normalizeName(username);
  const existing = await query(`SELECT id, username FROM users WHERE LOWER(username) = $1 LIMIT 1`, [normalizeLookup(normalized)]);
  if (existing.rows.length > 0) {
    return { id: existing.rows[0].id, username: existing.rows[0].username };
  }

  const userId = uuidv4();
  const emailBase = normalizeLookup(normalized).replace(/[^a-z0-9]+/g, '_') || 'imported_user';
  let email = `${emailBase}@example.com`;
  let suffix = 1;
  while (true) {
    const emailCheck = await query(`SELECT 1 FROM users WHERE email = $1`, [email]);
    if (emailCheck.rows.length === 0) break;
    email = `${emailBase}${suffix}@example.com`;
    suffix += 1;
  }

  const passwordHash = await bcrypt.hash('ImportedUser123!', 10);
  await query(`INSERT INTO users (id, username, email, password_hash) VALUES ($1, $2, $3, $4)`, [userId, normalized, email, passwordHash]);
  return { id: userId, username: normalized };
};

const saveAlias = async (alias: string, userId: string): Promise<void> => {
  const normalized = normalizeLookup(alias);
  if (!normalized) return;
  try {
    await query(
      `INSERT INTO user_aliases (alias, user_id) VALUES ($1, $2) ON CONFLICT (alias) DO NOTHING`,
      [normalized, userId]
    );
  } catch (error) {
    // ignore alias uniqueness conflict
  }
};

const resolveUser = async (
  rawName: string,
  usernameMap: Map<string, UserRecord>,
  aliasMap: Map<string, UserRecord>,
  aliasCorrections: Array<{ original: string; resolved: string }>
): Promise<UserRecord | null> => {
  const normalized = normalizeName(rawName);
  if (!normalized) return null;

  if (isUuid(normalized)) {
    const userRes = await query(`SELECT id, username FROM users WHERE id = $1 LIMIT 1`, [normalized]);
    if (userRes.rows.length > 0) {
      return { id: userRes.rows[0].id, username: userRes.rows[0].username };
    }
  }

  const lookup = normalizeLookup(normalized);
  const base = normalizeLookup(baseName(normalized));

  if (aliasMap.has(lookup)) {
    const user = aliasMap.get(lookup)!;
    aliasCorrections.push({ original: rawName, resolved: user.username });
    return user;
  }
  if (usernameMap.has(lookup)) {
    const user = usernameMap.get(lookup)!;
    aliasCorrections.push({ original: rawName, resolved: user.username });
    return user;
  }
  if (base !== lookup && usernameMap.has(base)) {
    const user = usernameMap.get(base)!;
    aliasCorrections.push({ original: rawName, resolved: user.username });
    return user;
  }
  if (base !== lookup && aliasMap.has(base)) {
    const user = aliasMap.get(base)!;
    aliasCorrections.push({ original: rawName, resolved: user.username });
    return user;
  }

  return null;
};

const ensureGroupMember = async (groupId: string, userId: string): Promise<void> => {
  await query(`INSERT INTO group_members (group_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [groupId, userId]);
};

export const importExpensesFromCsv = async (
  csvText: string,
  groupId: string,
  importedBy: string
): Promise<ImportReport> => {
  const parsedRows = parseCsv(csvText || '');
  const importBatchId = uuidv4();
  const validationErrors: Array<{ rowNumber: number; field?: string; message: string }> = [];
  const aliasCorrections: Array<{ original: string; resolved: string }> = [];
  const rowsReport: ImportReportRow[] = [];
  let importedRows = 0;
  let skippedRows = 0;
  let duplicateRows = 0;
  let settlementRows = 0;

  const groupRes = await query(`SELECT id FROM groups WHERE id = $1 LIMIT 1`, [groupId]);
  if (groupRes.rows.length === 0) {
    throw new Error('Group not found');
  }

  const { usernameMap, aliasMap } = await buildUserMap();
  const placeholderUser = await getOrCreatePlaceholderUser();

  const existingExpenseRes = await query(`
    SELECT e.date::text AS date, e.amount::text AS amount, e.description, u.username AS paid_by
    FROM expenses e
    JOIN users u ON e.paid_by = u.id
    WHERE e.group_id = $1
  `, [groupId]);

  const previousRows: Array<{ date: string; amount: string; paid_by: string; description: string }> = existingExpenseRes.rows.map((row: any) => ({
    date: row.date,
    amount: row.amount,
    paid_by: normalizeLookup(row.paid_by),
    description: row.description,
  }));

  await query(`INSERT INTO import_logs (id, imported_by, group_id, total_rows, imported_rows, skipped_rows, duplicates, settlement_rows, validation_errors, report)
               VALUES ($1, $2, $3, 0, 0, 0, 0, 0, $4, $5)`,
    [importBatchId, importedBy, groupId, JSON.stringify([]), JSON.stringify({})]);

  for (const row of parsedRows) {
    const rowMessages: string[] = [];
    const description = row.description || 'Imported expense';
    let status: ImportReportRow['status'] = 'imported';
    const rawPaidBy = normalizeName(row.paid_by);
    const paidByCandidate = await resolveUser(rawPaidBy, usernameMap, aliasMap, aliasCorrections);
    const paidBy = paidByCandidate ?? placeholderUser;
    if (!paidByCandidate) {
      validationErrors.push({ rowNumber: row.rowNumber, field: 'paid_by', message: `Unknown payer '${row.paid_by}'. Using placeholder account.` });
      rowMessages.push(`Unknown payer detected`);
    }

    let currency = normalizeCurrency(row.currency);
    if (!currency) {
      currency = parseCurrencyFromNotes(row.notes) || null;
      if (currency) {
        rowMessages.push(`Currency inferred from notes: ${currency}`);
      } else {
        validationErrors.push({ rowNumber: row.rowNumber, field: 'currency', message: 'Currency is missing or unsupported' });
        rowMessages.push('Missing or invalid currency');
      }
    }

    const date = parseDateValue(row.date);
    if (!date) {
      validationErrors.push({ rowNumber: row.rowNumber, field: 'date', message: `Invalid date '${row.date}'` });
      rowMessages.push('Invalid date');
    }

    const amount = parseAmountValue(row.amount);
    if (Number.isNaN(amount)) {
      validationErrors.push({ rowNumber: row.rowNumber, field: 'amount', message: `Invalid amount '${row.amount}'` });
      rowMessages.push('Invalid amount');
    } else if (amount === 0) {
      validationErrors.push({ rowNumber: row.rowNumber, field: 'amount', message: 'Amount is zero' });
      rowMessages.push('Amount is zero');
    }

    const isRefund = amount < 0 || detectRefund(row.description, row.notes);
    if (isRefund && amount > 0) {
      rowMessages.push('Negative amount inferred from refund note');
    }

    const splitType = parseSplitType(row.split_type);
    let participants = parseParticipants(row.split_with);
    const detailParticipants = parseSplitDetails(row.split_details).map((detail) => detail.username);
    if (participants.length === 0 && detailParticipants.length > 0) {
      participants = detailParticipants;
    }
    if (participants.length === 0) {
      participants = [paidBy.username];
      rowMessages.push('No split participants provided, defaulted to payer only');
    }
    if (splitType === 'equal' && row.split_details.trim().length > 0) {
      rowMessages.push('split_type is equal but split_details were provided; equal split applied');
    }

    const settlementNames = extractSettlementNames(description);
    const isSettlement = Boolean(settlementNames.from && settlementNames.to) ||
      (splitType === 'equal' && participants.length === 1 && normalizeLookup(participants[0]) !== normalizeLookup(paidBy.username));

    const duplicateCheck = detectDuplicateStatus(
      { date: date || '', paid_by: paidBy.username, amount: amount.toFixed(2), description },
      previousRows
    );
    if (duplicateCheck.status !== 'none') {
      duplicateRows += 1;
      if (duplicateCheck.status === 'exact') {
        skippedRows += 1;
        status = 'skipped';
        rowMessages.push('Exact duplicate skipped');
        rowsReport.push({ rowNumber: row.rowNumber, description, status, messages: rowMessages, duplicateStatus: duplicateCheck.status });
        continue;
      }

      status = 'warning';
      rowMessages.push('Possible duplicate');
    }

    if (typeof amount !== 'number' || Number.isNaN(amount) || amount === 0 || !date) {
      skippedRows += 1;
      status = 'skipped';
      rowsReport.push({ rowNumber: row.rowNumber, description, status, messages: rowMessages, duplicateStatus: duplicateCheck.status });
      continue;
    }

    const sharesResult = calculateShares(amount, splitType, participants, row.split_details);
    if (sharesResult.errors.length > 0) {
      sharesResult.errors.forEach((msg) => {
        validationErrors.push({ rowNumber: row.rowNumber, message: msg });
        rowMessages.push(msg);
      });
    }

    if (isSettlement) {
      settlementRows += 1;
      status = 'settlement';
      const toNameCandidate = settlementNames.to || participants[0];
      const toUserCandidate = await resolveUser(toNameCandidate, usernameMap, aliasMap, aliasCorrections);
      const toUser = toUserCandidate ?? placeholderUser;
      if (!toUserCandidate) {
        validationErrors.push({ rowNumber: row.rowNumber, field: 'split_with', message: `Unknown settlement recipient '${toNameCandidate}'. Using placeholder account.` });
        rowMessages.push('Unknown settlement recipient');
      }

      await ensureGroupMember(groupId, paidBy.id);
      await ensureGroupMember(groupId, toUser.id);
      const settlementId = uuidv4();
      await query(`INSERT INTO settlements (id, group_id, from_user, to_user, amount, settled_at) VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)`,
        [settlementId, groupId, paidBy.id, toUser.id, amount]);

      rowsReport.push({ rowNumber: row.rowNumber, description, status, messages: rowMessages, duplicateStatus: duplicateCheck.status });
      previousRows.push({ date, amount: amount.toFixed(2), paid_by: normalizeLookup(paidBy.username), description });
      importedRows += 1;
      continue;
    }

    const expenseId = uuidv4();
    await query(`INSERT INTO expenses (id, group_id, paid_by, description, amount, currency, split_type, date, is_settlement, import_batch_id, notes)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [expenseId, groupId, paidBy.id, description, amount.toFixed(2), currency, splitType, date, false, importBatchId, row.notes || null]);

    await ensureGroupMember(groupId, paidBy.id);

    for (const share of sharesResult.shares) {
      const participantName = share.username;
      let user = await resolveUser(participantName, usernameMap, aliasMap, aliasCorrections);
      if (!user) {
        const createdUser = await createUser(participantName);
        user = createdUser;
        await saveAlias(participantName, user.id);
        validationErrors.push({ rowNumber: row.rowNumber, field: 'split_with', message: `Unknown participant '${participantName}' created automatically` });
        rowMessages.push(`Created participant '${participantName}'`);
      }
      await ensureGroupMember(groupId, user.id);
      await query(`INSERT INTO expense_splits (expense_id, user_id, amount) VALUES ($1, $2, $3)`, [expenseId, user.id, share.amount.toFixed(2)]);
      await query(`INSERT INTO expense_shares (expense_id, user_id, amount) VALUES ($1, $2, $3)`, [expenseId, user.id, share.amount.toFixed(2)]);
    }

    importedRows += 1;
    rowsReport.push({ rowNumber: row.rowNumber, description, status, messages: rowMessages, duplicateStatus: duplicateCheck.status });
    previousRows.push({ date, amount: amount.toFixed(2), paid_by: normalizeLookup(paidBy.username), description });
  }

  const report: ImportReport = {
    importBatchId,
    groupId,
    importedBy,
    totalRows: parsedRows.length,
    importedRows,
    skippedRows,
    duplicateRows,
    settlementRows,
    validationErrors,
    aliasCorrections,
    rows: rowsReport,
  };

  await query(`UPDATE import_logs SET imported_rows = $1, skipped_rows = $2, duplicates = $3, settlement_rows = $4, validation_errors = $5, report = $6 WHERE id = $7`,
    [importedRows, skippedRows, duplicateRows, settlementRows, JSON.stringify(validationErrors), JSON.stringify(report), importBatchId]);

  return report;
};

export const getImportHistory = async (groupId: string) => {
  const result = await query(`
    SELECT il.id, il.imported_at, il.imported_by, il.group_id, il.total_rows, il.imported_rows, il.skipped_rows, il.duplicates, il.settlement_rows, il.validation_errors, il.report, u.username AS imported_by_username
    FROM import_logs il
    LEFT JOIN users u ON il.imported_by = u.id
    WHERE il.group_id = $1
    ORDER BY il.imported_at DESC
  `, [groupId]);
  return result.rows;
};
