import { inject } from '@angular/core';
import { Routes } from '@angular/router';
import { AuthService } from './core/auth.service';
import { adminGuard, authGuard, guestGuard, staffGuard } from './core/guards';

export const routes: Routes = [
  {
    path: 'login',
    canActivate: [guestGuard],
    title: 'Sign in · HelpDesk',
    loadComponent: () => import('./features/login/login').then((m) => m.LoginPage),
  },
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () => import('./layout/shell').then((m) => m.Shell),
    children: [
      { path: '', pathMatch: 'full', redirectTo: () => (inject(AuthService).isStaff() ? 'dashboard' : 'tickets') },
      {
        path: 'dashboard',
        canActivate: [staffGuard],
        title: 'Dashboard · HelpDesk',
        loadComponent: () => import('./features/dashboard/dashboard').then((m) => m.DashboardPage),
      },
      {
        path: 'tickets',
        title: 'Tickets · HelpDesk',
        loadComponent: () => import('./features/tickets/ticket-list').then((m) => m.TicketListPage),
      },
      {
        path: 'tickets/new',
        title: 'New ticket · HelpDesk',
        loadComponent: () => import('./features/tickets/ticket-new').then((m) => m.TicketNewPage),
      },
      {
        path: 'tickets/:id',
        title: 'Ticket · HelpDesk',
        loadComponent: () => import('./features/tickets/ticket-detail').then((m) => m.TicketDetailPage),
      },
      {
        path: 'assets',
        title: 'Equipment · HelpDesk',
        loadComponent: () => import('./features/assets/asset-list').then((m) => m.AssetListPage),
      },
      {
        path: 'users',
        canActivate: [adminGuard],
        title: 'People · HelpDesk',
        loadComponent: () => import('./features/users/user-list').then((m) => m.UserListPage),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
