import { DecimalPipe } from '@angular/common';
import { Component, computed, effect, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { ChartData, ChartOptions } from 'chart.js';
import { ChartModule } from 'primeng/chart';
import { ProgressBarModule } from 'primeng/progressbar';
import { SkeletonModule } from 'primeng/skeleton';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { CATEGORY, PRIORITY } from '../../core/labels';
import { Dashboard, TicketCategory, TicketListItem, TicketPriority } from '../../core/models';
import { ThemeService } from '../../core/theme.service';
import { PriorityLabel, SlaChip, UserAvatar } from '../../shared/badges';

interface Kpi {
  label: string;
  value: number | string;
  hint: string;
  icon: string;
  tone: 'primary' | 'danger' | 'warn' | 'success';
  link: string;
  query: Record<string, string>;
}

interface ChartConfig {
  data: ChartData;
  options: ChartOptions;
}

const TONES: Record<Kpi['tone'], string> = {
  primary: 'bg-indigo-50 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-300',
  danger: 'bg-red-50 text-red-600 dark:bg-red-950 dark:text-red-300',
  warn: 'bg-amber-50 text-amber-600 dark:bg-amber-950 dark:text-amber-300',
  success: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-300',
};

@Component({
  selector: 'app-dashboard',
  imports: [ChartModule, ProgressBarModule, SkeletonModule, RouterLink, DecimalPipe, PriorityLabel, SlaChip, UserAvatar],
  template: `
    <header class="mb-8">
      <h1 class="text-2xl font-semibold">{{ greeting() }}</h1>
      <p class="muted mt-1">Here's what the help desk looks like right now.</p>
    </header>

    <!-- KPIs -->
    <section class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      @if (data(); as d) {
        @for (kpi of kpis(); track kpi.label) {
          <a [routerLink]="kpi.link" [queryParams]="kpi.query" class="panel group p-5 transition-shadow hover:shadow-md">
            <div class="flex items-start justify-between">
              <span class="muted text-sm font-medium">{{ kpi.label }}</span>
              <span class="flex size-9 items-center justify-center rounded-lg" [class]="tone(kpi.tone)">
                <i [class]="kpi.icon"></i>
              </span>
            </div>
            <div class="mt-3 text-3xl font-semibold tabular-nums">{{ kpi.value }}</div>
            <div class="muted mt-1 text-xs">{{ kpi.hint }}</div>
          </a>
        }
      } @else {
        @for (i of [1, 2, 3, 4]; track i) {
          <div class="panel p-5"><p-skeleton height="6rem" /></div>
        }
      }
    </section>

    <!-- Charts -->
    <section class="mt-6 grid gap-4 xl:grid-cols-3">
      <div class="panel p-5 xl:col-span-2">
        <div class="flex items-baseline justify-between">
          <h2 class="font-semibold">Created vs. resolved</h2>
          <span class="muted text-xs">Last 14 days</span>
        </div>
        <div class="mt-4 h-72">
          @if (trendChart(); as chart) {
            <p-chart type="line" [data]="chart.data" [options]="chart.options" height="100%" />
          } @else {
            <p-skeleton height="100%" />
          }
        </div>
      </div>

      <div class="panel p-5">
        <h2 class="font-semibold">By category</h2>
        <div class="mt-4 h-72">
          @if (categoryChart(); as chart) {
            <p-chart type="doughnut" [data]="chart.data" [options]="chart.options" height="100%" />
          } @else {
            <p-skeleton height="100%" />
          }
        </div>
      </div>
    </section>

    <section class="mt-6 grid gap-4 xl:grid-cols-2">
      <!-- Needs attention -->
      <div class="panel">
        <div class="flex items-center justify-between p-5 pb-3">
          <h2 class="font-semibold">Needs attention</h2>
          <a routerLink="/tickets" [queryParams]="{ overdue: true }" class="text-sm font-medium text-[var(--p-primary-600)]"
            >All overdue</a
          >
        </div>
        @if (urgent(); as list) {
          @if (list.length) {
            <ul>
              @for (t of list; track t.id) {
                <li>
                  <a
                    [routerLink]="['/tickets', t.id]"
                    class="flex items-center gap-4 border-t border-[var(--app-border)] px-5 py-3 hover:bg-[var(--p-surface-50)] dark:hover:bg-[var(--p-surface-800)]"
                  >
                    <span class="ticket-key w-20 shrink-0 text-sm">{{ t.key }}</span>
                    <span class="min-w-0 flex-1">
                      <span class="block truncate text-sm font-medium">{{ t.title }}</span>
                      <span class="muted block text-xs">{{ t.assignee?.fullName ?? 'Unassigned' }}</span>
                    </span>
                    <app-priority [priority]="t.priority" class="hidden sm:block" />
                    <app-sla [dueAt]="t.dueAt" [overdue]="t.isOverdue" />
                  </a>
                </li>
              }
            </ul>
          } @else {
            <p class="muted border-t border-[var(--app-border)] px-5 py-10 text-center text-sm">
              <i class="pi pi-check-circle mb-2 block text-2xl text-emerald-500"></i>
              Nothing is overdue. Nice work.
            </p>
          }
        } @else {
          <div class="space-y-3 p-5"><p-skeleton height="2.5rem" /><p-skeleton height="2.5rem" /><p-skeleton height="2.5rem" /></div>
        }
      </div>

      <!-- Workload -->
      <div class="panel p-5">
        <div class="flex items-baseline justify-between">
          <h2 class="font-semibold">Team workload</h2>
          <span class="muted text-xs">Open tickets per person</span>
        </div>
        <ul class="mt-4 space-y-4">
          @for (w of data()?.workload ?? []; track w.userId) {
            <li class="flex items-center gap-3">
              <app-avatar [name]="w.fullName" [size]="2" />
              <div class="min-w-0 flex-1">
                <div class="flex items-baseline justify-between text-sm">
                  <span class="truncate font-medium">{{ w.fullName }}</span>
                  <span class="muted tabular-nums">
                    {{ w.openAssigned }} open
                    @if (w.overdueAssigned) {
                      <span class="text-red-600 dark:text-red-400">· {{ w.overdueAssigned }} overdue</span>
                    }
                  </span>
                </div>
                <p-progressbar [value]="workloadPercent(w.openAssigned)" [showValue]="false" class="mt-2 block h-1.5" />
              </div>
            </li>
          }
        </ul>
        @if (data(); as d) {
          <div class="mt-6 grid grid-cols-2 gap-4 border-t border-[var(--app-border)] pt-4 text-sm">
            <div>
              <div class="muted text-xs">Avg. time to resolve</div>
              <div class="mt-1 font-semibold">{{ d.avgResolutionHours ?? 0 | number: '1.0-1' }} h</div>
            </div>
            <div>
              <div class="muted text-xs">All tickets by priority</div>
              <div class="mt-1 flex flex-wrap gap-x-3 gap-y-1">
                @for (p of priorityCounts(); track p.key) {
                  <span class="inline-flex items-center gap-1.5"
                    ><span class="size-2 rounded-full" [class]="p.dot"></span>{{ p.count }}</span
                  >
                }
              </div>
            </div>
          </div>
        }
      </div>
    </section>
  `,
})
export class DashboardPage {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);
  private readonly theme = inject(ThemeService);

  protected readonly data = signal<Dashboard | null>(null);
  protected readonly urgent = signal<TicketListItem[] | null>(null);

  constructor() {
    this.api.dashboard().subscribe((d) => this.data.set(d));
    this.api
      .tickets({ overdue: true, sort: 'DueAt', dir: 'Asc', pageSize: 6 })
      .subscribe((page) => this.urgent.set(page.items));

    // Chart.js draws on a canvas, so it needs real colours: re-read the CSS variables when the theme changes.
    effect(() => {
      this.theme.dark();
      queueMicrotask(() => this.palette.set(readPalette()));
    });
  }

  private readonly palette = signal(readPalette());

  protected readonly greeting = computed(() => {
    const hour = new Date().getHours();
    const first = this.auth.user()?.fullName.split(' ')[0] ?? '';
    const part = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
    return `${part}, ${first}`;
  });

  protected readonly kpis = computed<Kpi[]>(() => {
    const d = this.data();
    if (!d) return [];
    const list: Kpi[] = [
      { label: 'Open tickets', value: d.openTickets, hint: 'New, in progress or waiting', icon: 'pi pi-inbox', tone: 'primary', link: '/tickets', query: { openOnly: 'true' } },
      { label: 'Overdue', value: d.overdueTickets, hint: 'Past their SLA deadline', icon: 'pi pi-exclamation-triangle', tone: 'danger', link: '/tickets', query: { overdue: 'true' } },
      { label: 'Unassigned', value: d.unassignedTickets, hint: 'Waiting for a technician', icon: 'pi pi-user-plus', tone: 'warn', link: '/tickets', query: { unassigned: 'true' } },
      { label: 'Resolved this week', value: d.resolvedLast7Days, hint: 'In the last 7 days', icon: 'pi pi-check-circle', tone: 'success', link: '/tickets', query: { status: 'Resolved' } },
    ];
    return list;
  });

  protected readonly trendChart = computed<ChartConfig | null>(() => {
    const d = this.data();
    if (!d) return null;
    const c = this.palette();
    const labels = d.daily.map((x) => new Date(x.day).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }));
    return {
      data: {
        labels,
        datasets: [
          { label: 'Created', data: d.daily.map((x) => x.created), borderColor: c.primary, backgroundColor: c.primaryFill, fill: true, tension: 0.35, pointRadius: 0, pointHoverRadius: 4 },
          { label: 'Resolved', data: d.daily.map((x) => x.resolved), borderColor: c.success, backgroundColor: 'transparent', tension: 0.35, pointRadius: 0, pointHoverRadius: 4, borderDash: [5, 4] },
        ],
      },
      options: {
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: { legend: { position: 'bottom', labels: { color: c.text, usePointStyle: true, boxHeight: 6 } } },
        scales: {
          x: { ticks: { color: c.muted, maxRotation: 0, autoSkipPadding: 12 }, grid: { display: false } },
          y: { beginAtZero: true, ticks: { color: c.muted, precision: 0 }, grid: { color: c.grid } },
        },
      },
    };
  });

  protected readonly categoryChart = computed<ChartConfig | null>(() => {
    const d = this.data();
    if (!d) return null;
    const c = this.palette();
    return {
      data: {
        labels: d.byCategory.map((x) => CATEGORY[x.key as TicketCategory]?.label ?? x.key),
        datasets: [{ data: d.byCategory.map((x) => x.count), backgroundColor: c.series, borderColor: c.panel, borderWidth: 2 }],
      },
      options: {
        maintainAspectRatio: false,
        cutout: '68%',
        plugins: { legend: { position: 'bottom', labels: { color: c.text, usePointStyle: true, boxHeight: 6 } } },
      },
    };
  });

  protected readonly priorityCounts = computed(() =>
    (this.data()?.byPriority ?? [])
      .map((p) => ({ key: p.key, count: p.count, dot: PRIORITY[p.key as TicketPriority]?.dot ?? '', rank: PRIORITY[p.key as TicketPriority]?.rank ?? 0 }))
      .sort((a, b) => b.rank - a.rank),
  );

  protected tone(t: Kpi['tone']): string {
    return TONES[t];
  }

  protected workloadPercent(open: number): number {
    const max = Math.max(1, ...(this.data()?.workload.map((w) => w.openAssigned) ?? [1]));
    return Math.round((open / max) * 100);
  }
}

function readPalette() {
  const css = getComputedStyle(document.documentElement);
  const v = (name: string) => css.getPropertyValue(name).trim();
  return {
    primary: v('--p-primary-500'),
    primaryFill: v('--p-primary-500') + '1f',
    success: '#10b981',
    text: v('--app-text'),
    muted: v('--app-muted'),
    grid: v('--app-border'),
    panel: v('--app-panel'),
    series: [v('--p-primary-500'), '#0ea5e9', '#14b8a6', '#f59e0b', '#a855f7'],
  };
}
