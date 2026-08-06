export type SidebarMenuType = 'link' | 'dropDown' | 'separator' | 'icon';
export type SidebarMenuVariant = 'icon-menu' | 'separator-menu' | 'plain-menu';

/** IAM menu node returned by the effective-menu endpoint. */
export interface EffectiveMenuItem {
  id?: unknown;
  title: string;
  path?: string | null;
  icon?: string;
  badge?: string | number | null;
  children?: EffectiveMenuItem[] | null;
}

export interface SidebarMenuBadge {
  color: string;
  value: string;
}

/** Presentation model consumed by SidebarMenuComponent. */
export interface SidebarMenuItem {
  id?: unknown;
  type: SidebarMenuType;
  name: string;
  state: string;
  icon?: string;
  tooltip?: string;
  disabled?: boolean;
  sub?: SidebarMenuItem[];
  badges?: SidebarMenuBadge[];
  style?: string;
}
