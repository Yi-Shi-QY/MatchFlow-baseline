import type { AutomationSchedule } from './types';

function padTimePart(value: number): string {
  return String(value).padStart(2, '0');
}

export function buildDailyTime(hour: number, minute: number): string {
  return `${padTimePart(hour)}:${padTimePart(minute)}`;
}

export function parseDailyTimeParts(value: string): { hour: number; minute: number } | null {
  if (typeof value !== 'string') {
    return null;
  }
  const [hourText, minuteText] = value.split(':');
  const hour = Number(hourText);
  const minute = Number(minuteText);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) {
    return null;
  }
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    return null;
  }
  return {
    hour,
    minute,
  };
}

export function setLocalTime(dateInput: Date | string | number, hour: number, minute: number): Date {
  const next = new Date(dateInput);
  next.setHours(hour, minute, 0, 0);
  return next;
}

export function parseAutomationTimestamp(value: string | null | undefined): number | null {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return null;
  }
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : null;
}

export function isSameLocalDay(leftInput: Date | string | number, rightInput: Date | string | number): boolean {
  const left = new Date(leftInput);
  const right = new Date(rightInput);
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
}

export function getEndOfLocalDay(value: Date | string | number): Date {
  const next = new Date(value);
  next.setHours(23, 59, 59, 999);
  return next;
}

export function computeNextScheduleOccurrence(
  schedule: AutomationSchedule,
  nowInput: Date = new Date(),
): string | null {
  const now = new Date(nowInput);

  if (schedule.type === 'one_time') {
    return schedule.runAt;
  }

  const parts = parseDailyTimeParts(schedule.time);
  if (!parts) {
    return null;
  }

  const next = setLocalTime(now, parts.hour, parts.minute);
  if (next.getTime() <= now.getTime()) {
    next.setDate(next.getDate() + 1);
  }
  return next.toISOString();
}

export function computeFollowingScheduleOccurrence(
  schedule: AutomationSchedule,
  occurrenceInput: Date | string | number,
): string | null {
  if (schedule.type === 'one_time') {
    return null;
  }
  const occurrence = new Date(occurrenceInput);
  const nextAnchor = new Date(occurrence);
  nextAnchor.setSeconds(1, 0);
  return computeNextScheduleOccurrence(schedule, nextAnchor);
}

export function computeOneTimeRecoveryWindowEnd(
  scheduledFor: Date | string | number,
  recoveryWindowMinutes: number,
): string {
  const scheduledAt = new Date(scheduledFor).getTime();
  return new Date(scheduledAt + Math.max(0, recoveryWindowMinutes) * 60_000).toISOString();
}

export function computeDailyRecoveryWindowEnd(
  scheduledFor: Date | string | number,
  recoveryWindowMinutes: number,
): string {
  const scheduledAt = new Date(scheduledFor);
  const byWindow = new Date(scheduledAt.getTime() + Math.max(0, recoveryWindowMinutes) * 60_000);
  const endOfDay = getEndOfLocalDay(scheduledAt);
  return new Date(Math.min(byWindow.getTime(), endOfDay.getTime())).toISOString();
}

export function formatAutomationSchedule(
  schedule: AutomationSchedule | undefined,
  language: 'zh' | 'en',
): string {
  if (!schedule) {
    return language === 'zh' ? '待补充时间' : 'Time needed';
  }

  if (schedule.type === 'daily') {
    return language === 'zh'
      ? `每日 ${schedule.time}`
      : `Daily at ${schedule.time}`;
  }

  const runDate = new Date(schedule.runAt);
  if (Number.isNaN(runDate.getTime())) {
    return language === 'zh' ? '时间无效' : 'Invalid time';
  }
  return runDate.toLocaleString(language === 'zh' ? 'zh-CN' : 'en-US', {
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}
