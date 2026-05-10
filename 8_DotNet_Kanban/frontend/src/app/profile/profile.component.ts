import { Component, OnInit, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../auth/auth.service';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="min-h-screen bg-gradient-to-br from-slate-100 to-indigo-50">

      <!-- Header -->
      <header class="flex items-center justify-between px-6 py-4
                     bg-gradient-to-r from-indigo-700 to-purple-700
                     shadow-lg shadow-indigo-900/30">
        <div class="flex items-center gap-3">
          <button (click)="router.navigate(['/'])"
                  class="text-white/60 hover:text-white transition-colors">
            <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18"/>
            </svg>
          </button>
          <h1 class="text-base font-bold text-white tracking-tight">Profile Settings</h1>
        </div>
        <span class="text-white/60 text-sm">{{ auth.username() }}</span>
      </header>

      <main class="max-w-2xl mx-auto p-8 space-y-6">

        @if (globalError()) {
          <div class="bg-rose-50 border border-rose-200 rounded-xl px-4 py-3 text-sm text-rose-600">
            {{ globalError() }}
          </div>
        }
        @if (globalSuccess()) {
          <div class="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 text-sm text-emerald-600">
            {{ globalSuccess() }}
          </div>
        }

        <!-- Account info -->
        <div class="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div class="px-6 py-4 border-b border-gray-100">
            <h2 class="font-semibold text-gray-800">Account Information</h2>
          </div>
          <div class="p-6 space-y-4">
            <!-- Avatar -->
            <div class="flex items-center gap-4">
              <div class="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-400 to-purple-500
                          flex items-center justify-center text-white text-2xl font-bold shadow-lg">
                {{ auth.username()[0]?.toUpperCase() }}
              </div>
              <div>
                <p class="font-semibold text-gray-800">{{ auth.username() }}</p>
                <span class="text-xs px-2 py-0.5 rounded-full font-semibold"
                      [class]="auth.isAdmin() ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-600'">
                  {{ auth.isAdmin() ? 'Admin' : 'User' }}
                </span>
              </div>
            </div>

            <!-- Email update -->
            <div class="space-y-1">
              <label class="text-xs font-semibold text-gray-500 uppercase tracking-wide">Email</label>
              <div class="flex gap-2">
                <input [(ngModel)]="emailInput"
                       type="email"
                       class="flex-1 text-sm border border-gray-200 rounded-xl px-3 py-2 outline-none
                              focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all"
                       placeholder="your@email.com" />
                <button (click)="updateEmail()"
                        [disabled]="savingEmail()"
                        class="text-sm font-semibold bg-indigo-600 text-white px-4 py-2 rounded-xl
                               hover:bg-indigo-700 disabled:opacity-50 transition-colors">
                  {{ savingEmail() ? 'Saving…' : 'Save' }}
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Change password -->
        <div class="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div class="px-6 py-4 border-b border-gray-100">
            <h2 class="font-semibold text-gray-800">Change Password</h2>
          </div>
          <div class="p-6 space-y-4">
            <div class="space-y-1">
              <label class="text-xs font-semibold text-gray-500 uppercase tracking-wide">Current Password</label>
              <input [(ngModel)]="currentPassword" type="password"
                     class="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 outline-none
                            focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all"
                     placeholder="••••••••" />
            </div>
            <div class="space-y-1">
              <label class="text-xs font-semibold text-gray-500 uppercase tracking-wide">New Password</label>
              <input [(ngModel)]="newPassword" type="password"
                     class="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 outline-none
                            focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all"
                     placeholder="Min 6 characters" />
            </div>
            <div class="space-y-1">
              <label class="text-xs font-semibold text-gray-500 uppercase tracking-wide">Confirm New Password</label>
              <input [(ngModel)]="confirmPassword" type="password"
                     class="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 outline-none
                            focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all"
                     placeholder="••••••••" />
            </div>
            @if (pwError()) {
              <p class="text-sm text-rose-500">{{ pwError() }}</p>
            }
            <button (click)="changePassword()"
                    [disabled]="savingPw()"
                    class="w-full text-sm font-semibold bg-indigo-600 text-white px-4 py-2.5 rounded-xl
                           hover:bg-indigo-700 disabled:opacity-50 transition-colors">
              {{ savingPw() ? 'Changing…' : 'Change Password' }}
            </button>
          </div>
        </div>

      </main>
    </div>
  `
})
export class ProfileComponent implements OnInit {
  auth = inject(AuthService);
  router = inject(Router);
  private http = inject(HttpClient);

  emailInput    = '';
  currentPassword = '';
  newPassword   = '';
  confirmPassword = '';

  savingEmail  = signal(false);
  savingPw     = signal(false);
  globalError  = signal('');
  globalSuccess = signal('');
  pwError      = signal('');

  async ngOnInit(): Promise<void> {
    await this.auth.loadProfile();
    this.emailInput = this.auth.email();
  }

  async updateEmail(): Promise<void> {
    this.savingEmail.set(true);
    this.globalError.set('');
    this.globalSuccess.set('');
    try {
      await firstValueFrom(this.http.post('/api/auth/profile', { email: this.emailInput }));
      await this.auth.loadProfile();
      this.showSuccess('Email updated');
    } catch {
      this.globalError.set('Failed to update email — it may already be in use');
    } finally {
      this.savingEmail.set(false);
    }
  }

  async changePassword(): Promise<void> {
    this.pwError.set('');
    this.globalSuccess.set('');
    if (!this.currentPassword || !this.newPassword) {
      this.pwError.set('All fields are required');
      return;
    }
    if (this.newPassword.length < 6) {
      this.pwError.set('New password must be at least 6 characters');
      return;
    }
    if (this.newPassword !== this.confirmPassword) {
      this.pwError.set('Passwords do not match');
      return;
    }
    this.savingPw.set(true);
    try {
      await firstValueFrom(this.http.post('/api/auth/change-password', {
        currentPassword: this.currentPassword,
        newPassword: this.newPassword
      }));
      this.currentPassword = '';
      this.newPassword = '';
      this.confirmPassword = '';
      this.showSuccess('Password changed successfully');
    } catch {
      this.pwError.set('Current password is incorrect');
    } finally {
      this.savingPw.set(false);
    }
  }

  private showSuccess(msg: string): void {
    this.globalSuccess.set(msg);
    setTimeout(() => this.globalSuccess.set(''), 3000);
  }
}
