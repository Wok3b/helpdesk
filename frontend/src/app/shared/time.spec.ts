import { humanizeDuration, relativeTime, slaText } from './time';

const HOUR = 3_600_000;
const NOW = new Date('2026-10-07T12:00:00Z').getTime();

describe('time helpers', () => {
  it('formats short and long durations', () => {
    expect(humanizeDuration(30_000)).toBe('1m');
    expect(humanizeDuration(45 * 60_000)).toBe('45m');
    expect(humanizeDuration(5 * HOUR)).toBe('5h');
    expect(humanizeDuration(26 * HOUR)).toBe('1d 2h');
    expect(humanizeDuration(72 * HOUR)).toBe('3d');
  });

  it('describes how long ago something happened', () => {
    expect(relativeTime(new Date(NOW - 10_000).toISOString(), NOW)).toBe('just now');
    expect(relativeTime(new Date(NOW - 3 * HOUR).toISOString(), NOW)).toBe('3h ago');
  });

  it('shows time left before the SLA deadline, or how late the ticket is', () => {
    expect(slaText(new Date(NOW + 5 * HOUR).toISOString(), NOW)).toBe('Due in 5h');
    expect(slaText(new Date(NOW - 2 * HOUR).toISOString(), NOW)).toBe('Overdue by 2h');
  });
});
