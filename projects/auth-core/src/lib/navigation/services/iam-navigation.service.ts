import { HttpClient } from '@angular/common/http';
import { Inject, Injectable, InjectionToken, PLATFORM_ID, Provider } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { lastValueFrom, Observable } from 'rxjs';
import { KeycloakAuthService } from '../../auth/services/keycloak-auth.service';
import { PermissionService } from '../../permissions/permission.service';
import { EffectiveMenuItem, SidebarMenuItem, SidebarMenuVariant } from '../models/sidebar-menu.models';
import { SidebarMenuService } from './sidebar-menu.service';

export interface IamNavigationConfig {
  baseUrl: string;
  permissionPrefix: string;
  menuEndpoint?: string;
  authorizationEndpoint?: string;
  menuStorageKey?: string;
}

export const IAM_NAVIGATION_CONFIG = new InjectionToken<IamNavigationConfig>(
  'IAM_NAVIGATION_CONFIG',
);

export function provideIamNavigation(config: IamNavigationConfig): Provider {
  return { provide: IAM_NAVIGATION_CONFIG, useValue: config };
}

interface IamResponse<T> {
  data?: T;
}

/**
 * Loads effective IAM permissions and menus once, shares in-flight requests,
 * and restores the last menu immediately on reload.
 */
@Injectable({ providedIn: 'root' })
export class IamNavigationService {
  readonly iconTypeMenuTitle = 'Frequently Accessed';
  readonly menuItems$: Observable<SidebarMenuItem[]>;

  private initializationPromise: Promise<boolean> | null = null;
  private permissionsRequest: Promise<boolean> | null = null;
  private menuRequest: Promise<void> | null = null;
  private initialized = false;

  constructor(
    private readonly http: HttpClient,
    private readonly permissions: PermissionService,
    private readonly auth: KeycloakAuthService,
    private readonly sidebarMenu: SidebarMenuService,
    @Inject(IAM_NAVIGATION_CONFIG) private readonly config: IamNavigationConfig,
    @Inject(PLATFORM_ID) private readonly platformId: object,
  ) {
    this.menuItems$ = this.sidebarMenu.menuItems$;
  }

  initialize(forceRefresh = false): Promise<boolean> {
    if (this.initializationPromise) return this.initializationPromise;
    if (this.initialized && !forceRefresh) return Promise.resolve(true);

    this.initializationPromise = this.performInitialization(forceRefresh).finally(() => {
      this.initializationPromise = null;
    });
    return this.initializationPromise;
  }

  async loadMenu(forceRefresh = false): Promise<void> {
    if (!forceRefresh) {
      const cached = this.getCachedMenu();
      if (cached) {
        this.sidebarMenu.setEffectiveMenu(cached);
        return;
      }
    }
    await this.fetchMenu();
  }

  getPermissions(forceRefresh = false): Promise<boolean> {
    if (!forceRefresh && this.permissions.hasPermissions()) return Promise.resolve(true);
    if (this.permissionsRequest) return this.permissionsRequest;

    this.permissionsRequest = this.fetchPermissions().finally(() => {
      this.permissionsRequest = null;
    });
    return this.permissionsRequest;
  }

  publishNavigationChange(menuType: string): void {
    const variant: SidebarMenuVariant =
      menuType === 'separator-menu' || menuType === 'icon-menu' ? menuType : 'plain-menu';
    this.sidebarMenu.publishNavigationChange(variant);
  }

  clearCache(): void {
    this.initialized = false;
    this.permissions.clearPermissions();
    this.sidebarMenu.clear();
    this.storage?.removeItem(this.storageKey);
  }

  private async performInitialization(forceRefresh: boolean): Promise<boolean> {
    if (!(await this.getPermissions(forceRefresh))) {
      this.initialized = false;
      return false;
    }
    await this.loadMenu(forceRefresh);
    this.initialized = true;
    return true;
  }

  private fetchMenu(): Promise<void> {
    if (this.menuRequest) return this.menuRequest;

    this.menuRequest = lastValueFrom(
      this.http.get<IamResponse<EffectiveMenuItem[]>>(this.url(this.config.menuEndpoint ?? 'menus/effective')),
    )
      .then((response) => {
        const menu = response.data ?? [];
        this.sidebarMenu.setEffectiveMenu(menu);
        this.storage?.setItem(this.storageKey, JSON.stringify(menu));
      })
      .catch((error) => {
        const cached = this.getCachedMenu();
        if (cached) {
          this.sidebarMenu.setEffectiveMenu(cached);
          return;
        }
        console.error('Error fetching IAM menu:', error);
        if (error?.status === 401 || error?.status === 403) {
          void this.auth.logout().catch(() => undefined);
        }
      })
      .finally(() => {
        this.menuRequest = null;
      });
    return this.menuRequest;
  }

  private async fetchPermissions(): Promise<boolean> {
    const endpoint = this.config.authorizationEndpoint ?? 'authorization/effective';
    try {
      const response = await lastValueFrom(
        this.http.get<IamResponse<unknown[]>>(this.url(endpoint), {
          params: { prefix: this.config.permissionPrefix },
        }),
      );
      const normalized = (response.data ?? [])
        .filter((permission): permission is string => typeof permission === 'string')
        .map((permission) => permission.split(':').slice(-2).join(':'))
        .filter((permission) => permission.includes(':') && permission.length > 2);
      this.permissions.setPermissions(normalized);
      return true;
    } catch (error) {
      this.permissions.clearPermissions();
      console.error('Error fetching IAM permissions:', error);
      void this.auth.login().catch(() => undefined);
      return false;
    }
  }

  private getCachedMenu(): EffectiveMenuItem[] | null {
    const raw = this.storage?.getItem(this.storageKey);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as EffectiveMenuItem[];
    } catch {
      this.storage?.removeItem(this.storageKey);
      return null;
    }
  }

  private url(endpoint: string): string {
    return `${this.config.baseUrl.replace(/\/+$/, '')}/${endpoint.replace(/^\/+/, '')}`;
  }

  private get storage(): Storage | null {
    return isPlatformBrowser(this.platformId) ? localStorage : null;
  }

  private get storageKey(): string {
    return this.config.menuStorageKey ?? 'cached_effective_menu_items';
  }
}
