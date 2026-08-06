import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { EnvironmentProviders, makeEnvironmentProviders } from '@angular/core';
import { KeycloakAuthConfig, KEYCLOAK_AUTH_CONFIG } from '../config/keycloak-config.token';
import { authInterceptor } from '../interceptors/auth.interceptor';

/** Registers the auth configuration and bearer-token HTTP interceptor. */
export function provideAuthCore(config: KeycloakAuthConfig): EnvironmentProviders {
  return makeEnvironmentProviders([
    { provide: KEYCLOAK_AUTH_CONFIG, useValue: config },
    provideHttpClient(withInterceptors([authInterceptor])),
  ]);
}
