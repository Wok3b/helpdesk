import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import {
  Asset,
  AssetQuery,
  Comment,
  CreateTicketRequest,
  Dashboard,
  PagedResult,
  SaveAssetRequest,
  TicketDetails,
  TicketListItem,
  TicketPriority,
  TicketQuery,
  TicketStatus,
  User,
  UserRole,
  UserSummary,
} from './models';

// One place for every HTTP call the UI makes.
@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);

  // ---- Tickets ----
  tickets(query: TicketQuery): Observable<PagedResult<TicketListItem>> {
    return this.http.get<PagedResult<TicketListItem>>('/api/tickets', { params: toParams(query) });
  }

  ticket(id: number): Observable<TicketDetails> {
    return this.http.get<TicketDetails>(`/api/tickets/${id}`);
  }

  createTicket(body: CreateTicketRequest): Observable<TicketDetails> {
    return this.http.post<TicketDetails>('/api/tickets', body);
  }

  changeStatus(id: number, status: TicketStatus): Observable<TicketDetails> {
    return this.http.patch<TicketDetails>(`/api/tickets/${id}/status`, { status });
  }

  assign(id: number, assigneeId: number | null): Observable<TicketDetails> {
    return this.http.patch<TicketDetails>(`/api/tickets/${id}/assignee`, { assigneeId });
  }

  changePriority(id: number, priority: TicketPriority): Observable<TicketDetails> {
    return this.http.patch<TicketDetails>(`/api/tickets/${id}/priority`, { priority });
  }

  addComment(id: number, body: string, isInternal: boolean): Observable<Comment> {
    return this.http.post<Comment>(`/api/tickets/${id}/comments`, { body, isInternal });
  }

  // ---- Assets ----
  assets(query: AssetQuery): Observable<PagedResult<Asset>> {
    return this.http.get<PagedResult<Asset>>('/api/assets', { params: toParams(query) });
  }

  createAsset(body: SaveAssetRequest): Observable<Asset> {
    return this.http.post<Asset>('/api/assets', body);
  }

  updateAsset(id: number, body: SaveAssetRequest): Observable<Asset> {
    return this.http.put<Asset>(`/api/assets/${id}`, body);
  }

  deleteAsset(id: number): Observable<void> {
    return this.http.delete<void>(`/api/assets/${id}`);
  }

  // ---- Users ----
  users(role?: UserRole): Observable<User[]> {
    return this.http.get<User[]>('/api/users', { params: toParams({ role }) });
  }

  assignableUsers(): Observable<UserSummary[]> {
    return this.http.get<UserSummary[]>('/api/users/assignable');
  }

  createUser(body: { fullName: string; email: string; password: string; role: UserRole; department: string | null }): Observable<User> {
    return this.http.post<User>('/api/users', body);
  }

  updateUser(id: number, body: { fullName: string; role: UserRole; department: string | null; isActive: boolean }): Observable<User> {
    return this.http.put<User>(`/api/users/${id}`, body);
  }

  // ---- Dashboard ----
  dashboard(): Observable<Dashboard> {
    return this.http.get<Dashboard>('/api/dashboard');
  }
}

// Drops empty values so the query string only carries real filters.
function toParams(query: object): HttpParams {
  let params = new HttpParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== null && value !== undefined && value !== '' && value !== false) {
      params = params.set(key, String(value));
    }
  }
  return params;
}
