import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { isDefined, isNil } from '@kodality-web/core-util';
import { MuiNotificationService } from '@kodality-web/marina-ui';
import { environment } from 'environments/environment';
import Cookies from 'js-cookie';
import { BehaviorSubject, Observable, catchError, map, of, tap } from 'rxjs';

const COOKIE_JWT_TOKEN_KEY = 'termx-jwt-token';
const COOKIE_REFRESH_TOKEN_KEY = 'termx-refresh-token';
const REDIRECT_ORIGIN_URL = '__termx-redirect_origin_url';

export interface UserInfo {
  username: string;
  privileges: string[];
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
}

@Injectable({providedIn: 'root'})
export class JwtAuthService {
  private readonly baseUrl = `${environment.termxApi}/auth`;
  private isAuthenticatedSubject = new BehaviorSubject<boolean>(false);
  private refreshTokenTimeout: any;

  public user?: UserInfo;
  public isAuthenticated = this.isAuthenticatedSubject.asObservable();
  public notificationShown?: boolean = false;

  constructor(
    protected http: HttpClient,
    protected router: Router,
    private notificationService: MuiNotificationService,
  ) {
    // Check if we have a token in cookies
    const token = Cookies.get(COOKIE_JWT_TOKEN_KEY);
    if (token) {
      this.isAuthenticatedSubject.next(true);
      this.startRefreshTokenTimer();
    }
  }

  public login(username: string, password: string): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.baseUrl}/login`, { username, password })
      .pipe(
        tap(response => this.setSession(response)),
        catchError(error => {
          this.notificationService.error('Login failed', error.error?.message || 'Invalid username or password');
          return of();
        })
      );
  }

  public loginWithProvider(providerId: string): void {
    sessionStorage.setItem(REDIRECT_ORIGIN_URL, window.location.pathname + window.location.search);
    
    // Get authorization URL
    this.http.get<{authorizationUrl: string}>(`${this.baseUrl}/providers/${providerId}/authorize?redirectUri=${window.location.origin}/auth/callback`)
      .subscribe(response => {
        window.location.href = response.authorizationUrl;
      });
  }

  public handleProviderCallback(providerId: string, code: string): Observable<AuthResponse> {
    const redirectUri = `${window.location.origin}/auth/callback`;
    return this.http.post<AuthResponse>(`${this.baseUrl}/providers/${providerId}/callback`, { code, redirectUri })
      .pipe(
        tap(response => this.setSession(response)),
        catchError(error => {
          this.notificationService.error('Login failed', error.error?.message || 'Failed to authenticate with provider');
          return of();
        })
      );
  }

  public refresh(): Observable<UserInfo> {
    if (environment.yupiEnabled) {
      return of({username: 'yupi', privileges: ['*.*.*']}).pipe(tap(u => this.user = u));
    }

    return this.refreshUserInfo().pipe(
      tap(resp => {
        this.user = resp;
      }),
      catchError(() => {
        this.user = undefined;
        this.login('', '');
        return of();
      })
    );
  }

  private refreshUserInfo(): Observable<UserInfo> {
    return this.http.get<UserInfo>(`${this.baseUrl}/userinfo`);
  }

  public refreshToken(): Observable<AuthResponse> {
    const refreshToken = Cookies.get(COOKIE_REFRESH_TOKEN_KEY);
    if (!refreshToken) {
      this.logout();
      return of();
    }

    return this.http.post<AuthResponse>(`${this.baseUrl}/refresh`, { refreshToken })
      .pipe(
        tap(response => this.setSession(response)),
        catchError(error => {
          this.logout();
          return of();
        })
      );
  }

  public logout(): Observable<any> {
    const refreshToken = Cookies.get(COOKIE_REFRESH_TOKEN_KEY);
    if (refreshToken) {
      return this.http.post(`${this.baseUrl}/logout`, { refreshToken })
        .pipe(
          tap(() => this.clearSession()),
          catchError(() => {
            this.clearSession();
            return of();
          })
        );
    } else {
      this.clearSession();
      return of();
    }
  }

  private setSession(authResult: AuthResponse): void {
    // Set cookies
    const expiresIn = this.getTokenExpirationTime(authResult.accessToken);
    Cookies.set(COOKIE_JWT_TOKEN_KEY, authResult.accessToken, {
      expires: new Date(new Date().getTime() + expiresIn * 1000),
      secure: environment.production
    });
    
    Cookies.set(COOKIE_REFRESH_TOKEN_KEY, authResult.refreshToken, {
      expires: 7, // 7 days
      secure: environment.production
    });

    this.isAuthenticatedSubject.next(true);
    this.startRefreshTokenTimer();

    // Handle redirect after login
    const redirectUrl = sessionStorage.getItem(REDIRECT_ORIGIN_URL);
    if (redirectUrl) {
      sessionStorage.removeItem(REDIRECT_ORIGIN_URL);
      window.location.href = redirectUrl;
    }
  }

  private clearSession(): void {
    Cookies.remove(COOKIE_JWT_TOKEN_KEY);
    Cookies.remove(COOKIE_REFRESH_TOKEN_KEY);
    this.isAuthenticatedSubject.next(false);
    this.stopRefreshTokenTimer();
    this.user = undefined;
    this.router.navigate(['/login']);
  }

  private getTokenExpirationTime(token: string): number {
    const tokenParts = token.split('.');
    if (tokenParts.length !== 3) {
      return 0;
    }

    try {
      const tokenPayload = JSON.parse(atob(tokenParts[1]));
      const exp = tokenPayload.exp;
      const now = Math.floor(Date.now() / 1000);
      return exp - now;
    } catch (e) {
      return 0;
    }
  }

  private startRefreshTokenTimer(): void {
    const token = Cookies.get(COOKIE_JWT_TOKEN_KEY);
    if (!token) {
      return;
    }

    const expiresIn = this.getTokenExpirationTime(token);
    
    // Refresh 30 seconds before token expires
    const timeout = (expiresIn - 30) * 1000;
    if (timeout <= 0) {
      this.refreshToken();
      return;
    }

    this.refreshTokenTimeout = setTimeout(() => {
      this.refreshToken().subscribe();
    }, timeout);
  }

  private stopRefreshTokenTimer(): void {
    if (this.refreshTokenTimeout) {
      clearTimeout(this.refreshTokenTimeout);
    }
  }

  public includesPrivilege(userPrivileges: string[], authPrivilege: string): boolean {
    if (!authPrivilege) {
      return false;
    }
    if (!userPrivileges) {
      return false;
    }

    return userPrivileges.some(userPrivilege => {
      let upParts = /(.*)\.([^\.]+)\.([^.]+)$/.exec(userPrivilege)?.splice(1, 3) || [];  
      let apParts = /(.*)\.([^\.]+)\.([^.]+)$/.exec(authPrivilege)?.splice(1, 3) || [];  
      if (apParts.length === 2 && apParts[0] === '*') { // handle special case like '*.view'
        apParts = ['*'].concat(apParts);
      }
      if (upParts.length === 2 && upParts[0] === '*') { // handle special case like '*.view'
        upParts = ['*'].concat(upParts);
      }

      if (upParts.length !== 3 && apParts.length !== 3) {
        return false;
      }
      return this.match(upParts[0], apParts[0]) && this.match(upParts[1], apParts[1]) && this.match(upParts[2], apParts[2]);
    });
  }

  private match = (upPart: string, apPart: string): boolean => upPart === apPart || upPart === '*' || apPart === '*';

  public hasPrivilege(privilege: string): boolean {
    if (!this.user) {
      return false;
    }
    return this.includesPrivilege(this.user.privileges, privilege);
  }

  public hasAllPrivileges(privileges: string[]): boolean {
    if (!this.user) {
      return false;
    }
    return privileges.every(p => this.includesPrivilege(this.user.privileges, p));
  }

  public hasAnyPrivilege(privileges: string[]): boolean {
    if (!this.user) {
      return false;
    }
    return privileges.some(p => this.includesPrivilege(this.user.privileges, p));
  }
}
