import { DatePipe } from '@angular/common';
import { Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { DatePickerModule } from 'primeng/datepicker';
import { DialogModule } from 'primeng/dialog';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { SkeletonModule } from 'primeng/skeleton';
import { TableLazyLoadEvent, TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { TextareaModule } from 'primeng/textarea';
import { debounceTime, Subject } from 'rxjs';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { ASSET_STATUS, ASSET_STATUS_OPTIONS, ASSET_TYPE, ASSET_TYPE_OPTIONS } from '../../core/labels';
import { Asset, AssetStatus, AssetType, ProblemDetails, User } from '../../core/models';
import { UserAvatar } from '../../shared/badges';

@Component({
  selector: 'app-asset-list',
  imports: [
    DatePipe,
    FormsModule,
    ReactiveFormsModule,
    RouterLink,
    ButtonModule,
    DatePickerModule,
    DialogModule,
    IconFieldModule,
    InputIconModule,
    InputTextModule,
    SelectModule,
    SkeletonModule,
    TableModule,
    TagModule,
    TextareaModule,
    UserAvatar,
  ],
  template: `
    <header class="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 class="text-2xl font-semibold">{{ auth.isStaff() ? 'Equipment' : 'My equipment' }}</h1>
        <p class="muted mt-1">
          {{ auth.isStaff() ? total() + ' devices in the inventory' : 'Devices the company has given you' }}
        </p>
      </div>
      @if (auth.isStaff()) {
        <p-button label="Add equipment" icon="pi pi-plus" (onClick)="openEditor(null)" />
      }
    </header>

    @if (auth.isStaff()) {
      <div class="panel overflow-hidden">
        <div class="flex flex-wrap items-center gap-2 border-b border-[var(--app-border)] p-4">
          <p-iconfield class="w-full sm:w-72">
            <p-inputicon class="pi pi-search" />
            <input pInputText type="search" class="w-full" placeholder="Tag, name or serial number" (input)="search$.next($any($event.target).value)" />
          </p-iconfield>
          <p-select [options]="typeOptions" [ngModel]="type()" (ngModelChange)="type.set($event); reload()" optionLabel="label" optionValue="value" placeholder="Any type" [showClear]="true" class="w-full sm:w-44" />
          <p-select [options]="statusOptions" [ngModel]="status()" (ngModelChange)="status.set($event); reload()" optionLabel="label" optionValue="value" placeholder="Any status" [showClear]="true" class="w-full sm:w-40" />
        </div>

        <p-table
          [value]="rows()"
          [lazy]="true"
          (onLazyLoad)="onLazyLoad($event)"
          [loading]="loading()"
          [paginator]="true"
          [rows]="20"
          [first]="first()"
          [totalRecords]="total()"
          [rowHover]="true"
          dataKey="id"
          [tableStyle]="{ 'min-width': '52rem' }"
        >
          <ng-template #header>
            <tr>
              <th class="w-28">Tag</th>
              <th>Device</th>
              <th class="w-32">Status</th>
              <th class="w-52">Assigned to</th>
              <th class="w-44">Warranty</th>
              <th class="w-32 text-right whitespace-nowrap">Open tickets</th>
            </tr>
          </ng-template>
          <ng-template #body let-a>
            <tr class="clickable-row" (click)="openEditor(a)">
              <td><span class="font-semibold tabular-nums">{{ a.tag }}</span></td>
              <td>
                <div class="flex items-center gap-3">
                  <i [class]="typeIcon(a.type) + ' muted'"></i>
                  <div>
                    <div class="font-medium">{{ a.name }}</div>
                    <div class="muted text-xs">{{ typeLabel(a.type) }}{{ a.serialNumber ? ' · ' + a.serialNumber : '' }}</div>
                  </div>
                </div>
              </td>
              <td><p-tag [value]="statusLabel(a.status)" [severity]="statusSeverity(a.status)" [rounded]="true" /></td>
              <td>
                @if (a.assignedTo) {
                  <span class="flex items-center gap-2 text-sm"><app-avatar [name]="a.assignedTo.fullName" [size]="1.6" />{{ a.assignedTo.fullName }}</span>
                } @else {
                  <span class="muted text-sm">Nobody</span>
                }
              </td>
              <td class="text-sm whitespace-nowrap">
                @if (a.warrantyUntil) {
                  <span [class.text-red-600]="isExpired(a.warrantyUntil)" [class.dark:text-red-400]="isExpired(a.warrantyUntil)">
                    {{ isExpired(a.warrantyUntil) ? 'Expired' : 'Until' }} {{ a.warrantyUntil | date: 'MMM y' }}
                  </span>
                } @else {
                  <span class="muted">Unknown</span>
                }
              </td>
              <td class="text-right">
                @if (a.openTicketCount) {
                  <p-tag [value]="a.openTicketCount + ''" severity="warn" [rounded]="true" />
                } @else {
                  <span class="muted">0</span>
                }
              </td>
            </tr>
          </ng-template>
          <ng-template #emptymessage>
            <tr><td colspan="6" class="muted py-12 text-center">No equipment matches these filters.</td></tr>
          </ng-template>
        </p-table>
      </div>
    } @else {
      <!-- Employees: their own devices as cards -->
      <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        @for (a of rows(); track a.id) {
          <div class="panel flex flex-col p-5">
            <div class="flex items-start gap-3">
              <span class="flex size-11 items-center justify-center rounded-xl bg-[var(--p-primary-50)] text-[var(--p-primary-600)] dark:bg-[var(--p-primary-950)] dark:text-[var(--p-primary-300)]">
                <i [class]="typeIcon(a.type) + ' text-lg'"></i>
              </span>
              <div class="min-w-0 flex-1">
                <div class="font-semibold">{{ a.name }}</div>
                <div class="muted text-sm">{{ a.tag }} · {{ typeLabel(a.type) }}</div>
              </div>
            </div>
            <dl class="muted mt-4 grid grid-cols-2 gap-2 text-xs">
              <dt>Serial</dt><dd class="text-right">{{ a.serialNumber ?? '—' }}</dd>
              <dt>Warranty</dt><dd class="text-right">{{ a.warrantyUntil ? (a.warrantyUntil | date: 'MMM y') : '—' }}</dd>
            </dl>
            <p-button
              label="Report a problem"
              icon="pi pi-wrench"
              [outlined]="true"
              size="small"
              class="mt-5"
              styleClass="w-full"
              routerLink="/tickets/new"
              [queryParams]="{ assetId: a.id }"
            />
          </div>
        } @empty {
          @if (loading()) {
            <p-skeleton height="12rem" /><p-skeleton height="12rem" />
          } @else {
            <p class="muted">No equipment is registered to you.</p>
          }
        }
      </div>
    }

    <!-- Create / edit dialog -->
    <p-dialog
      [header]="editing() ? 'Edit ' + editing()!.tag : 'Add equipment'"
      [visible]="editorOpen()"
      (visibleChange)="editorOpen.set($event)"
      [modal]="true"
      [style]="{ width: '40rem' }"
      [breakpoints]="{ '640px': '95vw' }"
      [draggable]="false"
    >
      <form [formGroup]="form" (ngSubmit)="save()" class="grid gap-4 pt-1 sm:grid-cols-2" id="asset-form">
        <div class="flex flex-col gap-2">
          <label for="tag" class="text-sm font-medium">Tag</label>
          <input pInputText id="tag" formControlName="tag" placeholder="LT-0042" />
        </div>
        <div class="flex flex-col gap-2">
          <label for="serial" class="text-sm font-medium">Serial number</label>
          <input pInputText id="serial" formControlName="serialNumber" />
        </div>
        <div class="flex flex-col gap-2 sm:col-span-2">
          <label for="name" class="text-sm font-medium">Name</label>
          <input pInputText id="name" formControlName="name" placeholder="Dell Latitude 5440" />
        </div>
        <div class="flex flex-col gap-2">
          <label class="text-sm font-medium">Type</label>
          <p-select [options]="typeOptions" formControlName="type" optionLabel="label" optionValue="value" appendTo="body" class="w-full" />
        </div>
        <div class="flex flex-col gap-2">
          <label class="text-sm font-medium">Status</label>
          <p-select [options]="statusOptions" formControlName="status" optionLabel="label" optionValue="value" appendTo="body" class="w-full" />
        </div>
        <div class="flex flex-col gap-2 sm:col-span-2">
          <label class="text-sm font-medium">Assigned to</label>
          <p-select [options]="people()" formControlName="assignedToId" optionLabel="fullName" optionValue="id" placeholder="Nobody (in stock)" [showClear]="true" [filter]="true" appendTo="body" class="w-full" />
        </div>
        <div class="flex flex-col gap-2">
          <label class="text-sm font-medium">Purchased</label>
          <p-datepicker formControlName="purchaseDate" dateFormat="dd.mm.yy" [showIcon]="true" appendTo="body" class="w-full" />
        </div>
        <div class="flex flex-col gap-2">
          <label class="text-sm font-medium">Warranty until</label>
          <p-datepicker formControlName="warrantyUntil" dateFormat="dd.mm.yy" [showIcon]="true" appendTo="body" class="w-full" />
        </div>
        <div class="flex flex-col gap-2 sm:col-span-2">
          <label for="notes" class="text-sm font-medium">Notes</label>
          <textarea pTextarea id="notes" formControlName="notes" rows="2" [autoResize]="true"></textarea>
        </div>
        @if (formError()) {
          <p class="text-sm text-red-600 sm:col-span-2 dark:text-red-400">{{ formError() }}</p>
        }
      </form>
      <ng-template #footer>
        <div class="flex w-full items-center justify-between">
          @if (editing() && auth.isAdmin()) {
            <p-button label="Delete" icon="pi pi-trash" severity="danger" [text]="true" (onClick)="confirmDelete()" />
          } @else {
            <span></span>
          }
          <div class="flex gap-2">
            <p-button label="Cancel" severity="secondary" [text]="true" (onClick)="editorOpen.set(false)" />
            <p-button label="Save" icon="pi pi-check" [loading]="saving()" (onClick)="save()" />
          </div>
        </div>
      </ng-template>
    </p-dialog>
  `,
})
export class AssetListPage {
  protected readonly auth = inject(AuthService);
  private readonly api = inject(ApiService);
  private readonly messages = inject(MessageService);
  private readonly confirm = inject(ConfirmationService);
  private readonly fb = inject(NonNullableFormBuilder);

  protected readonly typeOptions = ASSET_TYPE_OPTIONS;
  protected readonly statusOptions = ASSET_STATUS_OPTIONS;

  protected readonly rows = signal<Asset[]>([]);
  protected readonly total = signal(0);
  protected readonly loading = signal(true);
  protected readonly first = signal(0);
  protected readonly type = signal<AssetType | null>(null);
  protected readonly status = signal<AssetStatus | null>(null);
  protected readonly search$ = new Subject<string>();
  private searchTerm = '';

  protected readonly editorOpen = signal(false);
  protected readonly editing = signal<Asset | null>(null);
  protected readonly saving = signal(false);
  protected readonly formError = signal<string | null>(null);
  protected readonly people = signal<User[]>([]);

  protected readonly form = this.fb.group({
    tag: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(20)]],
    name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(120)]],
    type: ['Laptop' as AssetType],
    status: ['InStock' as AssetStatus],
    serialNumber: [''],
    assignedToId: [null as number | null],
    purchaseDate: [null as Date | null],
    warrantyUntil: [null as Date | null],
    notes: [''],
  });

  constructor() {
    this.search$.pipe(debounceTime(300), takeUntilDestroyed(inject(DestroyRef))).subscribe((term) => {
      this.searchTerm = term;
      this.reload();
    });
    if (this.auth.isStaff()) this.api.users().subscribe((u) => this.people.set(u.filter((p) => p.isActive)));
    else this.load(1, 100);
  }

  protected typeIcon = (t: AssetType) => ASSET_TYPE[t].icon;
  protected typeLabel = (t: AssetType) => ASSET_TYPE[t].label;
  protected statusLabel = (s: AssetStatus) => ASSET_STATUS[s].label;
  protected statusSeverity = (s: AssetStatus) => ASSET_STATUS[s].severity;
  protected isExpired = (date: string) => new Date(date) < new Date();

  protected onLazyLoad(e: TableLazyLoadEvent): void {
    this.first.set(e.first ?? 0);
    this.load(Math.floor((e.first ?? 0) / (e.rows ?? 20)) + 1, e.rows ?? 20);
  }

  protected reload(): void {
    this.first.set(0);
    this.load(1, 20);
  }

  protected openEditor(asset: Asset | null): void {
    if (!this.auth.isStaff()) return;
    this.editing.set(asset);
    this.formError.set(null);
    this.form.reset({
      tag: asset?.tag ?? '',
      name: asset?.name ?? '',
      type: asset?.type ?? 'Laptop',
      status: asset?.status ?? 'InStock',
      serialNumber: asset?.serialNumber ?? '',
      assignedToId: asset?.assignedTo?.id ?? null,
      purchaseDate: asset?.purchaseDate ? new Date(asset.purchaseDate) : null,
      warrantyUntil: asset?.warrantyUntil ? new Date(asset.warrantyUntil) : null,
      notes: asset?.notes ?? '',
    });
    this.editorOpen.set(true);
  }

  protected save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.formError.set('Tag and name are required.');
      return;
    }
    const v = this.form.getRawValue();
    const body = {
      ...v,
      serialNumber: v.serialNumber || null,
      notes: v.notes || null,
      purchaseDate: toDateOnly(v.purchaseDate),
      warrantyUntil: toDateOnly(v.warrantyUntil),
    };
    const editing = this.editing();
    this.saving.set(true);
    (editing ? this.api.updateAsset(editing.id, body) : this.api.createAsset(body)).subscribe({
      next: (saved) => {
        this.saving.set(false);
        this.editorOpen.set(false);
        this.messages.add({ severity: 'success', summary: `${saved.tag} saved`, life: 3000 });
        this.load(Math.floor(this.first() / 20) + 1, 20);
      },
      error: (err) => {
        this.saving.set(false);
        this.formError.set((err.error as ProblemDetails | null)?.detail ?? 'Could not save. Check the fields and try again.');
      },
    });
  }

  protected confirmDelete(): void {
    const asset = this.editing()!;
    this.confirm.confirm({
      header: `Delete ${asset.tag}?`,
      message: 'The device is removed from the inventory. Tickets that mention it keep their history.',
      icon: 'pi pi-exclamation-triangle',
      acceptButtonProps: { label: 'Delete', severity: 'danger' },
      rejectButtonProps: { label: 'Cancel', severity: 'secondary', text: true },
      accept: () =>
        this.api.deleteAsset(asset.id).subscribe(() => {
          this.editorOpen.set(false);
          this.messages.add({ severity: 'success', summary: `${asset.tag} deleted`, life: 3000 });
          this.reload();
        }),
    });
  }

  private load(page: number, pageSize: number): void {
    this.loading.set(true);
    this.api.assets({ page, pageSize, type: this.type(), status: this.status(), search: this.searchTerm || null }).subscribe({
      next: (res) => {
        this.rows.set(res.items);
        this.total.set(res.totalCount);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }
}

// The API takes DateOnly values ("2026-10-07"); build them from the local date so time zones can't shift the day.
function toDateOnly(date: Date | null): string | null {
  if (!date) return null;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
