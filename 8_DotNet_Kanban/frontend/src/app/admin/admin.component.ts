import { Component, OnInit, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../auth/auth.service';

interface UserDto {
  id: number;
  username: string;
  email: string;
  role: string;
  createdAt: string;
}

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [FormsModule, DatePipe],
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
          <h1 class="text-base font-bold text-white tracking-tight">User Management</h1>
        </div>
        <span class="text-white/60 text-sm">{{ auth.username() }}</span>
      </header>

      <main class="max-w-4xl mx-auto p-8">

        @if (error()) {
          <div class="mb-4 bg-rose-50 border border-rose-200 rounded-xl px-4 py-3 text-sm text-rose-600">
            {{ error() }}
          </div>
        }

        @if (success()) {
          <div class="mb-4 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 text-sm text-emerald-600">
            {{ success() }}
          </div>
        }

        <div class="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div class="flex items-center justify-between px-6 py-4 border-b border-gray-100">
            <h2 class="font-semibold text-gray-800">Users ({{ users().length }})</h2>
            <button (click)="loadUsers()"
                    class="text-xs text-indigo-600 hover:text-indigo-800 font-medium transition-colors">
              Refresh
            </button>
          </div>

          @if (loading()) {
            <div class="flex items-center justify-center py-12 text-indigo-400">
              <svg class="w-6 h-6 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
              </svg>
            </div>
          } @else {
            <table class="w-full text-sm">
              <thead>
                <tr class="text-xs font-semibold text-gray-400 uppercase tracking-wide bg-gray-50">
                  <th class="px-6 py-3 text-left">User</th>
                  <th class="px-6 py-3 text-left">Email</th>
                  <th class="px-6 py-3 text-left">Role</th>
                  <th class="px-6 py-3 text-left">Joined</th>
                  <th class="px-6 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-50">
                @for (user of users(); track user.id) {
                  <tr class="hover:bg-gray-50 transition-colors">
                    <td class="px-6 py-4">
                      <div class="flex items-center gap-3">
                        <div class="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center
                                    text-xs font-bold text-indigo-700">
                          {{ user.username[0].toUpperCase() }}
                        </div>
                        <span class="font-medium text-gray-800">{{ user.username }}</span>
                        @if (user.id === auth.userId()) {
                          <span class="text-xs bg-indigo-100 text-indigo-600 px-1.5 py-0.5 rounded">you</span>
                        }
                      </div>
                    </td>
                    <td class="px-6 py-4 text-gray-500">{{ user.email || '—' }}</td>
                    <td class="px-6 py-4">
                      <span class="text-xs font-semibold px-2 py-0.5 rounded-full"
                            [class]="user.role === 'Admin' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-600'">
                        {{ user.role }}
                      </span>
                    </td>
                    <td class="px-6 py-4 text-gray-400">{{ user.createdAt | date:'MMM d, y' }}</td>
                    <td class="px-6 py-4">
                      <div class="flex items-center justify-end gap-2">
                        <!-- Toggle role -->
                        @if (user.id !== auth.userId()) {
                          <button (click)="toggleRole(user)"
                                  class="text-xs text-indigo-600 hover:text-indigo-800 font-medium transition-colors px-2 py-1 rounded hover:bg-indigo-50">
                            Make {{ user.role === 'Admin' ? 'User' : 'Admin' }}
                          </button>
                          <button (click)="resetPasswordFor(user)"
                                  class="text-xs text-amber-600 hover:text-amber-800 font-medium transition-colors px-2 py-1 rounded hover:bg-amber-50">
                            Reset PW
                          </button>
                          <button (click)="deleteUser(user)"
                                  class="text-xs text-rose-500 hover:text-rose-700 font-medium transition-colors px-2 py-1 rounded hover:bg-rose-50">
                            Delete
                          </button>
                        }
                      </div>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          }
        </div>

      </main>
    </div>
  `
})
export class AdminComponent implements OnInit {
  auth = inject(AuthService);
  router = inject(Router);
  private http = inject(HttpClient);

  users = signal<UserDto[]>([]);
  loading = signal(false);
  error = signal('');
  success = signal('');

  async ngOnInit(): Promise<void> {
    await this.loadUsers();
  }

  async loadUsers(): Promise<void> {
    this.loading.set(true);
    this.error.set('');
    try {
      const list = await firstValueFrom(this.http.get<UserDto[]>('/api/admin/users'));
      this.users.set(list);
    } catch {
      this.error.set('Failed to load users');
    } finally {
      this.loading.set(false);
    }
  }

  async toggleRole(user: UserDto): Promise<void> {
    const newRole = user.role === 'Admin' ? 'User' : 'Admin';
    try {
      await firstValueFrom(this.http.post(`/api/admin/users/${user.id}/role`, { role: newRole }));
      this.showSuccess(`${user.username} is now ${newRole}`);
      await this.loadUsers();
    } catch {
      this.error.set('Failed to update role');
    }
  }

  async resetPasswordFor(user: UserDto): Promise<void> {
    const newPw = prompt(`Set new password for "${user.username}" (min 6 chars):`);
    if (!newPw || newPw.length < 6) {
      if (newPw !== null) this.error.set('Password must be at least 6 characters');
      return;
    }
    try {
      await firstValueFrom(this.http.post(`/api/admin/users/${user.id}/reset-password`, { newPassword: newPw }));
      this.showSuccess(`Password reset for ${user.username}`);
    } catch {
      this.error.set('Failed to reset password');
    }
  }

  async deleteUser(user: UserDto): Promise<void> {
    if (!confirm(`Delete "${user.username}"? All their boards will be removed.`)) return;
    try {
      await firstValueFrom(this.http.delete(`/api/admin/users/${user.id}`));
      this.showSuccess(`${user.username} deleted`);
      this.users.update(list => list.filter(u => u.id !== user.id));
    } catch {
      this.error.set('Failed to delete user');
    }
  }

  private showSuccess(msg: string): void {
    this.success.set(msg);
    this.error.set('');
    setTimeout(() => this.success.set(''), 3000);
  }
}
