import { Inject, Injectable } from '@angular/core';
import { KEYCLOAK_AUTH_CONFIG, KeycloakAuthConfig } from '../auth/config/keycloak-config.token';
import { ClientApplication } from './client-application.models';
import { CLIENT_APPLICATIONS } from './client-application.registry';
import { resolveClientApplications } from './resolve-client-applications';

@Injectable({ providedIn: 'root' })
export class ClientApplicationService {
  private readonly applications: ClientApplication[];

  constructor(@Inject(KEYCLOAK_AUTH_CONFIG) private readonly authConfig: KeycloakAuthConfig) {
    this.applications = resolveClientApplications(
      { production: authConfig.production ?? false },
      CLIENT_APPLICATIONS,
    );
  }

  getAll(): ClientApplication[] {
    return this.applications.map((application) => ({ ...application }));
  }

  getByClientId(clientId: string | null | undefined): ClientApplication | null {
    if (!clientId) return null;
    return this.applications.find((application) => application.clientId === clientId) ?? null;
  }

  isExternalClient(clientId: string | null | undefined): boolean {
    return Boolean(clientId && clientId !== this.authConfig.clientId && this.getByClientId(clientId));
  }

  resolveUrl(clientId: string, path = ''): string | null {
    const application = this.getByClientId(clientId);
    if (!application) return null;

    const baseUrl = application.url.replace(/\/+$/, '');
    const normalizedPath = path ? `/${path.replace(/^\/+/, '')}` : '';
    return `${baseUrl}${normalizedPath}`;
  }
}
