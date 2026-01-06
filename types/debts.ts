export type DebtEntryType = 'deuda' | 'abono';

export interface DebtEntry {
  id: string;
  title: string;
  amount: number;
  type: DebtEntryType;
  date: string;
  createdAt?: string | null;
  updatedAt?: string | null;
  notes?: string | null;
}

export interface DebtApiResponse<T> {
  status: string;
  data: T;
  message?: string;
}
