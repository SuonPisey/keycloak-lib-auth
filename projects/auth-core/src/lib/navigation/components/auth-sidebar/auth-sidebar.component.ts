import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { SidebarMenuComponent } from '../sidebar-menu/sidebar-menu.component';
import { SidebarMenuItem } from '../../models/sidebar-menu.models';

@Component({
  selector: 'auth-sidebar',
  standalone: true,
  imports: [CommonModule, SidebarMenuComponent],
  templateUrl: './auth-sidebar.component.html',
  styleUrl: './auth-sidebar.component.scss',
})
export class AuthSidebarComponent {
  @Input() brandTitle = '';
  @Input() menuTitle = 'Frequently Accessed';
  @Input() items: SidebarMenuItem[] | null | undefined;
  @Input() collapsed = false;
  @Input() compactStyle = false;
  @Input() showDivider = true;
  @Input() userName = '';
  @Input() userImageSrc = '';
  @Input() fallbackUserImageSrc = '';
  @Input() ariaLabel = 'Application sidebar';
  @Output() readonly collapseToggle = new EventEmitter<void>();
}
