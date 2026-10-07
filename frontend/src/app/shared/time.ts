import { Pipe, PipeTransform } from '@angular/core';

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export function humanizeDuration(ms: number): string {
  const abs = Math.abs(ms);
  if (abs < HOUR) return `${Math.max(1, Math.round(abs / MINUTE))}m`;
  if (abs < DAY) return `${Math.round(abs / HOUR)}h`;
  const days = Math.floor(abs / DAY);
  const hours = Math.round((abs - days * DAY) / HOUR);
  return hours ? `${days}d ${hours}h` : `${days}d`;
}

export function relativeTime(iso: string, now = Date.now()): string {
  const diff = now - new Date(iso).getTime();
  if (diff < MINUTE) return 'just now';
  return `${humanizeDuration(diff)} ago`;
}

/** "Due in 5h" / "Overdue by 2h", for an SLA deadline. */
export function slaText(dueAt: string, now = Date.now()): string {
  const left = new Date(dueAt).getTime() - now;
  return left >= 0 ? `Due in ${humanizeDuration(left)}` : `Overdue by ${humanizeDuration(left)}`;
}

@Pipe({ name: 'ago' })
export class AgoPipe implements PipeTransform {
  transform(iso: string | null | undefined): string {
    return iso ? relativeTime(iso) : '';
  }
}

@Pipe({ name: 'sla' })
export class SlaPipe implements PipeTransform {
  transform(dueAt: string): string {
    return slaText(dueAt);
  }
}
