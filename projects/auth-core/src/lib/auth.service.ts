import { Injectable } from '@angular/core';
import Keycloak from 'keycloak-js';
import { BehaviorSubject } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private keycloak!: Keycloak;
  private tokenSubject = new BehaviorSubject<string | null>(null);
  token$ = this.tokenSubject.asObservable();
  private initialized = false;

  async init(): Promise<void> {
    if (this.initialized) return;

    this.keycloak = new Keycloak({
      url: 'https://your-keycloak-domain/auth',
      realm: 'your-realm',
      clientId: 'your-client-id'
    });

    const authenticated = await this.keycloak.init({
      onLoad: 'login-required',
      silentCheckSsoRedirectUri: window.location.origin + '/assets/silent-check-sso.html',
      pkceMethod: 'S256'
    });

    if (authenticated) {
      this.tokenSubject.next(this.keycloak.token ?? null);
      this.setupTokenRefresh();
    }

    this.initialized = true;
  }

  private setupTokenRefresh() {
    setInterval(() => {
      this.keycloak.updateToken(30).then((refreshed) => {
        if (refreshed) {
          this.tokenSubject.next(this.keycloak.token ?? null);
        }
      }).catch(() => this.logout());
    }, 10000);
  }

  getToken(): string | undefined {
    return this.keycloak?.token;
  }

  logout() {
    this.keycloak.logout();
  }

  get instance(): Keycloak {
    return this.keycloak;
  }
}
