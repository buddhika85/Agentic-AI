import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-950 via-slate-900 to-purple-950 p-4">

      <!-- Decorative blobs -->
      <div class="absolute top-0 left-0 w-96 h-96 bg-indigo-600/20 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2 pointer-events-none"></div>
      <div class="absolute bottom-0 right-0 w-96 h-96 bg-purple-600/20 rounded-full blur-3xl translate-x-1/2 translate-y-1/2 pointer-events-none"></div>

      <div class="relative w-full max-w-md">
        <div class="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl shadow-2xl p-10">

          <!-- Logo -->
          <div class="mb-8 text-center">
            <div class="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 shadow-lg mb-4">
              <svg class="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round"
                  d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7" />
              </svg>
            </div>
            <h1 class="text-2xl font-bold text-white">Kanban Studio</h1>
            <p class="text-sm text-white/50 mt-1">{{ isRegistering() ? 'Create your account' : 'Sign in to your workspace' }}</p>
          </div>

          <!-- Tab switcher -->
          <div class="flex mb-6 bg-white/5 rounded-xl p-1">
            <button (click)="isRegistering.set(false)"
                    class="flex-1 text-sm font-semibold py-2 rounded-lg transition-all"
                    [class]="!isRegistering() ? 'bg-white/15 text-white' : 'text-white/40 hover:text-white/60'">
              Sign In
            </button>
            <button (click)="isRegistering.set(true)"
                    class="flex-1 text-sm font-semibold py-2 rounded-lg transition-all"
                    [class]="isRegistering() ? 'bg-white/15 text-white' : 'text-white/40 hover:text-white/60'">
              Register
            </button>
          </div>

          <form (ngSubmit)="submit()" class="space-y-5">

            <div class="space-y-2">
              <label class="block text-xs font-semibold text-white/60 uppercase tracking-widest">Username</label>
              <input [(ngModel)]="username" name="username"
                     autocomplete="username"
                     class="w-full bg-white/10 border border-white/15 text-white placeholder-white/30 rounded-xl px-4 py-3 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/30 transition-all"
                     placeholder="username" />
            </div>

            @if (isRegistering()) {
              <div class="space-y-2">
                <label class="block text-xs font-semibold text-white/60 uppercase tracking-widest">Email</label>
                <input [(ngModel)]="email" name="email" type="email"
                       autocomplete="email"
                       class="w-full bg-white/10 border border-white/15 text-white placeholder-white/30 rounded-xl px-4 py-3 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/30 transition-all"
                       placeholder="you@example.com" />
              </div>
            }

            <div class="space-y-2">
              <label class="block text-xs font-semibold text-white/60 uppercase tracking-widest">Password</label>
              <input [(ngModel)]="password" name="password" type="password"
                     autocomplete="current-password"
                     class="w-full bg-white/10 border border-white/15 text-white placeholder-white/30 rounded-xl px-4 py-3 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/30 transition-all"
                     placeholder="••••••••" />
            </div>

            @if (error()) {
              <div class="flex items-center gap-2 bg-rose-500/15 border border-rose-500/30 rounded-xl px-4 py-3">
                <svg class="w-4 h-4 text-rose-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01M12 3a9 9 0 100 18A9 9 0 0012 3z"/>
                </svg>
                <span class="text-sm text-rose-300">{{ error() }}</span>
              </div>
            }

            <button type="submit" [disabled]="loading()"
                    class="w-full py-3 rounded-xl text-sm font-semibold text-white
                           bg-gradient-to-r from-indigo-500 to-purple-600
                           hover:from-indigo-400 hover:to-purple-500
                           disabled:opacity-50 disabled:cursor-not-allowed
                           shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40
                           transition-all duration-200 active:scale-95 mt-2">
              @if (loading()) {
                <span class="flex items-center justify-center gap-2">
                  <svg class="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                  </svg>
                  {{ isRegistering() ? 'Creating account…' : 'Signing in…' }}
                </span>
              } @else {
                {{ isRegistering() ? 'Create Account' : 'Sign In' }}
              }
            </button>

          </form>
        </div>
      </div>
    </div>
  `
})
export class LoginComponent {
  private auth = inject(AuthService);
  private router = inject(Router);

  username = '';
  password = '';
  email = '';
  isRegistering = signal(false);
  loading = signal(false);
  error = signal('');

  async submit(): Promise<void> {
    this.error.set('');
    this.loading.set(true);

    if (this.isRegistering()) {
      const result = await this.auth.register(this.username, this.password, this.email);
      this.loading.set(false);
      if (result.success) {
        this.router.navigate(['/']);
      } else {
        this.error.set(result.error ?? 'Registration failed');
      }
    } else {
      const ok = await this.auth.login(this.username, this.password);
      this.loading.set(false);
      if (ok) {
        this.router.navigate(['/']);
      } else {
        this.error.set('Invalid username or password');
      }
    }
  }
}
