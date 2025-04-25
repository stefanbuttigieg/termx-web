import { HTTP_INTERCEPTORS } from '@angular/common/http';
import { ModuleWithProviders, NgModule } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { HasAllPrivilegesPipe } from 'term-web/core/auth/privileges/has-all-privileges.pipe';
import { PrivilegeContextDirective } from 'term-web/core/auth/privileges/privilege-context.directive';
import { PrivilegedDirective } from 'term-web/core/auth/privileges/privileged.directive';
import { PrivilegedPipe } from 'term-web/core/auth/privileges/privileged.pipe';
import { HasAnyPrivilegePipe } from './privileges/has-any-privilege.pipe';
import { YupiHttpInterceptor } from './yupi/yupi.http-interceptor';
import { JwtAuthModule } from './jwt/jwt-auth.module';
import { JwtHttpInterceptor } from './jwt/jwt-http-interceptor';
import { LoginComponent } from './login/login.component';
import { CallbackComponent } from './callback/callback.component';

@NgModule({
  imports: [
    JwtAuthModule,
    ReactiveFormsModule,
    RouterModule
  ],
  declarations: [
    PrivilegedDirective,
    PrivilegeContextDirective,
    HasAnyPrivilegePipe,
    HasAllPrivilegesPipe,
    PrivilegedPipe,
    LoginComponent,
    CallbackComponent
  ],
  exports: [
    JwtAuthModule,
    PrivilegedDirective,
    PrivilegeContextDirective,
    HasAnyPrivilegePipe,
    HasAllPrivilegesPipe,
    PrivilegedPipe,
    LoginComponent,
    CallbackComponent
  ]
})
export class AuthModule {
  public static init(): ModuleWithProviders<AuthModule> {
    return {
      ngModule: AuthModule,
      providers: [
        { provide: HTTP_INTERCEPTORS, useClass: YupiHttpInterceptor, multi: true },
        { provide: HTTP_INTERCEPTORS, useClass: JwtHttpInterceptor, multi: true }
      ]
    };
  }
}
