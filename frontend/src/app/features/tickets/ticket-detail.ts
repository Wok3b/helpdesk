import { DatePipe } from '@angular/common';
import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { ProgressBarModule } from 'primeng/progressbar';
import { SelectModule } from 'primeng/select';
import { SkeletonModule } from 'primeng/skeleton';
import { TagModule } from 'primeng/tag';
import { TextareaModule } from 'primeng/textarea';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { Observable } from 'rxjs';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { ASSET_TYPE, CATEGORY, PRIORITY_OPTIONS, STATUS } from '../../core/labels';
import { TicketDetails, TicketEvent, TicketPriority, TicketStatus, UserSummary } from '../../core/models';
import { PriorityLabel, SlaChip, StatusTag, UserAvatar } from '../../shared/badges';
import { AgoPipe } from '../../shared/time';

interface Action {
  to: TicketStatus;
  label: string;
  icon: string;
  primary: boolean;
}

@Component({
  selector: 'app-ticket-detail',
  imports: [
    DatePipe,
    FormsModule,
    RouterLink,
    ButtonModule,
    ProgressBarModule,
    SelectModule,
    SkeletonModule,
    TagModule,
    TextareaModule,
    ToggleSwitchModule,
    StatusTag,
    PriorityLabel,
    SlaChip,
    UserAvatar,
    AgoPipe,
  ],
  template: `
    @if (ticket(); as t) {
      <nav class="muted mb-4 flex items-center gap-2 text-sm">
        <a routerLink="/tickets" class="hover:text-[var(--app-text)]">Tickets</a>
        <i class="pi pi-angle-right text-xs"></i>
        <span class="ticket-key">{{ t.key }}</span>
      </nav>

      <!-- Header -->
      <header class="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div class="min-w-0">
          <div class="flex flex-wrap items-center gap-2">
            <app-status-tag [status]="t.status" />
            @if (t.isOverdue) {
              <p-tag severity="danger" value="Overdue" icon="pi pi-exclamation-circle" [rounded]="true" />
            }
          </div>
          <h1 class="mt-3 text-2xl font-semibold">{{ t.title }}</h1>
          <p class="muted mt-1 text-sm">
            Reported by {{ t.createdBy.fullName }} · {{ t.createdAt | ago }} ·
            <i [class]="categoryIcon() + ' text-xs'"></i> {{ t.category }}
          </p>
        </div>

        @if (actions().length) {
          <div class="flex flex-wrap gap-2">
            @for (a of actions(); track a.to) {
              <p-button
                [label]="a.label"
                [icon]="a.icon"
                [outlined]="!a.primary"
                [severity]="a.primary ? 'primary' : 'secondary'"
                [loading]="busy() === a.to"
                [disabled]="!!busy()"
                (onClick)="changeStatus(a.to)"
              />
            }
          </div>
        }
      </header>

      <div class="grid gap-6 xl:grid-cols-[1fr_22rem]">
        <!-- Left: description and conversation -->
        <div class="flex min-w-0 flex-col gap-6">
          <section class="panel p-6">
            <h2 class="muted mb-3 text-xs font-semibold tracking-wider uppercase">Description</h2>
            <p class="leading-relaxed whitespace-pre-line">{{ t.description }}</p>
          </section>

          <section class="panel">
            <h2 class="flex items-center gap-2 border-b border-[var(--app-border)] px-6 py-4 font-semibold">
              Conversation <span class="muted text-sm font-normal">{{ t.comments.length }}</span>
            </h2>

            <ol class="flex flex-col gap-5 p-6">
              @for (c of t.comments; track c.id) {
                <li class="flex gap-3">
                  <app-avatar [name]="c.author.fullName" [size]="2.25" />
                  <div
                    class="min-w-0 flex-1 rounded-xl px-4 py-3"
                    [class]="
                      c.isInternal
                        ? 'border border-dashed border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/40'
                        : 'bg-[var(--p-surface-100)] dark:bg-[var(--p-surface-800)]'
                    "
                  >
                    <div class="flex flex-wrap items-baseline gap-x-2 text-sm">
                      <span class="font-semibold">{{ c.author.fullName }}</span>
                      @if (c.isInternal) {
                        <span class="inline-flex items-center gap-1 text-xs font-medium text-amber-700 dark:text-amber-300">
                          <i class="pi pi-lock text-[0.65rem]"></i>Internal note
                        </span>
                      }
                      <span class="muted text-xs">{{ c.createdAt | ago }}</span>
                    </div>
                    <p class="mt-1 text-sm leading-relaxed whitespace-pre-line">{{ c.body }}</p>
                  </div>
                </li>
              } @empty {
                <li class="muted py-4 text-center text-sm">No messages yet.</li>
              }
            </ol>

            @if (t.status !== 'Closed') {
              <form class="border-t border-[var(--app-border)] p-6" (ngSubmit)="sendComment()">
                <textarea
                  pTextarea
                  [autoResize]="true"
                  rows="3"
                  class="w-full"
                  name="reply"
                  [placeholder]="internal() ? 'Note for the help desk team only…' : 'Write a reply…'"
                  [(ngModel)]="reply"
                ></textarea>
                <div class="mt-3 flex flex-wrap items-center justify-between gap-3">
                  @if (auth.isStaff()) {
                    <label class="flex cursor-pointer items-center gap-2 text-sm">
                      <p-toggleswitch name="internal" [ngModel]="internal()" (ngModelChange)="internal.set($event)" />
                      Internal note
                    </label>
                  } @else {
                    <span></span>
                  }
                  <p-button
                    type="submit"
                    [label]="internal() ? 'Add note' : 'Send reply'"
                    icon="pi pi-send"
                    [loading]="sending()"
                    [disabled]="!reply.trim()"
                  />
                </div>
              </form>
            } @else {
              <p class="muted border-t border-[var(--app-border)] p-6 text-center text-sm">
                <i class="pi pi-lock mr-1"></i>This ticket is closed.
              </p>
            }
          </section>
        </div>

        <!-- Right: details and activity -->
        <aside class="flex flex-col gap-6">
          <section class="panel p-6">
            <h2 class="muted mb-4 text-xs font-semibold tracking-wider uppercase">Details</h2>
            <dl class="grid grid-cols-[6.5rem_1fr] items-center gap-x-3 gap-y-4 text-sm">
              <dt class="muted">Priority</dt>
              <dd>
                @if (auth.isStaff() && isOpen()) {
                  <p-select
                    [options]="priorityOptions"
                    [ngModel]="t.priority"
                    (ngModelChange)="changePriority($event)"
                    optionLabel="label"
                    optionValue="value"
                    size="small"
                    class="w-full"
                  />
                } @else {
                  <app-priority [priority]="t.priority" />
                }
              </dd>

              <dt class="muted">Assignee</dt>
              <dd>
                @if (auth.isStaff() && isOpen()) {
                  <p-select
                    [options]="assignable()"
                    [ngModel]="t.assignee?.id ?? null"
                    (ngModelChange)="assign($event)"
                    optionLabel="fullName"
                    optionValue="id"
                    placeholder="Unassigned"
                    [showClear]="true"
                    size="small"
                    class="w-full"
                  />
                  @if (t.assignee?.id !== auth.user()?.id) {
                    <button type="button" class="mt-1 text-xs font-medium text-[var(--p-primary-600)]" (click)="assign(auth.user()!.id)">
                      Assign to me
                    </button>
                  }
                } @else if (t.assignee) {
                  <span class="flex items-center gap-2"><app-avatar [name]="t.assignee.fullName" [size]="1.5" />{{ t.assignee.fullName }}</span>
                } @else {
                  <span class="muted">Not assigned yet</span>
                }
              </dd>

              <dt class="muted">Reporter</dt>
              <dd class="flex items-center gap-2"><app-avatar [name]="t.createdBy.fullName" [size]="1.5" />{{ t.createdBy.fullName }}</dd>

              <dt class="muted">Equipment</dt>
              <dd>
                @if (t.asset) {
                  <span class="flex items-center gap-2">
                    <i [class]="assetIcon() + ' muted'"></i>
                    <span><span class="font-medium">{{ t.asset.tag }}</span> · {{ t.asset.name }}</span>
                  </span>
                } @else {
                  <span class="muted">None</span>
                }
              </dd>

              <dt class="muted">Opened</dt>
              <dd>{{ t.createdAt | date: 'd MMM y, HH:mm' }}</dd>

              @if (t.resolvedAt) {
                <dt class="muted">Resolved</dt>
                <dd>{{ t.resolvedAt | date: 'd MMM y, HH:mm' }}</dd>
              }
            </dl>

            <div class="mt-6 border-t border-[var(--app-border)] pt-5">
              <div class="mb-2 flex items-baseline justify-between text-sm">
                <span class="font-medium">SLA</span>
                <app-sla [dueAt]="t.dueAt" [overdue]="t.isOverdue" [closed]="!isOpen()" />
              </div>
              <p-progressbar
                [value]="slaProgress()"
                [showValue]="false"
                class="block h-2"
                [class.sla-overdue]="t.isOverdue"
              />
              <div class="muted mt-2 text-xs">Due {{ t.dueAt | date: 'd MMM, HH:mm' }}</div>
            </div>
          </section>

          <section class="panel p-6">
            <h2 class="muted mb-4 text-xs font-semibold tracking-wider uppercase">Activity</h2>
            <ol class="relative ml-3 border-l border-[var(--app-border)]">
              @for (e of activity(); track e.id) {
                <li class="mb-5 ml-5 last:mb-0">
                  <span
                    class="absolute -left-3 flex size-6 items-center justify-center rounded-full border border-[var(--app-border)] bg-[var(--app-panel)]"
                  >
                    <i [class]="eventIcon(e) + ' text-[0.7rem] muted'"></i>
                  </span>
                  <p class="text-sm leading-snug">
                    <span class="font-medium">{{ e.actor.fullName }}</span> {{ describe(e) }}
                  </p>
                  <p class="muted mt-0.5 text-xs">{{ e.createdAt | ago }}</p>
                </li>
              }
            </ol>
          </section>
        </aside>
      </div>
    } @else if (notFound()) {
      <div class="panel mx-auto max-w-md p-10 text-center">
        <i class="pi pi-search muted mb-3 block text-3xl"></i>
        <h1 class="text-lg font-semibold">Ticket not found</h1>
        <p class="muted mt-1 text-sm">It doesn't exist, or it isn't one of yours.</p>
        <p-button label="Back to tickets" routerLink="/tickets" class="mt-6 inline-block" [outlined]="true" />
      </div>
    } @else {
      <div class="space-y-4">
        <p-skeleton width="8rem" />
        <p-skeleton width="60%" height="2rem" />
        <div class="grid gap-6 xl:grid-cols-[1fr_22rem]">
          <p-skeleton height="24rem" />
          <p-skeleton height="24rem" />
        </div>
      </div>
    }
  `,
  styles: `
    :host ::ng-deep .sla-overdue .p-progressbar-value {
      background: var(--p-red-500);
    }
  `,
})
export class TicketDetailPage {
  /** Route parameter, bound by withComponentInputBinding(). */
  readonly id = input.required<string>();

  protected readonly auth = inject(AuthService);
  private readonly api = inject(ApiService);
  private readonly messages = inject(MessageService);

  protected readonly priorityOptions = PRIORITY_OPTIONS;
  protected readonly ticket = signal<TicketDetails | null>(null);
  protected readonly notFound = signal(false);
  protected readonly assignable = signal<UserSummary[]>([]);
  protected readonly busy = signal<TicketStatus | null>(null);
  protected readonly sending = signal(false);
  protected readonly internal = signal(false);
  protected reply = '';

  constructor() {
    effect(() => this.load(Number(this.id())));
    if (this.auth.isStaff()) this.api.assignableUsers().subscribe((u) => this.assignable.set(u));
  }

  protected readonly isOpen = computed(() => {
    const s = this.ticket()?.status;
    return s !== 'Resolved' && s !== 'Closed';
  });

  protected readonly categoryIcon = computed(() => (this.ticket() ? CATEGORY[this.ticket()!.category].icon : ''));
  protected readonly assetIcon = computed(() => (this.ticket()?.asset ? ASSET_TYPE[this.ticket()!.asset!.type].icon : ''));

  // Newest first in the sidebar.
  protected readonly activity = computed(() => [...(this.ticket()?.events ?? [])].reverse());

  protected readonly slaProgress = computed(() => {
    const t = this.ticket();
    if (!t) return 0;
    const start = new Date(t.createdAt).getTime();
    const end = new Date(t.dueAt).getTime();
    const now = t.resolvedAt ? new Date(t.resolvedAt).getTime() : Date.now();
    return Math.min(100, Math.max(0, Math.round(((now - start) / (end - start)) * 100)));
  });

  // Turns the allowed transitions from the API into buttons with wording that fits who is looking.
  protected readonly actions = computed<Action[]>(() => {
    const t = this.ticket();
    if (!t) return [];
    const reporter = !this.auth.isStaff();
    return t.allowedTransitions.map((to) => {
      if (reporter && to === 'Closed') return { to, label: 'Yes, it’s fixed', icon: 'pi pi-check', primary: true };
      if (reporter && to === 'InProgress') return { to, label: 'Still broken', icon: 'pi pi-replay', primary: false };
      switch (to) {
        case 'InProgress':
          return t.status === 'New'
            ? { to, label: 'Start work', icon: 'pi pi-play', primary: true }
            : { to, label: t.status === 'WaitingOnUser' ? 'Resume' : 'Reopen', icon: 'pi pi-replay', primary: false };
        case 'WaitingOnUser':
          return { to, label: 'Wait for reporter', icon: 'pi pi-clock', primary: false };
        case 'Resolved':
          return { to, label: 'Mark resolved', icon: 'pi pi-check', primary: true };
        case 'Closed':
          return { to, label: 'Close', icon: 'pi pi-lock', primary: false };
        default:
          return { to, label: STATUS[to].label, icon: STATUS[to].icon, primary: false };
      }
    });
  });

  protected changeStatus(to: TicketStatus): void {
    const t = this.ticket()!;
    this.busy.set(to);
    this.update(this.api.changeStatus(t.id, to), `Status changed to ${STATUS[to].label.toLowerCase()}.`);
  }

  protected changePriority(priority: TicketPriority): void {
    const t = this.ticket()!;
    if (priority === t.priority) return;
    this.update(this.api.changePriority(t.id, priority), 'Priority updated. The SLA deadline was recalculated.');
  }

  protected assign(assigneeId: number | null): void {
    const t = this.ticket()!;
    if ((t.assignee?.id ?? null) === assigneeId) return;
    this.update(this.api.assign(t.id, assigneeId), assigneeId ? 'Ticket assigned.' : 'Ticket unassigned.');
  }

  protected sendComment(): void {
    const t = this.ticket()!;
    const body = this.reply.trim();
    if (!body) return;
    this.sending.set(true);
    this.api.addComment(t.id, body, this.internal()).subscribe({
      next: () => {
        this.reply = '';
        this.internal.set(false);
        this.sending.set(false);
        this.load(t.id);
      },
      error: () => this.sending.set(false),
    });
  }

  protected eventIcon(e: TicketEvent): string {
    switch (e.type) {
      case 'Created':
        return 'pi pi-plus';
      case 'Assigned':
        return 'pi pi-user';
      case 'PriorityChanged':
        return 'pi pi-flag';
      case 'Commented':
        return 'pi pi-comment';
      default:
        return 'pi pi-sync';
    }
  }

  protected describe(e: TicketEvent): string {
    const status = (s: string | null) => (s ? (STATUS[s as TicketStatus]?.label ?? s).toLowerCase() : '');
    switch (e.type) {
      case 'Created':
        return `opened the ticket (${(e.toValue ?? '').toLowerCase()} priority)`;
      case 'StatusChanged':
        return `moved it from ${status(e.fromValue)} to ${status(e.toValue)}`;
      case 'Assigned':
        if (!e.toValue) return 'removed the assignee';
        return e.toValue === e.actor.fullName ? 'took the ticket' : `assigned it to ${e.toValue}`;
      case 'PriorityChanged':
        return `changed priority from ${e.fromValue?.toLowerCase()} to ${e.toValue?.toLowerCase()}`;
      case 'Commented':
        return 'commented';
    }
  }

  private load(id: number): void {
    this.api.ticket(id).subscribe({
      next: (t) => this.ticket.set(t),
      error: (err) => {
        if (err.status === 404) this.notFound.set(true);
      },
    });
  }

  private update(request: Observable<TicketDetails>, success: string): void {
    request.subscribe({
      next: (t) => {
        this.ticket.set(t);
        this.busy.set(null);
        this.messages.add({ severity: 'success', summary: success, life: 3000 });
      },
      error: () => {
        this.busy.set(null);
        this.load(this.ticket()!.id);
      },
    });
  }
}
