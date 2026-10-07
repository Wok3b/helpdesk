import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { MessageService } from 'primeng/api';
import { catchError, throwError } from 'rxjs';
import { AuthService } from './auth.service';
import { ProblemDetails } from './models';

// Turns API problem responses into toasts, and sends the user to login when the session has expired.
export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const messages = inject(MessageService);

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      const isLogin = req.url.endsWith('/auth/login');

      if (error.status === 401 && !isLogin) {
        auth.logout();
      } else if (error.status !== 400 && !isLogin) {
        // 400s carry field errors that the form shows next to the inputs.
        const problem = error.error as ProblemDetails | null;
        messages.add({
          severity: error.status >= 500 || error.status === 0 ? 'error' : 'warn',
          summary: problem?.title ?? (error.status === 0 ? 'Server unreachable' : 'Request failed'),
          detail: problem?.detail ?? 'Please try again in a moment.',
          life: 5000,
        });
      }
      return throwError(() => error);
    }),
  );
};
