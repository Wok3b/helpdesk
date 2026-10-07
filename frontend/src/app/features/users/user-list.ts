import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { ROLE, ROLE_OPTIONS } from '../../core/labels';
import { ProblemDetails, User, UserRole } from '../../core/models';
import { UserAvatar } from '../../shared/badges';

@Component({
  selector: 'app-user-list',
  imports: [
    FormsModule,
    ReactiveFormsModule,
    ButtonModule,
    DialogModule,
    InputTextModule,
    SelectModule,
    TableModule,
    TagModule,
    ToggleSwitchModule,
    UserAvatar,
  ],
  template: `
    <header class="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 class="text-2xl font-semibold">People</h1>
        <p class="muted mt-1">{{ users().length }} accounts · {{ staffCount() }} on the help desk team</p>
      </div>
      <p-button label="Add person" icon="pi pi-user-plus" (onClick)="openEditor(null)" />
    </header>

    <div class="panel overflow-hidden">
      <p-table
        [value]="users()"
        [loading]="loading()"
        [rowHover]="true"
        dataKey="id"
        sortField="fullName"
        [sortOrder]="1"
        [globalFilterFields]="['fullName', 'email', 'department']"
        #table
        [tableStyle]="{ 'min-width': '44rem' }"
      >
        <ng-template #caption>
          <input
            pInputText
            type="search"
            class="w-full sm:w-80"
            placeholder="Search people"
            (input)="table.filterGlobal($any($event.target).value, 'contains')"
          />
        </ng-template>
        <ng-template #header>
          <tr>
            <th pSortableColumn="fullName">Name <p-sortIcon field="fullName" /></th>
            <th pSortableColumn="role" class="w-36">Role <p-sortIcon field="role" /></th>
            <th pSortableColumn="department" class="w-40">Department <p-sortIcon field="department" /></th>
            <th class="w-28">Status</th>
          </tr>
        </ng-template>
        <ng-template #body let-u>
          <tr class="clickable-row" (click)="openEditor(u)">
            <td>
              <div class="flex items-center gap-3">
                <app-avatar [name]="u.fullName" [size]="2.25" />
                <div>
                  <div class="font-medium">{{ u.fullName }}</div>
                  <div class="muted text-xs">{{ u.email }}</div>
                </div>
              </div>
            </td>
            <td><p-tag [value]="roleLabel(u.role)" [severity]="roleSeverity(u.role)" [rounded]="true" /></td>
            <td class="text-sm">{{ u.department ?? '' }}</td>
            <td>
              @if (u.isActive) {
                <span class="inline-flex items-center gap-1.5 text-sm"><span class="size-2 rounded-full bg-emerald-500"></span>Active</span>
              } @else {
                <span class="muted inline-flex items-center gap-1.5 text-sm"><span class="size-2 rounded-full bg-slate-400"></span>Disabled</span>
              }
            </td>
          </tr>
        </ng-template>
      </p-table>
    </div>

    <p-dialog
      [header]="editing() ? 'Edit ' + editing()!.fullName : 'Add person'"
      [visible]="editorOpen()"
      (visibleChange)="editorOpen.set($event)"
      [modal]="true"
      [style]="{ width: '30rem' }"
      [breakpoints]="{ '640px': '95vw' }"
      [draggable]="false"
    >
      <form [formGroup]="form" (ngSubmit)="save()" class="flex flex-col gap-4 pt-1">
        <div class="flex flex-col gap-2">
          <label for="fullName" class="text-sm font-medium">Full name</label>
          <input pInputText id="fullName" formControlName="fullName" />
        </div>
        @if (!editing()) {
          <div class="flex flex-col gap-2">
            <label for="email" class="text-sm font-medium">Email</label>
            <input pInputText id="email" type="email" formControlName="email" />
          </div>
          <div class="flex flex-col gap-2">
            <label for="password" class="text-sm font-medium">Temporary password</label>
            <input pInputText id="password" type="password" formControlName="password" autocomplete="new-password" />
            <small class="muted">At least 8 characters.</small>
          </div>
        }
        <div class="grid grid-cols-2 gap-4">
          <div class="flex flex-col gap-2">
            <label class="text-sm font-medium">Role</label>
            <p-select [options]="roleOptions" formControlName="role" optionLabel="label" optionValue="value" appendTo="body" class="w-full" />
          </div>
          <div class="flex flex-col gap-2">
            <label for="department" class="text-sm font-medium">Department</label>
            <input pInputText id="department" formControlName="department" />
          </div>
        </div>
        @if (editing()) {
          <label class="flex items-center gap-3 text-sm">
            <p-toggleswitch formControlName="isActive" />
            Account is active
          </label>
        }
        @if (formError()) {
          <p class="text-sm text-red-600 dark:text-red-400">{{ formError() }}</p>
        }
      </form>
      <ng-template #footer>
        <p-button label="Cancel" severity="secondary" [text]="true" (onClick)="editorOpen.set(false)" />
        <p-button label="Save" icon="pi pi-check" [loading]="saving()" (onClick)="save()" />
      </ng-template>
    </p-dialog>
  `,
})
export class UserListPage {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);
  private readonly messages = inject(MessageService);
  private readonly fb = inject(NonNullableFormBuilder);

  protected readonly roleOptions = ROLE_OPTIONS;
  protected readonly users = signal<User[]>([]);
  protected readonly loading = signal(true);
  protected readonly staffCount = computed(() => this.users().filter((u) => u.role !== 'Employee' && u.isActive).length);

  protected readonly editorOpen = signal(false);
  protected readonly editing = signal<User | null>(null);
  protected readonly saving = signal(false);
  protected readonly formError = signal<string | null>(null);

  protected readonly form = this.fb.group({
    fullName: ['', [Validators.required, Validators.minLength(2)]],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8)]],
    role: ['Employee' as UserRole],
    department: [''],
    isActive: [true],
  });

  constructor() {
    this.load();
  }

  protected roleLabel = (r: UserRole) => ROLE[r].label;
  protected roleSeverity = (r: UserRole) => ROLE[r].severity;

  protected openEditor(user: User | null): void {
    this.editing.set(user);
    this.formError.set(null);
    this.form.reset({
      fullName: user?.fullName ?? '',
      email: user?.email ?? '',
      password: '',
      role: user?.role ?? 'Employee',
      department: user?.department ?? '',
      isActive: user?.isActive ?? true,
    });
    // Email and password only matter when creating an account.
    for (const name of ['email', 'password'] as const) {
      if (user) this.form.controls[name].disable();
      else this.form.controls[name].enable();
    }
    this.editorOpen.set(true);
  }

  protected save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.formError.set('Please fill in every field. Passwords need at least 8 characters.');
      return;
    }
    const v = this.form.getRawValue();
    const user = this.editing();
    const request = user
      ? this.api.updateUser(user.id, { fullName: v.fullName, role: v.role, department: v.department || null, isActive: v.isActive })
      : this.api.createUser({ fullName: v.fullName, email: v.email, password: v.password, role: v.role, department: v.department || null });

    this.saving.set(true);
    request.subscribe({
      next: (saved) => {
        this.saving.set(false);
        this.editorOpen.set(false);
        this.messages.add({ severity: 'success', summary: `${saved.fullName} saved`, life: 3000 });
        this.load();
      },
      error: (err) => {
        this.saving.set(false);
        this.formError.set((err.error as ProblemDetails | null)?.detail ?? 'Could not save this person.');
      },
    });
  }

  private load(): void {
    this.api.users().subscribe({
      next: (u) => {
        this.users.set(u);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }
}
