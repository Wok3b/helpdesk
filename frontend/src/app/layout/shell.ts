import { NgTemplateOutlet } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { MenuItem } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { DrawerModule } from 'primeng/drawer';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { InputTextModule } from 'primeng/inputtext';
import { MenuModule } from 'primeng/menu';
import { TooltipModule } from 'primeng/tooltip';
import { AuthService } from '../core/auth.service';
import { ROLE } from '../core/labels';
import { ThemeService } from '../core/theme.service';
import { UserAvatar } from '../shared/badges';

interface NavItem {
  label: string;
  icon: string;
  link: string;
  exact?: boolean;
}

@Component({
  selector: 'app-shell',
  imports: [
    NgTemplateOutlet,
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    FormsModule,
    ButtonModule,
    DrawerModule,
    IconFieldModule,
    InputIconModule,
    InputTextModule,
    MenuModule,
    TooltipModule,
    UserAvatar,
  ],
  template: `
    <div class="flex min-h-screen">
      <!-- Sidebar (desktop) -->
      <aside class="hidden w-64 shrink-0 border-r border-[var(--app-border)] bg-[var(--app-sidebar)] lg:block">
        <div class="sticky top-0 flex h-screen flex-col">
          <ng-container *ngTemplateOutlet="nav" />
        </div>
      </aside>

      <!-- Sidebar (mobile) -->
      <p-drawer [(visible)]="mobileNav" [modal]="true" styleClass="!w-72" [showCloseIcon]="false">
        <ng-template #headless>
          <div class="flex h-full flex-col bg-[var(--app-sidebar)]">
            <ng-container *ngTemplateOutlet="nav" />
          </div>
        </ng-template>
      </p-drawer>

      <div class="flex min-w-0 flex-1 flex-col">
        <!-- Top bar -->
        <header
          class="sticky top-0 z-10 flex h-16 items-center gap-3 border-b border-[var(--app-border)] bg-[var(--app-bg)]/80 px-4 backdrop-blur md:px-8"
        >
          <p-button
            class="lg:hidden"
            icon="pi pi-bars"
            [text]="true"
            severity="secondary"
            ariaLabel="Open navigation"
            (onClick)="mobileNav.set(true)"
          />

          <p-iconfield class="w-full max-w-md">
            <p-inputicon class="pi pi-search" />
            <input
              pInputText
              class="w-full"
              type="search"
              placeholder="Search tickets or type HD-1042"
              [(ngModel)]="search"
              (keydown.enter)="runSearch()"
            />
          </p-iconfield>

          <div class="ml-auto flex items-center gap-1">
            <p-button
              [icon]="theme.dark() ? 'pi pi-sun' : 'pi pi-moon'"
              [text]="true"
              [rounded]="true"
              severity="secondary"
              [pTooltip]="theme.dark() ? 'Light mode' : 'Dark mode'"
              tooltipPosition="bottom"
              (onClick)="theme.toggle()"
            />
            <p-button label="New ticket" icon="pi pi-plus" routerLink="/tickets/new" class="hidden sm:block" />
            <p-button icon="pi pi-plus" routerLink="/tickets/new" class="sm:hidden" ariaLabel="New ticket" />
          </div>
        </header>

        <main class="mx-auto w-full max-w-7xl flex-1 px-4 py-6 md:px-8 md:py-8">
          <router-outlet />
        </main>
      </div>
    </div>

    <ng-template #nav>
      <div class="flex h-16 items-center gap-3 px-6">
        <span class="flex size-9 items-center justify-center rounded-xl bg-[var(--p-primary-600)] text-white">
          <i class="pi pi-headphones"></i>
        </span>
        <div class="leading-tight">
          <div class="font-semibold">HelpDesk</div>
          <div class="muted text-xs">IT support</div>
        </div>
      </div>

      <nav class="flex flex-1 flex-col gap-1 px-3 py-4">
        @for (item of navItems(); track item.link) {
          <a
            [routerLink]="item.link"
            routerLinkActive="!bg-[var(--p-primary-50)] !text-[var(--p-primary-700)] dark:!bg-[var(--p-primary-950)] dark:!text-[var(--p-primary-200)]"
            [routerLinkActiveOptions]="{ exact: item.exact ?? false }"
            (click)="mobileNav.set(false)"
            class="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-[var(--app-muted)] transition-colors hover:bg-[var(--p-surface-100)] hover:text-[var(--app-text)] dark:hover:bg-[var(--p-surface-800)]"
          >
            <i [class]="item.icon"></i>
            {{ item.label }}
          </a>
        }
      </nav>

      @if (auth.user(); as user) {
        <div class="border-t border-[var(--app-border)] p-3">
          <button
            type="button"
            class="flex w-full items-center gap-3 rounded-lg p-2 text-left hover:bg-[var(--p-surface-100)] dark:hover:bg-[var(--p-surface-800)]"
            (click)="userMenu.toggle($event)"
          >
            <app-avatar [name]="user.fullName" [size]="2.25" />
            <span class="min-w-0 flex-1">
              <span class="block truncate text-sm font-medium">{{ user.fullName }}</span>
              <span class="muted block text-xs">{{ roleLabel() }}</span>
            </span>
            <i class="pi pi-ellipsis-v muted text-sm"></i>
          </button>
          <p-menu #userMenu [model]="userMenuItems" [popup]="true" appendTo="body" />
        </div>
      }
    </ng-template>
  `,
})
export class Shell {
  protected readonly auth = inject(AuthService);
  protected readonly theme = inject(ThemeService);
  private readonly router = inject(Router);

  protected readonly mobileNav = signal(false);
  protected search = '';

  protected readonly roleLabel = computed(() => {
    const user = this.auth.user();
    const role = user ? ROLE[user.role].label : '';
    return user?.department ? `${role} · ${user.department}` : role;
  });

  protected readonly navItems = computed<NavItem[]>(() => {
    const items: NavItem[] = [];
    if (this.auth.isStaff()) items.push({ label: 'Dashboard', icon: 'pi pi-chart-bar', link: '/dashboard' });
    items.push({ label: this.auth.isStaff() ? 'Tickets' : 'My tickets', icon: 'pi pi-ticket', link: '/tickets', exact: true });
    items.push({ label: 'Report a problem', icon: 'pi pi-plus-circle', link: '/tickets/new' });
    items.push({ label: this.auth.isStaff() ? 'Equipment' : 'My equipment', icon: 'pi pi-desktop', link: '/assets' });
    if (this.auth.isAdmin()) items.push({ label: 'People', icon: 'pi pi-users', link: '/users' });
    return items;
  });

  protected readonly userMenuItems: MenuItem[] = [
    { label: 'Sign out', icon: 'pi pi-sign-out', command: () => this.auth.logout() },
  ];

  protected runSearch(): void {
    const term = this.search.trim();
    this.router.navigate(['/tickets'], { queryParams: { search: term || null } });
  }
}
