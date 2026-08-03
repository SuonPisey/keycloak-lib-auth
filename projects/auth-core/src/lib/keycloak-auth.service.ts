 import { isPlatformBrowser } from '@angular/common';
import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import type {
    KeycloakProfile,
    KeycloakTokenParsed,
    KeycloakUserInfo,
} from 'keycloak-js';
import Keycloak from 'keycloak-js';
import { BehaviorSubject, Subject } from 'rxjs';
import {
    buildSilentCheckSsoRedirectUri,
    parseKeycloakAuthority,
    resolveAuthUrl,
} from './keycloak-auth.config';
import { KEYCLOAK_AUTH_CONFIG } from './keycloak-config.token';

@Injectable({ providedIn: 'root' })
export class KeycloakAuthService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly config = inject(KEYCLOAK_AUTH_CONFIG);
  private readonly tokenStorageKey = 'token';
  private readonly userInfoStorageKey = 'user';
  private readonly loginHintStorageKey = 'login_hint';
  private readonly skipAutoLoginStorageKey = 'skip-auto-login-once';
  private readonly postLoginRedirectStorageKey = 'post-login-redirect';
  private readonly idleActivityStorageKey = 'keycloak-idle-activity';
  private readonly activityEvents = [
    'mousedown',
    'mousemove',
    'keydown',
    'scroll',
    'touchstart',
    'click',
    'wheel',
    'pointerdown',
  ] as const;
  private tokenExpiryWarningTimeoutId: number | null = null;
  private readonly isAuthenticatedSubject = new BehaviorSubject<boolean>(false);
  private readonly readySubject = new BehaviorSubject<boolean>(false);
  private readonly sessionTerminatedSubject = new Subject<void>();
  private keycloak: Keycloak | null = null;
  private initializePromise: Promise<boolean> | null = null;
  private explicitLogoutRequested = false;
  private initialLoadCompleted = false;
  private userProfile: KeycloakProfile | null = null;
  private userInfoCache: Promise<KeycloakUserInfo | null> | null = null;
  private readonly keycloakRuntimeConfig = parseKeycloakAuthority(
    this.config.authority,
    this.config.clientId,
  );

  private lastActivityRefreshAt = 0;
  private readonly activityRefreshMinIntervalMs = 30_000;
  private readonly tokenRefreshMinIntervalMs = 30_000;
  private tokenRefreshInFlight: Promise<string | null> | null = null;
  private lastTokenRefreshAttemptAt = 0;
  private refreshTokenExpiresAt: number | null = null;

  private readonly onUserActivity = (): void => {
    this.persistLastActivity();
    this.resetIdleTimer();
    this.extendSessionOnActivity();
  };

  readonly isAuthenticated$ = this.isAuthenticatedSubject.asObservable();
  readonly ready$ = this.readySubject.asObservable();
  readonly sessionTerminated$ = this.sessionTerminatedSubject.asObservable();

  async initialize(): Promise<boolean> {
    if (this.readySubject.value) {
      return this.isAuthenticatedSubject.value;
    }

    if (this.initializePromise) {
      return this.initializePromise;
    }

    if (!isPlatformBrowser(this.platformId)) {
      this.readySubject.next(true);
      return false;
    }

    this.initializePromise = this.bootstrapKeycloak();
    this.listenForCrossTabLogout();
    this.startIdleMonitor();
    return this.initializePromise;
  }

  async isAuthenticated(): Promise<boolean> {
    await this.initialize();
    return this.isAuthenticatedSubject.value;
  }

  async login(
    extraOptions?: Partial<Keycloak.KeycloakLoginOptions>,
  ): Promise<void> {
    await this.initialize();
    const loginHint = this.consumeLoginHint();
    this.clearStoredTokens();

    await this.requireKeycloak().login({
      redirectUri: resolveAuthUrl(this.config.redirectUri),
      scope: this.config.scope,
      ...(loginHint ? { loginHint } : {}),
      ...extraOptions,
    });
  }

  private persistLoginHint(loginHint: string): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    const normalized = loginHint.trim().toLowerCase();
    if (!normalized) {
      return;
    }

    window.sessionStorage.setItem(this.loginHintStorageKey, normalized);
  }

  private consumeLoginHint(): string | null {
    if (!isPlatformBrowser(this.platformId)) {
      return null;
    }

    const value = window.sessionStorage.getItem(this.loginHintStorageKey);
    if (!value) {
      return null;
    }

    window.sessionStorage.removeItem(this.loginHintStorageKey);
    return value;
  }
// 
  async logout(explicit = true): Promise<void> {
    const storedUser = this.getStoredUserInfo();

    await this.initialize();
    this.explicitLogoutRequested = explicit;
    this.markSkipAutoLoginOnce();
    this.clearIdleTimers();
    this.clearTokenExpiryWarning();
    this.clearStoredTokens();
    this.clearStoredUserInfo();
    this.userInfoCache = null;
    this.tokenRefreshInFlight = null;
    this.lastTokenRefreshAttemptAt = 0;

    const keycloak = this.requireKeycloak();
    const postLogoutUrl = new URL(
      this.config.postLogoutRedirectUri,
      window.location.origin,
    );

    const preferredUsername = storedUser?.userInfo?.['preferred_username'];
    if (preferredUsername) {
      this.persistLoginHint(preferredUsername);
    }

    try {
      await keycloak.updateToken(30);
    } catch (e) {
      console.error('Error updating token before logout:', e);
    }

    keycloak.logout({
      redirectUri: postLogoutUrl.toString(),
    });
  }

  async changePassword(): Promise<void> {
    const storedUser = this.getStoredUserInfo();
    await this.initialize();

    const keycloak = this.requireKeycloak();
    const loginHint = storedUser?.userInfo?.['preferred_username'] ?? '';
    this.persistLoginHint(loginHint);
    await keycloak.login({
      action: 'UPDATE_PASSWORD',
      ...(loginHint ? { loginHint } : {}),
    });
  }

  consumeSkipAutoLoginOnce(): boolean {
    if (!isPlatformBrowser(this.platformId)) {
      return false;
    }

    const value = window.sessionStorage.getItem(this.skipAutoLoginStorageKey);
    if (value !== '1') {
      return false;
    }

    window.sessionStorage.removeItem(this.skipAutoLoginStorageKey);
    return true;
  }

  async getValidToken(minValiditySeconds = 30): Promise<string | null> {
    return this.refreshAccessToken(minValiditySeconds);
  }

  async forceRefreshToken(): Promise<string | null> {
    return this.refreshAccessToken(-1, true);
  }

  async getTokenClaims(): Promise<KeycloakTokenParsed | null> {
    await this.initialize();
    return this.keycloak?.tokenParsed ?? this.keycloak?.idTokenParsed ?? null;
  }

  async getUserProfile(): Promise<KeycloakProfile | null> {
    await this.initialize();

    if (this.userProfile || !this.keycloak?.authenticated) {
      return this.userProfile;
    }

    try {
      this.userProfile = await this.keycloak.loadUserProfile();
      this.persistUserInfo();
      return this.userProfile;
    } catch {
      return null;
    }
  }

  async getUserInfo(): Promise<KeycloakUserInfo | null> {
    await this.initialize();

    if (!this.keycloak?.authenticated) {
      return null;
    }

    if (!this.userInfoCache) {
      this.userInfoCache = this.keycloak
        .loadUserInfo()
        .then((userInfo) => {
          if (userInfo) {
            this.persistUserInfo();
          }
          return userInfo;
        })
        .catch(() => null);
    }

    return this.userInfoCache;
  }

  setPostLoginRedirectUrl(url: string): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    if (!url.startsWith('/') || this.isAuthUtilityRoute(url)) {
      return;
    }

    window.sessionStorage.setItem(this.postLoginRedirectStorageKey, url);
  }

  consumePostLoginRedirectUrl(): string | null {
    if (!isPlatformBrowser(this.platformId)) {
      return null;
    }

    const value = window.sessionStorage.getItem(
      this.postLoginRedirectStorageKey,
    );
    window.sessionStorage.removeItem(this.postLoginRedirectStorageKey);

    return value && value.startsWith('/') ? value : null;
  }

  getStoredUserInfo(): {
    profile?: KeycloakProfile;
    userInfo?: KeycloakUserInfo;
  } | null {
    if (!isPlatformBrowser(this.platformId)) {
      return null;
    }

    const raw = window.localStorage.getItem(this.userInfoStorageKey);
    if (!raw) {
      return null;
    }

    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  clearStoredUserInfo(): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }
    window.localStorage.removeItem('id');
    window.localStorage.removeItem(this.userInfoStorageKey);
  }

  private async bootstrapKeycloak(): Promise<boolean> {
    const { default: Keycloak } = await import('keycloak-js');
    const keycloak = new Keycloak(
      parseKeycloakAuthority(this.config.authority, this.config.clientId),
    );

    this.keycloak = keycloak;
    this.bindEventHandlers(keycloak);

    const allowIframeSessionChecks =
      this.config.enableIframeSessionChecks ?? false;
    const onLoadMode = allowIframeSessionChecks ? 'check-sso' : undefined;
    const storedTokens = this.readStoredTokens();

    if (storedTokens) {
      keycloak.token = storedTokens.token;
      keycloak.refreshToken = storedTokens.refreshToken;
      keycloak.idToken = storedTokens.idToken;
      keycloak.timeSkew = storedTokens.timeSkew ?? null;
    }

    try {
      const initOptions: Keycloak.KeycloakInitOptions = {
        onLoad: onLoadMode,
        flow: 'standard',
        responseMode: 'query',
        pkceMethod: 'S256',
        scope: this.config.scope,
        redirectUri: resolveAuthUrl(this.config.redirectUri),
        silentCheckSsoRedirectUri: allowIframeSessionChecks
          ? buildSilentCheckSsoRedirectUri()
          : undefined,
        silentCheckSsoFallback: false,
        checkLoginIframe: allowIframeSessionChecks,
        checkLoginIframeInterval: 5,
        enableLogging: !this.config.production,
      };

      const authenticated = await keycloak.init(initOptions);

      this.isAuthenticatedSubject.next(authenticated);
      if (authenticated) {
        this.persistTokens(keycloak);
        this.persistLastActivity();
        this.scheduleTokenExpiryWarning();
        void this.getUserInfo();
      } else {
        this.clearTokenExpiryWarning();
      }

      return authenticated;
    } finally {
      this.initialLoadCompleted = true;
      this.readySubject.next(true);
    }
  }

  private bindEventHandlers(keycloak: Keycloak): void {
    keycloak.onReady = (authenticated) => {
      this.isAuthenticatedSubject.next(Boolean(authenticated));
    };

    keycloak.onAuthSuccess = () => {
      this.isAuthenticatedSubject.next(true);
      this.persistTokens(keycloak);
      this.persistLastActivity();
      this.resetIdleTimer();
      this.scheduleTokenExpiryWarning();

      if (this.initialLoadCompleted) {
        this.userInfoCache = null;
        void this.getUserInfo();
      }
    };

    keycloak.onAuthRefreshSuccess = () => {
      this.isAuthenticatedSubject.next(Boolean(keycloak.authenticated));
      this.persistTokens(keycloak);
      this.closeTokenExpiryWarningDialog();
      this.scheduleTokenExpiryWarning();
    };

    keycloak.onAuthLogout = () => {
      const wasAuthenticated = this.isAuthenticatedSubject.value;

      this.isAuthenticatedSubject.next(false);
      this.userProfile = null;
      this.userInfoCache = null;
      this.refreshTokenExpiresAt = null;
      this.tokenRefreshInFlight = null;
      this.lastTokenRefreshAttemptAt = 0;
      this.clearIdleTimers();
      this.clearTokenExpiryWarning();
      this.clearStoredTokens();
      this.clearStoredUserInfo();

      if (
        this.initialLoadCompleted &&
        wasAuthenticated &&
        !this.explicitLogoutRequested
      ) {
        this.sessionTerminatedSubject.next();
      }

      this.explicitLogoutRequested = false;
    };

    keycloak.onAuthRefreshError = () => {
      this.refreshTokenExpiresAt = null;
      this.tokenRefreshInFlight = null;
      this.lastTokenRefreshAttemptAt = 0;
      this.clearStoredTokens();
      keycloak.clearToken();
      this.clearTokenExpiryWarning();
    };

    keycloak.onTokenExpired = () => {
      void this.getValidToken().catch(() => undefined);
    };
  }

  private requireKeycloak(): Keycloak {
    if (!this.keycloak) {
      throw new Error('Keycloak has not been initialized');
    }

    return this.keycloak;
  }

  private captureRefreshTokenExpiry(keycloak: Keycloak): void {
    const timeSkew = keycloak.timeSkew ?? 0;

    if (
      keycloak.refreshTokenParsed &&
      typeof keycloak.refreshTokenParsed.exp === 'number'
    ) {
      this.refreshTokenExpiresAt =
        (keycloak.refreshTokenParsed.exp - timeSkew) * 1000;
      return;
    }

    const fallbackSeconds = (keycloak.tokenParsed as { refresh_expires_in?: number } | undefined)
      ?.refresh_expires_in;
    if (typeof fallbackSeconds === 'number') {
      this.refreshTokenExpiresAt = Date.now() + fallbackSeconds * 1000;
      return;
    }

    this.refreshTokenExpiresAt = null;
  }

  private async refreshAccessToken(
    minValiditySeconds: number,
    force = false,
  ): Promise<string | null> {
    await this.initialize();

    const keycloak = this.keycloak;
    if (!keycloak?.authenticated) {
      return null;
    }

    if (!keycloak.refreshToken) {
      const token = keycloak.token ?? null;
      if (token && !keycloak.isTokenExpired(minValiditySeconds)) {
        return token;
      }

      this.clearStoredTokens();
      keycloak.clearToken();
      return null;
    }

    const now = Date.now();
    const token = keycloak.token ?? null;
    const tokenStillValid =
      !!token && !keycloak.isTokenExpired(minValiditySeconds);
    const withinThrottleWindow =
      !force &&
      this.lastTokenRefreshAttemptAt > 0 &&
      now - this.lastTokenRefreshAttemptAt < this.tokenRefreshMinIntervalMs;

    if (this.tokenRefreshInFlight) {
      return this.tokenRefreshInFlight;
    }

    if (!force && withinThrottleWindow && tokenStillValid) {
      return token;
    }

    const refreshPromise: Promise<string | null> = (async () => {
      try {
        this.lastTokenRefreshAttemptAt = Date.now();
        await keycloak.updateToken(minValiditySeconds);
        const refreshedToken = keycloak.token ?? null;

        if (refreshedToken) {
          this.persistTokens(keycloak);
          this.closeTokenExpiryWarningDialog();
          this.scheduleTokenExpiryWarning();
        }

        return refreshedToken;
      } catch {
        keycloak.clearToken();
        return null;
      } finally {
        this.tokenRefreshInFlight = null;
      }
    })();

    this.tokenRefreshInFlight = refreshPromise;
    return refreshPromise;
  }

  private persistTokens(keycloak: Keycloak): void {
    this.captureRefreshTokenExpiry(keycloak);

    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    const token = keycloak.token;
    const refreshToken = keycloak.refreshToken;

    if (!token || !refreshToken) {
      this.clearStoredTokens();
      return;
    }

    const refreshExpiresIn = this.refreshTokenExpiresAt
      ? Math.max(0, Math.round((this.refreshTokenExpiresAt - Date.now()) / 1000))
      : undefined;

    const payload = {
      token,
      refreshToken,
      idToken: keycloak.idToken,
      timeSkew: keycloak.timeSkew,
      refresh_expires_in: refreshExpiresIn,
    };

    window.localStorage.setItem(this.tokenStorageKey, JSON.stringify(payload));
  }

  private readStoredTokens(): {
    token?: string;
    refreshToken?: string;
    idToken?: string;
    timeSkew?: number;
    refresh_expires_in?: number;
  } | null {
    if (!isPlatformBrowser(this.platformId)) {
      return null;
    }

    const raw = window.localStorage.getItem(this.tokenStorageKey);
    if (!raw) {
      return null;
    }

    try {
      const parsed = JSON.parse(raw) as {
        token?: unknown;
        refreshToken?: unknown;
        idToken?: unknown;
        timeSkew?: unknown;
        refresh_expires_in?: unknown;
      };

      const token = typeof parsed.token === 'string' ? parsed.token : undefined;
      const refreshToken =
        typeof parsed.refreshToken === 'string'
          ? parsed.refreshToken
          : undefined;

      if (!token || !refreshToken) {
        return null;
      }

      return {
        token,
        refreshToken,
        idToken:
          typeof parsed.idToken === 'string' ? parsed.idToken : undefined,
        timeSkew:
          typeof parsed.timeSkew === 'number' ? parsed.timeSkew : undefined,
        refresh_expires_in:
          typeof parsed.refresh_expires_in === 'number'
            ? parsed.refresh_expires_in
            : undefined,
      };
    } catch {
      return null;
    }
  }

  private clearStoredTokens(): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    window.localStorage.removeItem(this.tokenStorageKey);
    window.localStorage.removeItem(this.idleActivityStorageKey);
    window.localStorage.removeItem('cached_menu_items');
    window.localStorage.removeItem('user_permissions');
    window.localStorage.removeItem('user_permissions_hash');
    window.sessionStorage.removeItem(this.loginHintStorageKey);
    window.sessionStorage.removeItem(this.skipAutoLoginStorageKey);
    this.clearAllCookies();
  }

  private persistUserInfo(): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    const userInfoData: {
      profile?: KeycloakProfile;
      userInfo?: KeycloakUserInfo;
    } = {};

    if (this.userProfile) {
      userInfoData.profile = this.userProfile;
    }

    if (this.userInfoCache) {
      this.userInfoCache
        .then((userInfo) => {
          if (userInfo) {
            userInfoData.userInfo = userInfo;
            window.localStorage.setItem(
              this.userInfoStorageKey,
              JSON.stringify(userInfoData),
            );
          }
        })
        .catch(() => {
          if (this.userProfile) {
            window.localStorage.setItem(
              this.userInfoStorageKey,
              JSON.stringify(userInfoData),
            );
          }
        });
    } else if (this.userProfile) {
      window.localStorage.setItem(
        this.userInfoStorageKey,
        JSON.stringify(userInfoData),
      );
    }
  }

  private markSkipAutoLoginOnce(): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    window.sessionStorage.setItem(this.skipAutoLoginStorageKey, '1');
  }

  private isAuthUtilityRoute(url: string): boolean {
    return (
      url.startsWith('/callback') ||
      url.startsWith('/auth-error') ||
      url.startsWith('/sessions/callback') ||
      url.startsWith('/sessions/auth-error')
    );
  }

  private listenForCrossTabLogout(): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    window.addEventListener('storage', (event: StorageEvent) => {
      if (event.key === this.idleActivityStorageKey && event.newValue) {
        this.resetIdleTimer();
      }

      if (event.key === this.tokenStorageKey && event.newValue === null) {
        this.isAuthenticatedSubject.next(false);
        this.userProfile = null;
        this.userInfoCache = null;
        window.location.href = '/';
      }
    });
  }

  private persistLastActivity(): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    if (!this.keycloak?.authenticated) {
      return;
    }

    window.localStorage.setItem(
      this.idleActivityStorageKey,
      Date.now().toString(),
    );
  }

  private resetIdleTimer(): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    this.clearIdleTimers();

    if (!this.keycloak?.authenticated) {
      return;
    }
  }

  private startIdleMonitor(): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    this.activityEvents.forEach((eventName) =>
      window.addEventListener(eventName, this.onUserActivity, {
        passive: true,
      }),
    );

    this.persistLastActivity();
    this.resetIdleTimer();
  }

  private scheduleTokenExpiryWarning(): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    this.clearTokenExpiryWarning();

    const remainingSeconds = this.getTokenRemainingSeconds();
    const warningSeconds = this.getTokenExpiryWarningSeconds();

    if (!remainingSeconds || remainingSeconds <= 0 || warningSeconds <= 0) {
      return;
    }

    const warningDelaySeconds =
      remainingSeconds <= warningSeconds ? 0 : remainingSeconds - warningSeconds;
    this.tokenExpiryWarningTimeoutId = window.setTimeout(() => {
      const nextRemainingSeconds = this.getTokenRemainingSeconds();
      if (!nextRemainingSeconds || nextRemainingSeconds <= 0) {
        return;
      }

      const dialogCountdownSeconds = Math.min(
        Math.max(1, nextRemainingSeconds),
        warningSeconds,
      );
      this.openTokenExpiryWarningDialog(dialogCountdownSeconds);
    }, Math.max(1000, warningDelaySeconds * 1000));
  }

  private openTokenExpiryWarningDialog(countdownSeconds: number): void {
    if (!isPlatformBrowser(this.platformId) || !this.keycloak?.authenticated) {
      return;
    }

    const safeCountdownSeconds = Math.max(1, Math.floor(countdownSeconds));

    const staySignedIn = window.confirm(
      [
        'Session expiring soon',
        '',
        'Your sign-in is about to expire.',
        'Stay signed in to refresh your session, or cancel to sign out now.',
        '',
        `Countdown: ${safeCountdownSeconds}s`,
      ].join('\n'),
    );

    if (staySignedIn) {
      void this.forceRefreshToken().finally(() => {
        this.scheduleTokenExpiryWarning();
      });
      return;
    }

    void this.logout(false).catch((e) =>
      console.error('Auto logout on token expiry failed:', e),
    );
  }

  private extendSessionOnActivity(): void {
    if (!isPlatformBrowser(this.platformId) || !this.keycloak?.authenticated) {
      return;
    }

    const now = Date.now();
    if (now - this.lastActivityRefreshAt < this.activityRefreshMinIntervalMs) {
      return;
    }

    this.lastActivityRefreshAt = now;

    void this.refreshAccessToken(-1)
      .then((token) => {
        if (token) {
          this.scheduleTokenExpiryWarning();
          this.closeTokenExpiryWarningDialog();
        }
      })
      .catch(() => undefined);
  }

  private closeTokenExpiryWarningDialog(): void {
    // No persistent dialog to close after removing the Material dependency.
  }

  private clearTokenExpiryWarning(): void {
    this.closeTokenExpiryWarningDialog();

    if (this.tokenExpiryWarningTimeoutId !== null) {
      window.clearTimeout(this.tokenExpiryWarningTimeoutId);
      this.tokenExpiryWarningTimeoutId = null;
    }
  }

  private getTokenExpiryWarningSeconds(): number {
    return Math.max(0, this.config.tokenExpiryWarningSeconds ?? 30);
  }

  private getTokenRemainingSeconds(): number | null {
    if (this.refreshTokenExpiresAt === null) {
      return null;
    }

    return Math.max(
      0,
      Math.floor((this.refreshTokenExpiresAt - Date.now()) / 1000),
    );
  }

  private clearIdleTimers(): void {
    // no-op
  }

  private clearAllCookies(): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    document.cookie.split(';').forEach((cookie) => {
      const eqPos = cookie.indexOf('=');
      const name =
        eqPos > -1 ? cookie.substring(0, eqPos).trim() : cookie.trim();
      if (name) {
        document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 UTC;path=/;`;
      }
    });
  }
}

