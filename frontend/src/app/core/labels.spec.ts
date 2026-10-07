import { CATEGORY_OPTIONS, PRIORITY, SLA_HOURS, STATUS_OPTIONS } from './labels';
import { TicketPriority } from './models';

describe('labels', () => {
  it('has an option for every ticket status and category', () => {
    expect(STATUS_OPTIONS.map((o) => o.value)).toEqual(['New', 'InProgress', 'WaitingOnUser', 'Resolved', 'Closed']);
    expect(CATEGORY_OPTIONS).toHaveLength(5);
  });

  it('gives higher priorities a higher rank and a shorter SLA, matching the API', () => {
    const priorities: TicketPriority[] = ['Low', 'Medium', 'High', 'Critical'];
    const ranks = priorities.map((p) => PRIORITY[p].rank);
    const hours = priorities.map((p) => SLA_HOURS[p]);

    expect(ranks).toEqual([...ranks].sort((a, b) => a - b));
    expect(hours).toEqual([120, 72, 24, 4]);
  });
});
