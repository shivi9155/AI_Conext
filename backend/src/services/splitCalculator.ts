export type SplitType = 'equal' | 'percentage' | 'share' | 'unequal';

export interface SplitDetail {
  username: string;
  value: number;
}

export interface SplitShare {
  username: string;
  amount: number;
}

export interface SplitCalculationResult {
  shares: SplitShare[];
  errors: string[];
}

const normalizeName = (raw: string): string => raw.trim().replace(/\s+/g, ' ');

export const parseParticipants = (text: string): string[] => {
  if (!text) return [];
  return text
    .split(';')
    .map((item) => normalizeName(item))
    .filter((value) => value.length > 0);
};

export const parseSplitDetails = (text: string): SplitDetail[] => {
  if (!text) return [];
  return text
    .split(';')
    .map((item) => item.trim())
    .filter(Boolean)
    .map((fragment) => {
      const parts = fragment.split(/\s+/);
      const rawValue = parts.pop() || '0';
      const username = normalizeName(parts.join(' '));
      const value = Number(rawValue.replace('%', ''));
      return { username, value: Number.isFinite(value) ? value : 0 };
    })
    .filter((item) => item.username.length > 0 && item.value >= 0);
};

export const calculateShares = (
  totalAmount: number,
  splitType: SplitType,
  participants: string[],
  splitDetailsText: string
): SplitCalculationResult => {
  const errors: string[] = [];
  const participantsSet = Array.from(new Set(participants.filter(Boolean).map(normalizeName)));

  if (participantsSet.length === 0) {
    return { shares: [], errors: ['No split participants provided'] };
  }

  if (totalAmount <= 0) {
    return { shares: [], errors: ['Amount must be greater than zero'] };
  }

  const details = parseSplitDetails(splitDetailsText);
  const safeAmount = Number(totalAmount);

  if (splitType === 'equal' || details.length === 0) {
    const perUser = Number((safeAmount / participantsSet.length).toFixed(2));
    const shares = participantsSet.map((username) => ({ username, amount: perUser }));
    const correction = Number((safeAmount - shares.reduce((sum, share) => sum + share.amount, 0)).toFixed(2));
    if (correction !== 0 && shares.length > 0) {
      shares[shares.length - 1].amount += correction;
    }
    return { shares, errors };
  }

  if (splitType === 'percentage') {
    const provided = details.filter((detail) => participantsSet.includes(detail.username));
    const unknowns = details.filter((detail) => !participantsSet.includes(detail.username));
    if (unknowns.length > 0) {
      errors.push(`Split details contain unknown participants: ${unknowns.map((item) => item.username).join(', ')}`);
    }
    const totalPercent = provided.reduce((sum, item) => sum + item.value, 0);
    if (Math.abs(totalPercent - 100) > 0.1) {
      errors.push('Percentage split total must equal 100%');
    }
    const shares = participantsSet.map((username) => {
      const detail = provided.find((item) => item.username === username);
      const percent = detail ? detail.value : 0;
      return { username, amount: Number((safeAmount * percent / 100).toFixed(2)) };
    });
    const correction = Number((safeAmount - shares.reduce((sum, share) => sum + share.amount, 0)).toFixed(2));
    if (correction !== 0 && shares.length > 0) {
      shares[shares.length - 1].amount += correction;
    }
    return { shares, errors };
  }

  if (splitType === 'share') {
    const provided = details.filter((detail) => participantsSet.includes(detail.username));
    const unknowns = details.filter((detail) => !participantsSet.includes(detail.username));
    if (unknowns.length > 0) {
      errors.push(`Share split contains unknown participants: ${unknowns.map((item) => item.username).join(', ')}`);
    }
    const totalShares = provided.reduce((sum, item) => sum + item.value, 0);
    if (totalShares <= 0) {
      errors.push('Share split requires a positive total number of shares');
      return { shares: [], errors };
    }
    const shares = participantsSet.map((username) => {
      const detail = provided.find((item) => item.username === username);
      const shareCount = detail ? detail.value : 0;
      return { username, amount: Number((safeAmount * (shareCount / totalShares)).toFixed(2)) };
    });
    const correction = Number((safeAmount - shares.reduce((sum, share) => sum + share.amount, 0)).toFixed(2));
    if (correction !== 0 && shares.length > 0) {
      shares[shares.length - 1].amount += correction;
    }
    return { shares, errors };
  }

  if (splitType === 'unequal') {
    const provided = details.filter((detail) => participantsSet.includes(detail.username));
    const unknowns = details.filter((detail) => !participantsSet.includes(detail.username));
    if (unknowns.length > 0) {
      errors.push(`Unequal split contains unknown participants: ${unknowns.map((item) => item.username).join(', ')}`);
    }
    const totalProvided = provided.reduce((sum, item) => sum + item.value, 0);
    if (Math.abs(totalProvided - safeAmount) > 0.1) {
      errors.push('Unequal split details must sum to the expense amount');
    }
    const shares = participantsSet.map((username) => {
      const detail = provided.find((item) => item.username === username);
      return { username, amount: detail ? detail.value : 0 };
    });
    return { shares, errors };
  }

  return { shares: [], errors: ['Unknown split type'] };
};
