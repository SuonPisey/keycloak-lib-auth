// permission.service.ts
import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class PermissionService {
  private permissionSet = new Set<string>();

  setPermissions(permissions: string[]): void {
    this.permissionSet = new Set(permissions);
  }

  clearPermissions(): void {
    this.permissionSet.clear();
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
}
