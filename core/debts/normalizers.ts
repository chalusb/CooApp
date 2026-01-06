import type { DebtEntry, DebtEntryType } from '@/types/debts';

const normalizeDebtType = (value: unknown): DebtEntryType => {
  if (typeof value === 'string') {
    const lower = value.toLowerCase();
    if (lower === 'abono' || lower === 'pago' || lower === 'payment') {
      return 'abono';
    }
    if (lower === 'deuda' || lower === 'debit' || lower === 'loan') {
      return 'deuda';
    }
  }
  return 'deuda';
};

const toNumber = (value: unknown): number => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (!Number.isNaN(parsed) && Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return 0;
};

const toISOString = (value: unknown): string => {
  if (!value) return new Date().toISOString();
  if (typeof value === 'string') {
    const date = new Date(value);
    if (!Number.isNaN(date.valueOf())) {
      return date.toISOString();
    }
    return new Date(value).toISOString();
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return new Date(value).toISOString();
  }
  return new Date().toISOString();
};

export const normalizeDebtEntry = (raw: any): DebtEntry | null => {
  if (!raw || typeof raw !== 'object') {
    return null;
  }
  const id = typeof raw.id === 'string' ? raw.id : typeof raw._id === 'string' ? raw._id : '';
  if (!id) {
    return null;
  }
  const title =
    typeof raw.title === 'string'
      ? raw.title
      : typeof raw.name === 'string'
        ? raw.name
        : typeof raw.descripcion === 'string'
          ? raw.descripcion
          : '';

  const amount = toNumber(raw.amount ?? raw.monto ?? raw.value);
  const type = normalizeDebtType(raw.type ?? raw.kind ?? raw.category);
  const date = toISOString(raw.date ?? raw.fecha ?? raw.createdAt);
  const createdAt = raw.createdAt ? toISOString(raw.createdAt) : null;
  const updatedAt = raw.updatedAt ? toISOString(raw.updatedAt) : null;
  const notes =
    typeof raw.notes === 'string'
      ? raw.notes
      : typeof raw.descripcion === 'string'
        ? raw.descripcion
        : null;

  return {
    id,
    title,
    amount,
    type,
    date,
    createdAt,
    updatedAt,
    notes,
  };
};

export const sortDebtEntries = (entries: DebtEntry[]): DebtEntry[] => {
  return [...entries].sort((a, b) => {
    if (a.date !== b.date) {
      return b.date.localeCompare(a.date);
    }
    return b.createdAt?.localeCompare(a.createdAt || '') ?? 0;
  });
};

export const computeDebtBalance = (entries: DebtEntry[]) => {
  return entries.reduce(
    (acc, entry) => {
      if (entry.type === 'abono') {
        acc.totalAbonos += entry.amount;
        acc.balance -= entry.amount;
      } else {
        acc.totalDeudas += entry.amount;
        acc.balance += entry.amount;
      }
      return acc;
    },
    {
      balance: 0,
      totalDeudas: 0,
      totalAbonos: 0,
    }
  );
};
