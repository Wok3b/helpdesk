import { Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { SelectButtonModule } from 'primeng/selectbutton';
import { TableLazyLoadEvent, TableModule } from 'primeng/table';
import { TooltipModule } from 'primeng/tooltip';
import { debounceTime, Subject } from 'rxjs';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { CATEGORY, CATEGORY_OPTIONS, PRIORITY_OPTIONS, STATUS_OPTIONS } from '../../core/labels';
import { TicketCategory, TicketListItem, TicketPriority, TicketQuery, TicketSort, TicketStatus } from '../../core/models';
import { PriorityLabel, SlaChip, StatusTag, UserAvatar } from '../../shared/badges';
import { AgoPipe } from '../../shared/time';

type View = 'open' | 'mine' | 'unassigned' | 'overdue' | 'all';

const SORT_FIELDS: Record<string, TicketSort> = {
  key: 'Number',
  priority: 'Priority',
  createdAt: 'CreatedAt',
  dueAt: 'DueAt',
};

@Component({
  selector: 'app-ticket-list',
  imports: [
    FormsModule,
    RouterLink,
    ButtonModule,
    IconFieldModule,
    InputIconModule,
    InputTextModule,
    SelectModule,
    SelectButtonModule,
    TableModule,
    TooltipModule,
    StatusTag,
    PriorityLabel,
    SlaChip,
    UserAvatar,
    AgoPipe,
  ],
  template: `
    <header class="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 class="text-2xl font-semibold">{{ auth.isStaff() ? 'Tickets' : 'My tickets' }}</h1>
        <p class="muted mt-1">
          {{ total() }} {{ total() === 1 ? 'ticket' : 'tickets' }}{{ hasFilters() ? ' match your filters' : '' }}
        </p>
      </div>
      <p-button label="Report a problem" icon="pi pi-plus" routerLink="/tickets/new" />
    </header>

    <div class="panel overflow-hidden">
      <!-- Toolbar -->
      <div class="flex flex-col gap-3 border-b border-[var(--app-border)] p-4">
        @if (auth.isStaff()) {
          <p-selectbutton
            [options]="views"
            [ngModel]="view()"
            (ngModelChange)="setView($event)"
            optionLabel="label"
            optionValue="value"
            [allowEmpty]="false"
            size="small"
            class="overflow-x-auto"
          />
        }
        <div class="flex flex-wrap items-center gap-2">
          <p-iconfield class="w-full sm:w-80">
            <p-inputicon class="pi pi-search" />
            <input
              pInputText
              type="search"
              class="w-full"
              placeholder="Search title or HD-number"
              [ngModel]="search()"
              (ngModelChange)="searchInput$.next($event)"
            />
          </p-iconfield>
          <p-select
            [options]="statusOptions"
            [ngModel]="status()"
            (ngModelChange)="status.set($event); reload()"
            optionLabel="label"
            optionValue="value"
            placeholder="Any status"
            [showClear]="true"
            class="w-full sm:w-44"
          />
          <p-select
            [options]="priorityOptions"
            [ngModel]="priority()"
            (ngModelChange)="priority.set($event); reload()"
            optionLabel="label"
            optionValue="value"
            placeholder="Any priority"
            [showClear]="true"
            class="w-full sm:w-40"
          />
          <p-select
            [options]="categoryOptions"
            [ngModel]="category()"
            (ngModelChange)="category.set($event); reload()"
            optionLabel="label"
            optionValue="value"
            placeholder="Any category"
            [showClear]="true"
            class="w-full sm:w-40"
          />
          @if (hasFilters()) {
            <p-button label="Clear" icon="pi pi-filter-slash" [text]="true" severity="secondary" (onClick)="clearFilters()" />
          }
        </div>
      </div>

      <p-table
        [value]="rows()"
        [lazy]="true"
        (onLazyLoad)="onLazyLoad($event)"
        [loading]="loading()"
        [paginator]="true"
        [rows]="pageSize"
        [first]="first()"
        [totalRecords]="total()"
        [rowsPerPageOptions]="[15, 30, 50]"
        [showCurrentPageReport]="true"
        currentPageReportTemplate="{first}–{last} of {totalRecords}"
        sortField="createdAt"
        [sortOrder]="-1"
        dataKey="id"
        [rowHover]="true"
        [tableStyle]="{ 'min-width': '56rem' }"
      >
        <ng-template #header>
          <tr>
            <th pSortableColumn="key" class="whitespace-nowrap">Ticket <p-sortIcon field="key" /></th>
            <th class="w-full min-w-[18rem]">Problem</th>
            <th class="whitespace-nowrap">Status</th>
            <th pSortableColumn="priority" class="whitespace-nowrap">Priority <p-sortIcon field="priority" /></th>
            <th class="whitespace-nowrap">{{ auth.isStaff() ? 'Assignee' : 'Handled by' }}</th>
            <th pSortableColumn="dueAt" class="whitespace-nowrap">SLA <p-sortIcon field="dueAt" /></th>
          </tr>
        </ng-template>
        <ng-template #body let-t>
          <tr class="clickable-row" (click)="open(t)">
            <td class="whitespace-nowrap"><span class="ticket-key">{{ t.key }}</span></td>
            <td>
              <div class="flex items-center gap-2">
                <i [class]="categoryIcon(t.category) + ' muted text-sm'" [pTooltip]="t.category" tooltipPosition="top"></i>
                <span class="font-medium">{{ t.title }}</span>
                @if (t.commentCount) {
                  <span class="muted inline-flex items-center gap-1 text-xs"><i class="pi pi-comment text-xs"></i>{{ t.commentCount }}</span>
                }
              </div>
              <div class="muted mt-0.5 text-xs">
                {{ auth.isStaff() ? 'Reported by ' + t.createdBy.fullName + ' · ' : 'Opened ' }}{{ t.createdAt | ago }}
              </div>
            </td>
            <td class="whitespace-nowrap"><app-status-tag [status]="t.status" /></td>
            <td class="whitespace-nowrap"><app-priority [priority]="t.priority" /></td>
            <td>
              @if (t.assignee) {
                <span class="flex items-center gap-2 text-sm whitespace-nowrap"><app-avatar [name]="t.assignee.fullName" [size]="1.6" />{{ t.assignee.fullName }}</span>
              } @else {
                <span class="muted text-sm">Unassigned</span>
              }
            </td>
            <td class="whitespace-nowrap"><app-sla [dueAt]="t.dueAt" [overdue]="t.isOverdue" [closed]="t.status === 'Resolved' || t.status === 'Closed'" /></td>
          </tr>
        </ng-template>
        <ng-template #emptymessage>
          <tr>
            <td colspan="6" class="py-16 text-center">
              <i class="pi pi-inbox muted mb-3 block text-3xl"></i>
              <div class="font-medium">No tickets here</div>
              <div class="muted mt-1 text-sm">
                {{ hasFilters() ? 'Try removing a filter.' : 'When something breaks, report it and it shows up here.' }}
              </div>
            </td>
          </tr>
        </ng-template>
      </p-table>
    </div>
  `,
})
export class TicketListPage {
  protected readonly auth = inject(AuthService);
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  protected readonly statusOptions = STATUS_OPTIONS;
  protected readonly priorityOptions = PRIORITY_OPTIONS;
  protected readonly categoryOptions = CATEGORY_OPTIONS;
  protected readonly views: { label: string; value: View }[] = [
    { label: 'Open', value: 'open' },
    { label: 'Assigned to me', value: 'mine' },
    { label: 'Unassigned', value: 'unassigned' },
    { label: 'Overdue', value: 'overdue' },
    { label: 'All', value: 'all' },
  ];

  protected readonly rows = signal<TicketListItem[]>([]);
  protected readonly total = signal(0);
  protected readonly loading = signal(true);
  protected readonly first = signal(0);
  protected pageSize = 15;
  private sort: TicketSort = 'CreatedAt';
  private dir: 'Asc' | 'Desc' = 'Desc';
  private tableReady = false;

  protected readonly view = signal<View>('open');
  protected readonly search = signal('');
  protected readonly status = signal<TicketStatus | null>(null);
  protected readonly priority = signal<TicketPriority | null>(null);
  protected readonly category = signal<TicketCategory | null>(null);
  protected readonly searchInput$ = new Subject<string>();

  protected readonly hasFilters = computed(
    () => !!this.search() || !!this.status() || !!this.priority() || !!this.category(),
  );

  constructor() {
    const destroyRef = inject(DestroyRef);

    // Links from the dashboard and the top search bar arrive as query parameters.
    this.route.queryParamMap.pipe(takeUntilDestroyed(destroyRef)).subscribe((params) => {
      this.search.set(params.get('search') ?? '');
      this.status.set((params.get('status') as TicketStatus) ?? null);
      this.view.set(
        params.get('overdue') ? 'overdue' : params.get('unassigned') ? 'unassigned' : params.get('status') || params.get('search') ? 'all' : this.auth.isStaff() ? 'open' : 'all',
      );
      // The table asks for its first page itself (onLazyLoad); after that, URL changes trigger a reload.
      if (this.tableReady) this.reload();
    });

    this.searchInput$.pipe(debounceTime(300), takeUntilDestroyed(destroyRef)).subscribe((term) => {
      this.search.set(term);
      this.reload();
    });
  }

  protected onLazyLoad(event: TableLazyLoadEvent): void {
    this.tableReady = true;
    this.first.set(event.first ?? 0);
    this.pageSize = event.rows ?? this.pageSize;
    const field = typeof event.sortField === 'string' ? event.sortField : 'createdAt';
    this.sort = SORT_FIELDS[field] ?? 'CreatedAt';
    this.dir = event.sortOrder === 1 ? 'Asc' : 'Desc';
    this.load();
  }

  protected setView(view: View): void {
    this.view.set(view);
    this.reload();
  }

  protected reload(): void {
    this.first.set(0);
    this.load();
  }

  protected clearFilters(): void {
    this.search.set('');
    this.status.set(null);
    this.priority.set(null);
    this.category.set(null);
    this.router.navigate([], { queryParams: {} });
    this.reload();
  }

  protected open(t: TicketListItem): void {
    this.router.navigate(['/tickets', t.id]);
  }

  protected categoryIcon(category: TicketCategory): string {
    return CATEGORY[category].icon;
  }

  private load(): void {
    this.loading.set(true);
    const view = this.view();
    const query: TicketQuery = {
      search: this.search() || null,
      status: this.status(),
      priority: this.priority(),
      category: this.category(),
      openOnly: view === 'open' || view === 'mine' || view === 'unassigned',
      overdue: view === 'overdue',
      unassigned: view === 'unassigned',
      assigneeId: view === 'mine' ? this.auth.user()?.id : null,
      sort: this.sort,
      dir: this.dir,
      page: Math.floor(this.first() / this.pageSize) + 1,
      pageSize: this.pageSize,
    };

    this.api.tickets(query).subscribe({
      next: (page) => {
        this.rows.set(page.items);
        this.total.set(page.totalCount);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }
}
