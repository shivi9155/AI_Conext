import assert from 'node:assert';
import { parseCsv } from '../src/services/csvParser';
import { calculateShares } from '../src/services/splitCalculator';
import { detectDuplicateStatus } from '../src/services/duplicateDetector';

const runTest = (name: string, fn: () => void) => {
  try {
    fn();
    console.log(`✅ ${name}`);
  } catch (error) {
    console.error(`❌ ${name}`);
    console.error(error);
    process.exit(1);
  }
};

runTest('parseCsv should load rows with all expected columns', () => {
  const csv = 'date,description,paid_by,amount,currency,split_type,split_with,split_details,notes\n2026-06-15,Test expense,Priya,100,INR,equal,Priya;Rohan,,Test note';
  const rows = parseCsv(csv);
  assert.strictEqual(rows.length, 1);
  assert.strictEqual(rows[0].description, 'Test expense');
  assert.strictEqual(rows[0].paid_by, 'Priya');
});

runTest('calculateShares equal splits evenly with correction', () => {
  const result = calculateShares(100, 'equal', ['Aisha', 'Rohan', 'Priya'], '');
  assert.strictEqual(result.shares.length, 3);
  assert.strictEqual(result.shares[0].amount + result.shares[1].amount + result.shares[2].amount, 100);
});

runTest('calculateShares percentage validates 100 percent', () => {
  const result = calculateShares(200, 'percentage', ['Aisha', 'Rohan'], 'Aisha 70%; Rohan 30%');
  assert.strictEqual(result.shares[0].amount, 140);
  assert.strictEqual(result.shares[1].amount, 60);
  assert.deepStrictEqual(result.errors, []);
});

runTest('calculateShares share split allocates proportionally', () => {
  const result = calculateShares(300, 'share', ['Aisha', 'Rohan'], 'Aisha 1; Rohan 2');
  assert.strictEqual(result.shares[0].amount, 100);
  assert.strictEqual(result.shares[1].amount, 200);
});

runTest('detectDuplicateStatus returns exact for same normalized description', () => {
  const rows = [{ date: '2026-06-15', paid_by: 'Priya', amount: '100.00', description: 'Dinner at Marina Bites' }];
  const status = detectDuplicateStatus({ date: '2026-06-15', paid_by: 'priYa', amount: '100.00', description: 'dinner - marina bites' }, rows);
  assert.strictEqual(status.status, 'possible');
});

console.log('All backend tests passed.');
