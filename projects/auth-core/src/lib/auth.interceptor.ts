import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { from, switchMap } from 'rxjs';
import { KeycloakAuthService } from './keycloak-auth.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(KeycloakAuthService);

  return from(auth.getValidToken()).pipe(
    switchMap((token) => {
      const authorizedReq = token
        ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
        : req;
      return next(authorizedReq);
    }),
  );
};
