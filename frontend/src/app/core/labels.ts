import { AssetStatus, AssetType, TicketCategory, TicketPriority, TicketStatus, UserRole } from './models';

// Display text, colours and icons for every enum, so templates never hard-code them.

type Severity = 'success' | 'info' | 'warn' | 'danger' | 'secondary' | 'contrast';

export interface Option<T> {
  label: string;
  value: T;
  icon?: string;
}

export const STATUS: Record<TicketStatus, { label: string; severity: Severity; icon: string }> = {
  New: { label: 'New', severity: 'info', icon: 'pi pi-inbox' },
  InProgress: { label: 'In progress', severity: 'contrast', icon: 'pi pi-spinner' },
  WaitingOnUser: { label: 'Waiting on user', severity: 'warn', icon: 'pi pi-clock' },
  Resolved: { label: 'Resolved', severity: 'success', icon: 'pi pi-check' },
  Closed: { label: 'Closed', severity: 'secondary', icon: 'pi pi-lock' },
};

export const PRIORITY: Record<TicketPriority, { label: string; dot: string; rank: number }> = {
  Critical: { label: 'Critical', dot: 'bg-red-500', rank: 4 },
  High: { label: 'High', dot: 'bg-orange-500', rank: 3 },
  Medium: { label: 'Medium', dot: 'bg-amber-400', rank: 2 },
  Low: { label: 'Low', dot: 'bg-slate-400', rank: 1 },
};

export const CATEGORY: Record<TicketCategory, { label: string; icon: string }> = {
  Hardware: { label: 'Hardware', icon: 'pi pi-desktop' },
  Software: { label: 'Software', icon: 'pi pi-code' },
  Network: { label: 'Network', icon: 'pi pi-wifi' },
  Access: { label: 'Access', icon: 'pi pi-key' },
  Other: { label: 'Other', icon: 'pi pi-question-circle' },
};

export const ASSET_TYPE: Record<AssetType, { label: string; icon: string }> = {
  Laptop: { label: 'Laptop', icon: 'pi pi-desktop' },
  Desktop: { label: 'Desktop', icon: 'pi pi-server' },
  Monitor: { label: 'Monitor', icon: 'pi pi-window-maximize' },
  Printer: { label: 'Printer', icon: 'pi pi-print' },
  Phone: { label: 'Phone', icon: 'pi pi-mobile' },
  NetworkDevice: { label: 'Network device', icon: 'pi pi-sitemap' },
  Other: { label: 'Other', icon: 'pi pi-box' },
};

export const ASSET_STATUS: Record<AssetStatus, { label: string; severity: Severity }> = {
  InUse: { label: 'In use', severity: 'success' },
  InStock: { label: 'In stock', severity: 'info' },
  InRepair: { label: 'In repair', severity: 'warn' },
  Retired: { label: 'Retired', severity: 'secondary' },
};

export const ROLE: Record<UserRole, { label: string; severity: Severity }> = {
  Admin: { label: 'Admin', severity: 'danger' },
  Technician: { label: 'Technician', severity: 'info' },
  Employee: { label: 'Employee', severity: 'secondary' },
};

function options<K extends string>(map: Record<K, { label: string; icon?: string }>): Option<K>[] {
  return (Object.keys(map) as K[]).map((value) => ({ value, label: map[value].label, icon: map[value].icon }));
}

export const STATUS_OPTIONS = options(STATUS);
export const PRIORITY_OPTIONS = options(PRIORITY);
export const CATEGORY_OPTIONS = options(CATEGORY);
export const ASSET_TYPE_OPTIONS = options(ASSET_TYPE);
export const ASSET_STATUS_OPTIONS = options(ASSET_STATUS);
export const ROLE_OPTIONS = options(ROLE);

// SLA targets, same as SlaPolicy on the server. Used to preview the deadline while filling the form.
export const SLA_HOURS: Record<TicketPriority, number> = { Critical: 4, High: 24, Medium: 72, Low: 120 };
