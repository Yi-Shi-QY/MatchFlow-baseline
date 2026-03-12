import { isRecordObject } from './utils';

interface ReadOptions<T> {
  normalizer: (raw: unknown) => T | null;
}

interface WriteOptions<T> {
  limit?: number;
  sort?: (a: T, b: T) => number;
}

export function readAutomationRecords<T>(
  storageKey: string,
  options: ReadOptions<T>,
): T[] {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((entry) => options.normalizer(entry))
      .filter((entry): entry is T => entry !== null);
  } catch (error) {
    console.error(`[automation] Failed to read ${storageKey}`, error);
    return [];
  }
}

export function writeAutomationRecords<T>(
  storageKey: string,
  records: T[],
  options: WriteOptions<T> = {},
): void {
  const next = [...records];
  if (options.sort) {
    next.sort(options.sort);
  }
  const trimmed = Number.isFinite(options.limit) ? next.slice(0, options.limit) : next;
  localStorage.setItem(storageKey, JSON.stringify(trimmed));
}

export function normalizeTimestamp(input: unknown, fallback: number): number {
  return typeof input === 'number' && Number.isFinite(input) ? input : fallback;
}

export function normalizeString(input: unknown, fallback = ''): string {
  return typeof input === 'string' ? input : fallback;
}

export function normalizeBoolean(input: unknown, fallback = false): boolean {
  return typeof input === 'boolean' ? input : fallback;
}

export function normalizeObject<T extends Record<string, unknown>>(
  input: unknown,
): T | null {
  return isRecordObject(input) ? (input as T) : null;
}
