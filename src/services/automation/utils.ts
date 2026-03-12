export function createAutomationId(prefix: string): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}_${crypto.randomUUID()}`;
  }
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export function resolveAutomationTimeZone(): string {
  try {
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return timezone || 'Asia/Shanghai';
  } catch {
    return 'Asia/Shanghai';
  }
}

export function sortByUpdatedAtDesc<T extends { updatedAt: number }>(items: T[]): T[] {
  return [...items].sort((a, b) => b.updatedAt - a.updatedAt);
}

export function sortByCreatedAtDesc<T extends { createdAt: number }>(items: T[]): T[] {
  return [...items].sort((a, b) => b.createdAt - a.createdAt);
}

export function sortByScheduledForAsc<T extends { scheduledFor: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const aMs = new Date(a.scheduledFor).getTime();
    const bMs = new Date(b.scheduledFor).getTime();
    return aMs - bMs;
  });
}

export function isRecordObject(input: unknown): input is Record<string, unknown> {
  return !!input && typeof input === 'object' && !Array.isArray(input);
}
