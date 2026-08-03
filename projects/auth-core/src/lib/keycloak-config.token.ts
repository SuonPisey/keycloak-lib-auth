 import { InjectionToken } from '@angular/core';

export interface KeycloakAuthConfig {
  authority: string;
  clientId: string;
  redirectUri: string;
  postLogoutRedirectUri: string;
  scope?: string;
  enableIframeSessionChecks?: boolean;
  tokenExpiryWarningSeconds?: number;
  production?: boolean;
}

export const KEYCLOAK_AUTH_CONFIG = new InjectionToken<KeycloakAuthConfig>(
  'KEYCLOAK_AUTH_CONFIG',
);
