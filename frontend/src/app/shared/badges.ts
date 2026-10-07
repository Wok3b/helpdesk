import { Component, computed, input } from '@angular/core';
import { TagModule } from 'primeng/tag';
import { PRIORITY, STATUS } from '../core/labels';
import { TicketPriority, TicketStatus } from '../core/models';
import { slaText } from './time';

@Component({
  selector: 'app-status-tag',
  imports: [TagModule],
  template: `<p-tag [value]="meta().label" [severity]="meta().severity" [rounded]="true" class="whitespace-nowrap" />`,
})
export class StatusTag {
  readonly status = input.required<TicketStatus>();
  protected readonly meta = computed(() => STATUS[this.status()]);
}

@Component({
  selector: 'app-priority',
  template: `
    <span class="inline-flex items-center gap-2 text-sm font-medium">
      <span class="size-2 rounded-full" [class]="meta().dot"></span>
      {{ meta().label }}
    </span>
  `,
})
export class PriorityLabel {
  readonly priority = input.required<TicketPriority>();
  protected readonly meta = computed(() => PRIORITY[this.priority()]);
}

const AVATAR_COLORS = ['#6366f1', '#0ea5e9', '#14b8a6', '#f59e0b', '#ec4899', '#8b5cf6', '#22c55e', '#ef4444'];

@Component({
  selector: 'app-avatar',
  template: `
    <span
      class="inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white"
      [style.background]="color()"
      [style.width.rem]="size()"
      [style.height.rem]="size()"
      [style.font-size.rem]="size() * 0.38"
      [attr.title]="name()"
      >{{ initials() }}</span
    >
  `,
})
export class UserAvatar {
  readonly name = input.required<string>();
  readonly size = input(2);

  protected readonly initials = computed(() =>
    this.name()
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]!.toUpperCase())
      .join(''),
  );

  // The same person always gets the same colour.
  protected readonly color = computed(() => {
    let hash = 0;
    for (const ch of this.name()) hash = (hash * 31 + ch.charCodeAt(0)) | 0;
    return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
  });
}

@Component({
  selector: 'app-sla',
  template: `
    @if (closed()) {
      <span class="muted text-sm">Done</span>
    } @else {
      <span
        class="inline-flex items-center gap-1.5 text-sm font-medium"
        [class.text-red-600]="overdue()"
        [class.dark:text-red-400]="overdue()"
      >
        <i class="pi text-xs" [class.pi-exclamation-circle]="overdue()" [class.pi-clock]="!overdue()"></i>
        {{ text() }}
      </span>
    }
  `,
})
export class SlaChip {
  readonly dueAt = input.required<string>();
  readonly overdue = input(false);
  readonly closed = input(false);
  protected readonly text = computed(() => slaText(this.dueAt()));
}
