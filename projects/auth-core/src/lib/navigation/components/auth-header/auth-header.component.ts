import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  HostListener,
  Input,
  Output,
} from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'auth-header',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './auth-header.component.html',
  styleUrl: './auth-header.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AuthHeaderComponent {
  @Input() logoSrc = 'assets/images/logos/en-01.png';
  @Input() logoAlt = 'Hanuman';
  @Input() userImageSrc: string | null | undefined;
  @Input() fallbackUserImageSrc: string | null = 'assets/images/face-7.jpg';
  @Input() profileRoute: string | any[] = '/myacc/profile/settings';
  @Input() showMenuToggle = true;
  @Input() showNotifications = true;
  @Input() showHelp = true;
  @Input() showProfile = true;
  @Input() notificationCount = 0;
  @Input() menuLabel = 'Open or close menu';
  @Input() homeLabel = 'Go to home';
  @Input() notificationLabel = 'Notifications';
  @Input() helpLabel = 'IT HelpDesk';
  @Input() profileLabel = 'Profile';
  @Input() signOutLabel = 'Sign Out';

  @Output() menuToggle = new EventEmitter<void>();
  @Output() homeClick = new EventEmitter<void>();
  @Output() notificationClick = new EventEmitter<void>();
  @Output() helpClick = new EventEmitter<void>();
  @Output() signOut = new EventEmitter<void>();

  accountMenuOpen = false;

  toggleAccountMenu(event: MouseEvent): void {
    event.stopPropagation();
    this.accountMenuOpen = !this.accountMenuOpen;
  }

  closeAccountMenu(): void {
    this.accountMenuOpen = false;
  }

  emitSignOut(): void {
    this.closeAccountMenu();
    this.signOut.emit();
  }

  @HostListener('document:click')
  onDocumentClick(): void {
    this.closeAccountMenu();
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.closeAccountMenu();
  }
}
