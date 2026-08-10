import { InjectionToken } from '@angular/core';

export interface KeycloakAuthConfig {
  authority: string;
  clientId: string;
  redirectUri: string;
  postLogoutRedirectUri: string;
  scope?: string;
  /** Checks an existing Keycloak browser session without showing the login page. Defaults to true. */
  enableSilentSso?: boolean;
  /** Enables Keycloak's recurring login-status iframe polling. */
  enableIframeSessionChecks?: boolean;
  tokenExpiryWarningSeconds?: number;
  production?: boolean;
}

export const KEYCLOAK_AUTH_CONFIG = new InjectionToken<KeycloakAuthConfig>('KEYCLOAK_AUTH_CONFIG');
