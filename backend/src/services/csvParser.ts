export interface ImportCsvRow {
  rowNumber: number;
  date: string;
  description: string;
  paid_by: string;
  amount: string;
  currency: string;
  split_type: string;
  split_with: string;
  split_details: string;
  notes: string;
}

const parseCsvLine = (line: string): string[] => {
  const result: string[] = [];
  let current = '';
  let isQuoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      if (isQuoted && line[i + 1] === '"') {
        current += '"';
        i += 1;
        continue;
      }
      isQuoted = !isQuoted;
      continue;
    }
    if (char === ',' && !isQuoted) {
      result.push(current);
      current = '';
      continue;
    }
    current += char;
  }
  result.push(current);
  return result.map((value) => value.trim());
};

const normalizeHeader = (header: string): string => header.trim().toLowerCase().replace(/\s+/g, '_');

export const parseCsv = (rawCsv: string): ImportCsvRow[] => {
  const lines = rawCsv.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length === 0) {
    return [];
  }

  const headerCells = parseCsvLine(lines[0]).map(normalizeHeader);
  const expectedColumns = ['date', 'description', 'paid_by', 'amount', 'currency', 'split_type', 'split_with', 'split_details', 'notes'];
  const missingColumns = expectedColumns.filter((column) => !headerCells.includes(column));
  if (missingColumns.length > 0) {
    throw new Error(`CSV is missing required columns: ${missingColumns.join(', ')}`);
  }

  return lines.slice(1).map((line, index) => {
    const values = parseCsvLine(line);
    const row: any = { rowNumber: index + 2 };
    headerCells.forEach((key, index) => {
      row[key] = values[index] || '';
    });
    return row as ImportCsvRow;
  });
};
