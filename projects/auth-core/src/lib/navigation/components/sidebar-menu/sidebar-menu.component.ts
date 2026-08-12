import { CommonModule } from '@angular/common';
import { Component, Input, OnChanges, OnDestroy, OnInit, SimpleChanges } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { Subscription } from 'rxjs';
import { SidebarMenuItem } from '../../models/sidebar-menu.models';
import { SidebarMenuService } from '../../services/sidebar-menu.service';
import { ClientApplicationService } from '../../../environment/client-application.service';

@Component({
  selector: 'auth-sidebar-menu',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive],
  templateUrl: './sidebar-menu.component.html',
  styleUrl: './sidebar-menu.component.scss',
})
export class SidebarMenuComponent implements OnInit, OnChanges, OnDestroy {
  /** When omitted, items are read from SidebarMenuService. */
  @Input() items: SidebarMenuItem[] | null | undefined;
  @Input() title = '';
  @Input() collapsed = false;
  @Input() ariaLabel = 'Main navigation';

  displayedItems: SidebarMenuItem[] = [];
  readonly expandedItems = new Set<SidebarMenuItem>();
  private menuSubscription?: Subscription;

  constructor(
    private readonly sidebarMenu: SidebarMenuService,
    private readonly clientApplications: ClientApplicationService,
  ) {}

  ngOnInit(): void {
    this.bindItems();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if ('items' in changes) {
      this.bindItems();
    }
  }

  ngOnDestroy(): void {
    this.menuSubscription?.unsubscribe();
  }

  toggle(item: SidebarMenuItem): void {
    if (this.expandedItems.has(item)) {
      this.expandedItems.delete(item);
    } else {
      this.expandedItems.add(item);
    }
  }

  isExpanded(item: SidebarMenuItem): boolean {
    return this.expandedItems.has(item);
  }

  expandActiveGroup(item: SidebarMenuItem, active: boolean): void {
    if (active && item.sub?.length) {
      this.expandedItems.add(item);
    }
  }

  trackByMenuItem(index: number, item: SidebarMenuItem): unknown {
    return item.id ?? `${item.name}:${item.state}:${index}`;
  }

  isExternal(item: SidebarMenuItem): boolean {
    return this.clientApplications.isExternalClient(item.clientId);
  }

  externalUrl(item: SidebarMenuItem): string | null {
    return item.clientId
      ? this.clientApplications.resolveUrl(item.clientId, item.state)
      : null;
  }

  private bindItems(): void {
    this.menuSubscription?.unsubscribe();

    if (this.items !== undefined && this.items !== null) {
      this.displayedItems = this.items;
      return;
    }

    this.menuSubscription = this.sidebarMenu.menuItems$.subscribe((items) => {
      this.displayedItems = items;
    });
  }
}
