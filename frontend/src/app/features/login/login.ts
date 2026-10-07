import { Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { MessageModule } from 'primeng/message';
import { AuthService } from '../../core/auth.service';

const DEMO_PASSWORD = 'Demo123!';

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule, ButtonModule, InputTextModule, MessageModule],
  template: `
    <div class="grid min-h-screen lg:grid-cols-[1.1fr_1fr]">
      <!-- Brand panel -->
      <section
        class="relative hidden overflow-hidden bg-[var(--p-primary-700)] p-12 text-white lg:flex lg:flex-col lg:justify-between"
      >
        <div class="flex items-center gap-3">
          <span class="flex size-10 items-center justify-center rounded-xl bg-white/15"><i class="pi pi-headphones"></i></span>
          <span class="text-lg font-semibold">HelpDesk</span>
        </div>

        <div class="max-w-md">
          <h1 class="text-4xl leading-tight font-semibold">Every IT problem, from report to resolved.</h1>
          <p class="mt-4 text-lg text-white/75">
            Employees report issues in a minute. Technicians see what's urgent, who's on it and what's about to miss its SLA.
          </p>
          <ul class="mt-10 space-y-4 text-white/90">
            <li class="flex gap-3"><i class="pi pi-clock mt-1"></i> SLA deadlines by priority, with overdue tracking</li>
            <li class="flex gap-3"><i class="pi pi-comments mt-1"></i> Conversation with the reporter, plus internal notes</li>
            <li class="flex gap-3"><i class="pi pi-desktop mt-1"></i> Equipment inventory linked to tickets</li>
          </ul>
        </div>

        <p class="text-sm text-white/60">ASP.NET Core · EF Core · SQL Server · Angular · PrimeNG</p>

        <div class="pointer-events-none absolute -right-24 -bottom-24 size-96 rounded-full bg-white/5"></div>
        <div class="pointer-events-none absolute top-24 -right-10 size-48 rounded-full bg-white/5"></div>
      </section>

      <!-- Sign-in form -->
      <section class="flex items-center justify-center p-6">
        <div class="w-full max-w-sm">
          <h2 class="text-2xl font-semibold">Sign in</h2>
          <p class="muted mt-1">Use your work email.</p>

          <form class="mt-8 flex flex-col gap-5" [formGroup]="form" (ngSubmit)="submit()">
            <div class="flex flex-col gap-2">
              <label for="email" class="text-sm font-medium">Email</label>
              <input pInputText id="email" type="email" formControlName="email" autocomplete="username" />
            </div>
            <div class="flex flex-col gap-2">
              <label for="password" class="text-sm font-medium">Password</label>
              <input pInputText id="password" type="password" formControlName="password" autocomplete="current-password" />
            </div>

            @if (error()) {
              <p-message severity="error" size="small" icon="pi pi-times-circle">{{ error() }}</p-message>
            }

            <p-button type="submit" label="Sign in" [loading]="loading()" [disabled]="form.invalid" styleClass="w-full" />
          </form>

          <div class="mt-10">
            <div class="muted mb-3 text-xs font-semibold tracking-wider uppercase">Try a demo account</div>
            <div class="grid gap-2">
              @for (demo of demos; track demo.email) {
                <button
                  type="button"
                  class="panel flex items-center gap-3 px-4 py-3 text-left transition-colors hover:border-[var(--p-primary-400)]"
                  (click)="useDemo(demo.email)"
                >
                  <i [class]="demo.icon + ' text-[var(--p-primary-500)]'"></i>
                  <span class="flex-1">
                    <span class="block text-sm font-medium">{{ demo.role }}</span>
                    <span class="muted block text-xs">{{ demo.who }}</span>
                  </span>
                  <i class="pi pi-arrow-right muted text-xs"></i>
                </button>
              }
            </div>
            <p class="muted mt-3 text-xs">Demo password for every account: {{ demoPassword }}</p>
          </div>
        </div>
      </section>
    </div>
  `,
})
export class LoginPage {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly demoPassword = DEMO_PASSWORD;
  protected readonly demos = [
    { role: 'Technician', who: 'Nikola, works the ticket queue', email: 'tech@helpdesk.local', icon: 'pi pi-wrench' },
    { role: 'Employee', who: 'Jelena from Finance, reports problems', email: 'employee@helpdesk.local', icon: 'pi pi-user' },
    { role: 'Admin', who: 'Milica, manages people and equipment', email: 'admin@helpdesk.local', icon: 'pi pi-shield' },
  ];

  protected readonly form = inject(NonNullableFormBuilder).group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', Validators.required],
  });

  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);

  protected useDemo(email: string): void {
    this.form.setValue({ email, password: DEMO_PASSWORD });
    this.submit();
  }

  protected submit(): void {
    if (this.form.invalid || this.loading()) return;
    this.loading.set(true);
    this.error.set(null);

    const { email, password } = this.form.getRawValue();
    this.auth.login(email, password).subscribe({
      next: () => this.router.navigateByUrl(this.auth.isStaff() ? '/dashboard' : '/tickets'),
      error: (err) => {
        this.loading.set(false);
        this.error.set(err.status === 401 ? 'Wrong email or password.' : "Can't reach the server. Is the API running?");
      },
    });
  }
}
