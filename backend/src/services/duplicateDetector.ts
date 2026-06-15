export type DuplicateStatus = 'none' | 'exact' | 'possible';

const normalizeDescription = (description: string): string =>
  description
    .trim()
    .toLowerCase()
    .replace(/["'`\-_.]/g, ' ')
    .replace(/\s+/g, ' ');

const jaccardSimilarity = (a: string, b: string): number => {
  const aSet = new Set(a.split(' ').filter(Boolean));
  const bSet = new Set(b.split(' ').filter(Boolean));
  const intersection = new Set([...aSet].filter((item) => bSet.has(item)));
  const union = new Set([...aSet, ...bSet]);
  return union.size === 0 ? 0 : intersection.size / union.size;
};

export interface DuplicateCheckResult {
  status: DuplicateStatus;
  matchedWith?: number;
}

export const detectDuplicateStatus = (
  current: { date: string; paid_by: string; amount: string; description: string },
  previousRows: Array<{ date: string; paid_by: string; amount: string; description: string }>
): DuplicateCheckResult => {
  const currentNormalized = normalizeDescription(current.description);
  for (let i = 0; i < previousRows.length; i += 1) {
    const previous = previousRows[i];
    if (
      previous.date === current.date &&
      previous.paid_by.toLowerCase() === current.paid_by.toLowerCase() &&
      previous.amount === current.amount
    ) {
      const previousNormalized = normalizeDescription(previous.description);
      if (currentNormalized === previousNormalized) {
        return { status: 'exact', matchedWith: i + 2 };
      }
      const similarity = jaccardSimilarity(currentNormalized, previousNormalized);
      if (similarity >= 0.6) {
        return { status: 'possible', matchedWith: i + 2 };
      }
    }
  }
  return { status: 'none' };
};
