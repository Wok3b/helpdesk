import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { MessageModule } from 'primeng/message';
import { SelectModule } from 'primeng/select';
import { SelectButtonModule } from 'primeng/selectbutton';
import { TextareaModule } from 'primeng/textarea';
import { map } from 'rxjs';
import { ApiService } from '../../core/api.service';
import { ASSET_TYPE, CATEGORY_OPTIONS, PRIORITY, PRIORITY_OPTIONS, SLA_HOURS } from '../../core/labels';
import { ProblemDetails, TicketCategory, TicketPriority } from '../../core/models';
import { humanizeDuration } from '../../shared/time';

@Component({
  selector: 'app-ticket-new',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    ButtonModule,
    InputTextModule,
    MessageModule,
    SelectModule,
    SelectButtonModule,
    TextareaModule,
  ],
  template: `
    <nav class="muted mb-4 flex items-center gap-2 text-sm">
      <a routerLink="/tickets" class="hover:text-[var(--app-text)]">Tickets</a>
      <i class="pi pi-angle-right text-xs"></i>
      <span>New</span>
    </nav>

    <header class="mb-6">
      <h1 class="text-2xl font-semibold">Report a problem</h1>
      <p class="muted mt-1">Tell us what's wrong and the help desk will pick it up.</p>
    </header>

    <div class="grid gap-6 xl:grid-cols-[1fr_20rem]">
      <form class="panel flex flex-col gap-6 p-6" [formGroup]="form" (ngSubmit)="submit()">
        <div class="flex flex-col gap-2">
          <label for="title" class="text-sm font-medium">What's the problem?</label>
          <input pInputText id="title" formControlName="title" placeholder="e.g. Laptop won't connect to Wi-Fi" maxlength="150" />
          @if (fieldError('title'); as e) {
            <small class="text-red-600 dark:text-red-400">{{ e }}</small>
          }
        </div>

        <div class="flex flex-col gap-2">
          <span class="text-sm font-medium">Category</span>
          <p-selectbutton [options]="categories" formControlName="category" optionLabel="label" optionValue="value" [allowEmpty]="false" class="flex-wrap">
            <ng-template #item let-option>
              <i [class]="option.icon"></i><span class="ml-2">{{ option.label }}</span>
            </ng-template>
          </p-selectbutton>
        </div>

        <div class="flex flex-col gap-2">
          <span class="text-sm font-medium">How urgent is it?</span>
          <p-selectbutton [options]="priorities" formControlName="priority" optionLabel="label" optionValue="value" [allowEmpty]="false" class="flex-wrap">
            <ng-template #item let-option>
              <span class="size-2 rounded-full" [class]="dot(option.value)"></span><span class="ml-2">{{ option.label }}</span>
            </ng-template>
          </p-selectbutton>
          <small class="muted">{{ priorityHint() }}</small>
        </div>

        <div class="flex flex-col gap-2">
          <label for="asset" class="text-sm font-medium">Which device? <span class="muted font-normal">(optional)</span></label>
          <p-select
            inputId="asset"
            [options]="assets()"
            formControlName="assetId"
            optionLabel="label"
            optionValue="id"
            placeholder="Not about a specific device"
            [showClear]="true"
            [filter]="assets().length > 8"
            class="w-full"
          >
            <ng-template #item let-a>
              <span class="flex items-center gap-2"><i [class]="a.icon + ' muted'"></i>{{ a.label }}</span>
            </ng-template>
          </p-select>
        </div>

        <div class="flex flex-col gap-2">
          <label for="description" class="text-sm font-medium">Details</label>
          <textarea
            pTextarea
            id="description"
            formControlName="description"
            rows="6"
            [autoResize]="true"
            placeholder="What happened, when did it start, and what have you already tried?"
          ></textarea>
          @if (fieldError('description'); as e) {
            <small class="text-red-600 dark:text-red-400">{{ e }}</small>
          }
        </div>

        @if (serverError()) {
          <p-message severity="error" icon="pi pi-times-circle">{{ serverError() }}</p-message>
        }

        <div class="flex justify-end gap-2 border-t border-[var(--app-border)] pt-5">
          <p-button label="Cancel" severity="secondary" [text]="true" routerLink="/tickets" />
          <p-button type="submit" label="Submit ticket" icon="pi pi-send" [loading]="saving()" />
        </div>
      </form>

      <aside class="panel h-fit p-6">
        <h2 class="flex items-center gap-2 font-semibold"><i class="pi pi-lightbulb text-amber-500"></i>Get it fixed faster</h2>
        <ul class="muted mt-4 space-y-3 text-sm">
          <li class="flex gap-2"><i class="pi pi-check mt-0.5 text-xs text-emerald-500"></i>Copy the exact error message.</li>
          <li class="flex gap-2"><i class="pi pi-check mt-0.5 text-xs text-emerald-500"></i>Say when it started and if anything changed.</li>
          <li class="flex gap-2"><i class="pi pi-check mt-0.5 text-xs text-emerald-500"></i>Mention what you already tried, like a restart.</li>
          <li class="flex gap-2"><i class="pi pi-check mt-0.5 text-xs text-emerald-500"></i>One problem per ticket, so nothing gets lost.</li>
        </ul>
        <div class="mt-6 rounded-lg bg-[var(--p-surface-100)] p-4 text-sm dark:bg-[var(--p-surface-800)]">
          <div class="font-medium">Whole office down?</div>
          <div class="muted mt-1">Pick <b>Critical</b>. The team aims to fix those within 4 hours.</div>
        </div>
      </aside>
    </div>
  `,
})
export class TicketNewPage {
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);
  private readonly messages = inject(MessageService);

  protected readonly categories = CATEGORY_OPTIONS;
  protected readonly priorities = [...PRIORITY_OPTIONS].reverse();

  protected readonly form = inject(NonNullableFormBuilder).group({
    title: ['', [Validators.required, Validators.minLength(5), Validators.maxLength(150)]],
    category: ['Hardware' as TicketCategory],
    priority: ['Medium' as TicketPriority],
    assetId: [null as number | null],
    description: ['', [Validators.required, Validators.minLength(10), Validators.maxLength(4000)]],
  });

  constructor() {
    // "Report a problem" on an equipment card links here with ?assetId=…
    const assetId = Number(inject(ActivatedRoute).snapshot.queryParamMap.get('assetId'));
    if (assetId) this.form.controls.assetId.setValue(assetId);
  }

  protected readonly saving = signal(false);
  protected readonly serverError = signal<string | null>(null);
  private readonly submitted = signal(false);
  private readonly serverFieldErrors = signal<Record<string, string[]>>({});

  protected readonly assets = toSignal(
    this.api.assets({ pageSize: 100 }).pipe(
      map((page) =>
        page.items.map((a) => ({ id: a.id, label: `${a.tag} · ${a.name}`, icon: ASSET_TYPE[a.type].icon })),
      ),
    ),
    { initialValue: [] },
  );

  private readonly priority = toSignal(this.form.controls.priority.valueChanges, { initialValue: this.form.controls.priority.value });

  protected readonly priorityHint = computed(() => {
    const hours = SLA_HOURS[this.priority()];
    return `The help desk aims to resolve ${this.priority().toLowerCase()} priority tickets within ${humanizeDuration(hours * 3_600_000)}.`;
  });

  protected dot(priority: TicketPriority): string {
    return PRIORITY[priority].dot;
  }

  protected fieldError(name: 'title' | 'description'): string | null {
    const server = this.serverFieldErrors()[name.charAt(0).toUpperCase() + name.slice(1)];
    if (server?.length) return server[0];

    const control = this.form.controls[name];
    if (!control.invalid || !(control.touched || this.submitted())) return null;
    if (control.hasError('required')) return name === 'title' ? 'Give the problem a short title.' : 'Describe the problem in a sentence or two.';
    if (control.hasError('minlength')) return `Please write at least ${control.getError('minlength').requiredLength} characters.`;
    return null;
  }

  protected submit(): void {
    this.submitted.set(true);
    this.serverFieldErrors.set({});
    this.serverError.set(null);
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.saving.set(true);
    const value = this.form.getRawValue();
    this.api
      .createTicket({ ...value, title: value.title.trim(), description: value.description.trim() })
      .subscribe({
        next: (ticket) => {
          this.messages.add({ severity: 'success', summary: `${ticket.key} created`, detail: 'The help desk has been notified.', life: 4000 });
          this.router.navigate(['/tickets', ticket.id]);
        },
        error: (err) => {
          this.saving.set(false);
          const problem = err.error as ProblemDetails | null;
          if (err.status === 400 && problem?.errors) this.serverFieldErrors.set(problem.errors);
          else this.serverError.set(problem?.detail ?? 'The ticket could not be saved.');
        },
      });
  }
}
