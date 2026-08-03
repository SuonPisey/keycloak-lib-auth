 import type { KeycloakConfig } from 'keycloak-js';

/**
 * Parses a Keycloak "authority" URL (e.g. https://sso.example.com/auth/realms/myrealm)
 * into the { url, realm, clientId } shape keycloak-js expects.
 */
export function parseKeycloakAuthority(
  authority: string,
  clientId: string,
): KeycloakConfig {
  const url = new URL(authority);
  const segments = url.pathname.split('/').filter(Boolean);
  const realmIndex = segments.indexOf('realms');

  const realm =
    realmIndex !== -1 && segments[realmIndex + 1]
      ? segments[realmIndex + 1]
      : segments[segments.length - 1];

  const basePathSegments =
    realmIndex !== -1 ? segments.slice(0, realmIndex) : segments.slice(0, -1);

  const baseUrl = `${url.origin}${
    basePathSegments.length ? '/' + basePathSegments.join('/') : ''
  }`;

  return {
    url: baseUrl,
    realm,
    clientId,
  };
}

/**
 * Resolves a redirect URI against the current origin if a relative path is given.
 */
export function resolveAuthUrl(redirectUri: string): string {
  if (/^https?:\/\//i.test(redirectUri)) {
    return redirectUri;
  }

  return new URL(redirectUri, window.location.origin).toString();
}

/**
 * Builds the absolute URL to the silent-check-sso.html asset used for
 * iframe-based SSO session checks. Each consuming app must place
 * silent-check-sso.html in its own public/assets folder.
 */
export function buildSilentCheckSsoRedirectUri(): string {
  return `${window.location.origin}/assets/silent-check-sso.html`;
}
