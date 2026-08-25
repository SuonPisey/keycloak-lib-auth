import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import {
  EffectiveMenuItem,
  SidebarMenuItem,
  SidebarMenuVariant,
} from '../models/sidebar-menu.models';

/**
 * Converts the IAM effective-menu tree into the sidebar shape used by
 * hb-it-internal and keeps the selected sidebar variant observable.
 */
@Injectable({ providedIn: 'root' })
export class SidebarMenuService {
  private readonly menuSubject = new BehaviorSubject<SidebarMenuItem[]>([]);
  private menu: SidebarMenuItem[] = [];

  readonly menuItems$: Observable<SidebarMenuItem[]> = this.menuSubject.asObservable();

  setEffectiveMenu(items: EffectiveMenuItem[] | null | undefined): SidebarMenuItem[] {
    this.menu = (items ?? []).map((item) => this.toSidebarItem(item, true));
    this.menuSubject.next(this.menu);
    return this.menu;
  }

  getMenuItems(): SidebarMenuItem[] {
    return this.menu;
  }

  publishNavigationChange(_variant: SidebarMenuVariant): void {
    // hb-it-internal currently renders the same IAM hierarchy for all three
    // variants. Keep this API so its customizer can switch without app code.
    this.menuSubject.next([...this.menu]);
  }

  clear(): void {
    this.menu = [];
    this.menuSubject.next([]);
  }

  private toSidebarItem(item: EffectiveMenuItem, includeTopLevelDetails: boolean): SidebarMenuItem {
    const children = item.children ?? [];
    const destination = this.resolveDestination(item.path, item.clientId);
    const menuItem: SidebarMenuItem = {
      id: item.id,
      clientId: destination.clientId,
      name: item.title,
      type: children.length > 0 ? 'dropDown' : 'link',
      state: destination.path,
      icon: item.icon,
      sub:
        children.length > 0 ? children.map((child) => this.toSidebarItem(child, false)) : undefined,
    };

    if (includeTopLevelDetails) {
      menuItem.tooltip = item.title;
      if (item.badge !== null && item.badge !== undefined && item.badge !== '') {
        menuItem.badges = [{ color: 'primary', value: String(item.badge) }];
      }
    }

    return menuItem;
  }

  private normalizePath(path: string | null | undefined): string {
    return (path ?? '').replace(/^\/+/, '');
  }

  /** Resolve `${clientId}/path` menu destinations before Angular builds the URL. */
  private resolveDestination(
    path: string | null | undefined,
    fallbackClientId: string | null | undefined,
  ): { clientId: string | null | undefined; path: string } {
    const value = (path ?? '').trimStart();
    const clientPrefix = value.match(/^\$\{([^{}]+)\}(?:\/+|$)/);

    if (!clientPrefix) {
      return { clientId: fallbackClientId, path: this.normalizePath(value) };
    }

    return {
      clientId: clientPrefix[1],
      path: this.normalizePath(value.slice(clientPrefix[0].length)),
    };
  }
}
