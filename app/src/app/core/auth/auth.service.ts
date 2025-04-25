import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { MuiNotificationService } from '@kodality-web/marina-ui';
import { environment } from 'environments/environment';
import { Observable, catchError, of, tap } from 'rxjs';
import { JwtAuthService } from './jwt/jwt-auth.service';

export interface UserInfo {
  username: string;
  privileges: string[];
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly baseUrl = `${environment.termxApi}/auth`;

  public user?: UserInfo;
  public isAuthenticated = this.jwtAuthService.isAuthenticated;
  public notificationShown?: boolean = false;

  constructor(
    protected http: HttpClient,
    protected router: Router,
    private jwtAuthService: JwtAuthService,
    private notificationService: MuiNotificationService,
  ) {}

  public refresh(): Observable<UserInfo> {
    if (environment.yupiEnabled) {
      return of({ username: 'yupi', privileges: ['*.*.*'] }).pipe(tap(u => this.user = u));
    }

    return this.loadUserInfo().pipe(
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

  private loadUserInfo(): Observable<UserInfo> {
    return this.http.get<UserInfo>(`${this.baseUrl}/userinfo`);
  }

  public login(username: string, password: string): Observable<any> {
    return this.jwtAuthService.login(username, password);
  }

  public loginWithProvider(providerId: string): void {
    this.jwtAuthService.loginWithProvider(providerId);
  }

  public logout(): Observable<any> {
    return this.jwtAuthService.logout();
  }

  public hasPrivilege(privilege: string): boolean {
    if (!this.user) {
      return false;
    }
    return this.jwtAuthService.includesPrivilege(this.user.privileges, privilege);
  }

  public hasAllPrivileges(privileges: string[]): boolean {
    if (!this.user) {
      return false;
    }
    return privileges.every(p => this.jwtAuthService.includesPrivilege(this.user.privileges, p));
  }

  public hasAnyPrivilege(privileges: string[]): boolean {
    if (!this.user) {
      return false;
    }
    return privileges.some(p => this.jwtAuthService.includesPrivilege(this.user.privileges, p));
  }
}
