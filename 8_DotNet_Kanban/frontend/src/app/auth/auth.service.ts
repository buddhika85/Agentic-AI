import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';

interface VerifyResponse { username: string; email: string; role: string; id: number; }

@Injectable({ providedIn: 'root' })
export class AuthService {
  private http = inject(HttpClient);
  private router = inject(Router);
  private token = signal<string | null>(localStorage.getItem('token'));
  private _role = signal<string>('User');
  private _username = signal<string>('');
  private _userId = signal<number>(0);

  isLoggedIn = computed(() => this.token() !== null);
  isAdmin = computed(() => this._role() === 'Admin');
  role = computed(() => this._role());
  username = computed(() => this._username());
  userId = computed(() => this._userId());

  async login(username: string, password: string): Promise<boolean> {
    try {
      const res = await firstValueFrom(
        this.http.post<{ token: string }>('/api/auth/login', { username, password })
      );
      localStorage.setItem('token', res.token);
      this.token.set(res.token);
      await this.loadProfile();
      return true;
    } catch {
      return false;
    }
  }

  async register(username: string, password: string, email: string): Promise<{ success: boolean; error?: string }> {
    try {
      const res = await firstValueFrom(
        this.http.post<{ token: string }>('/api/auth/register', { username, password, email })
      );
      localStorage.setItem('token', res.token);
      this.token.set(res.token);
      await this.loadProfile();
      return { success: true };
    } catch (err: any) {
      const error = err?.error?.error ?? 'Registration failed';
      return { success: false, error };
    }
  }

  async loadProfile(): Promise<void> {
    if (!this.token()) return;
    try {
      const profile = await firstValueFrom(
        this.http.get<VerifyResponse>('/api/auth/verify')
      );
      this._role.set(profile.role);
      this._username.set(profile.username);
      this._userId.set(profile.id);
    } catch {
      // token expired or invalid
      this.clearSession();
    }
  }

  async logout(): Promise<void> {
    try {
      await firstValueFrom(this.http.post('/api/auth/logout', {}));
    } finally {
      this.clearSession();
      this.router.navigate(['/login']);
    }
  }

  private clearSession(): void {
    localStorage.removeItem('token');
    this.token.set(null);
    this._role.set('User');
    this._username.set('');
    this._userId.set(0);
  }

  getToken(): string | null {
    return this.token();
  }
}
