// permission.service.ts
import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class PermissionService {
  private readonly storageKey = 'cached_permissions';
  private permissionSet = new Set<string>();

  constructor() {
    this.restorePermissions();
  }

  setPermissions(permissions: string[]): void {
    this.permissionSet = new Set(permissions);
    localStorage.setItem(this.storageKey, JSON.stringify(permissions));
  }

  clearPermissions(): void {
    this.permissionSet.clear();
    localStorage.removeItem(this.storageKey);
  }

  can(permission: string): boolean {
    return this.permissionSet.has(permission);
  }

  canAny(permissions: string[]): boolean {
    return permissions.some((p) => this.permissionSet.has(p));
  }

  canAll(permissions: string[]): boolean {
    return permissions.every((p) => this.permissionSet.has(p));
  }

  hasPermissions(): boolean {
    return this.permissionSet.size > 0;
  }

  getAllPermissions(): string[] {
    return Array.from(this.permissionSet);
  }

  private restorePermissions(): void {
    const cachedPermissions = localStorage.getItem(this.storageKey);
    if (!cachedPermissions) {
      return;
    }

    try {
      const permissions = JSON.parse(cachedPermissions);
      if (Array.isArray(permissions)) {
        this.permissionSet = new Set(
          permissions.filter((permission): permission is string => {
            return typeof permission === 'string';
          }),
        );
      }
    } catch {
      localStorage.removeItem(this.storageKey);
    }
  }
}
