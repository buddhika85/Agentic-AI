import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private http = inject(HttpClient);
  private router = inject(Router);
  private token = signal<string | null>(localStorage.getItem('token'));

  isLoggedIn = computed(() => this.token() !== null);

  async login(username: string, password: string): Promise<boolean> {
    try {
      const res = await firstValueFrom(
        this.http.post<{ token: string }>('/api/auth/login', { username, password })
      );
      localStorage.setItem('token', res.token);
      this.token.set(res.token);
      return true;
    } catch {
      return false;
    }
  }

  async logout(): Promise<void> {
    try {
      await firstValueFrom(this.http.post('/api/auth/logout', {}));
    } finally {
      localStorage.removeItem('token');
      this.token.set(null);
      this.router.navigate(['/login']);
    }
  }

  getToken(): string | null {
    return this.token();
  }
}
