import { CommonModule } from '@angular/common';
import { Component, Input, OnDestroy, OnInit } from '@angular/core';

export interface ConfirmLogoutDialogData {
  title: string;
  message: string;
  info?: string;
  countdownSeconds: number;
  continueLabel: string;
  logoutLabel: string;
}

@Component({
  selector: 'app-confirm-logout',
  standalone: true,
  imports: [CommonModule],
  template: `
    <section class="confirm-logout">
      <h2>{{ data.title }}</h2>
      <p>{{ data.message }}</p>
      <p *ngIf="data.info">{{ data.info }}</p>
      <p><strong>{{ remainingSeconds }}s</strong> remaining</p>
      <div class="actions">
        <button type="button" (click)="logoutNow()">{{ data.logoutLabel }}</button>
        <button type="button" (click)="staySignedIn()">{{ data.continueLabel }}</button>
      </div>
    </section>
  `,
})
export class AppComfirmLogoutComponent implements OnInit, OnDestroy {
  @Input() data!: ConfirmLogoutDialogData;
  remainingSeconds: number;
  private intervalId: ReturnType<typeof window.setInterval> | null = null;

  constructor() {
    this.remainingSeconds = 0;
  }

  ngOnInit(): void {
    this.remainingSeconds = this.data.countdownSeconds;
    this.intervalId = window.setInterval(() => {
      this.remainingSeconds = Math.max(0, this.remainingSeconds - 1);
      if (this.remainingSeconds <= 0 && this.intervalId !== null) {
        window.clearInterval(this.intervalId);
      }
    }, 1000);
  }

  ngOnDestroy(): void {
    if (this.intervalId !== null) {
      window.clearInterval(this.intervalId);
    }
  }

  staySignedIn(): void {
    // The component is retained as a lightweight fallback UI.
  }

  logoutNow(): void {
    // The component is retained as a lightweight fallback UI.
  }
}
