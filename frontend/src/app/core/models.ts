// Mirrors the API contracts in backend/src/HelpDesk.Api/Contracts.

export type UserRole = 'Employee' | 'Technician' | 'Admin';
export type TicketStatus = 'New' | 'InProgress' | 'WaitingOnUser' | 'Resolved' | 'Closed';
export type TicketPriority = 'Low' | 'Medium' | 'High' | 'Critical';
export type TicketCategory = 'Hardware' | 'Software' | 'Network' | 'Access' | 'Other';
export type TicketEventType = 'Created' | 'StatusChanged' | 'Assigned' | 'PriorityChanged' | 'Commented';
export type AssetType = 'Laptop' | 'Desktop' | 'Monitor' | 'Printer' | 'Phone' | 'NetworkDevice' | 'Other';
export type AssetStatus = 'InUse' | 'InStock' | 'InRepair' | 'Retired';
export type TicketSort = 'CreatedAt' | 'UpdatedAt' | 'DueAt' | 'Priority' | 'Number';

export interface UserSummary {
  id: number;
  fullName: string;
}

export interface User {
  id: number;
  fullName: string;
  email: string;
  role: UserRole;
  department: string | null;
  isActive: boolean;
}

export interface LoginResponse {
  token: string;
  expiresAt: string;
  user: User;
}

export interface PagedResult<T> {
  items: T[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
}

export interface TicketListItem {
  id: number;
  key: string;
  title: string;
  category: TicketCategory;
  priority: TicketPriority;
  status: TicketStatus;
  createdBy: UserSummary;
  assignee: UserSummary | null;
  createdAt: string;
  dueAt: string;
  isOverdue: boolean;
  commentCount: number;
}

export interface Comment {
  id: number;
  author: UserSummary;
  body: string;
  isInternal: boolean;
  createdAt: string;
}

export interface TicketEvent {
  id: number;
  type: TicketEventType;
  actor: UserSummary;
  fromValue: string | null;
  toValue: string | null;
  createdAt: string;
}

export interface AssetSummary {
  id: number;
  tag: string;
  name: string;
  type: AssetType;
}

export interface TicketDetails {
  id: number;
  key: string;
  title: string;
  description: string;
  category: TicketCategory;
  priority: TicketPriority;
  status: TicketStatus;
  createdBy: UserSummary;
  assignee: UserSummary | null;
  asset: AssetSummary | null;
  createdAt: string;
  updatedAt: string;
  dueAt: string;
  resolvedAt: string | null;
  isOverdue: boolean;
  allowedTransitions: TicketStatus[];
  comments: Comment[];
  events: TicketEvent[];
}

export interface TicketQuery {
  status?: TicketStatus | null;
  priority?: TicketPriority | null;
  category?: TicketCategory | null;
  assigneeId?: number | null;
  unassigned?: boolean | null;
  overdue?: boolean | null;
  openOnly?: boolean | null;
  search?: string | null;
  sort?: TicketSort;
  dir?: 'Asc' | 'Desc';
  page?: number;
  pageSize?: number;
}

export interface CreateTicketRequest {
  title: string;
  description: string;
  category: TicketCategory;
  priority: TicketPriority;
  assetId: number | null;
}

export interface Asset {
  id: number;
  tag: string;
  name: string;
  type: AssetType;
  status: AssetStatus;
  serialNumber: string | null;
  assignedTo: UserSummary | null;
  purchaseDate: string | null;
  warrantyUntil: string | null;
  notes: string | null;
  openTicketCount: number;
}

export interface SaveAssetRequest {
  tag: string;
  name: string;
  type: AssetType;
  status: AssetStatus;
  serialNumber: string | null;
  assignedToId: number | null;
  purchaseDate: string | null;
  warrantyUntil: string | null;
  notes: string | null;
}

export interface AssetQuery {
  type?: AssetType | null;
  status?: AssetStatus | null;
  search?: string | null;
  page?: number;
  pageSize?: number;
}

export interface CountBy {
  key: string;
  count: number;
}

export interface Dashboard {
  openTickets: number;
  overdueTickets: number;
  unassignedTickets: number;
  resolvedLast7Days: number;
  avgResolutionHours: number | null;
  byStatus: CountBy[];
  byPriority: CountBy[];
  byCategory: CountBy[];
  daily: { day: string; created: number; resolved: number }[];
  workload: { userId: number; fullName: string; openAssigned: number; overdueAssigned: number }[];
}

export interface ProblemDetails {
  title?: string;
  detail?: string;
  status?: number;
  errors?: Record<string, string[]>;
}
