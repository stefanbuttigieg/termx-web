import { HttpEvent, HttpHandler, HttpInterceptor, HttpRequest } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { environment } from 'environments/environment';
import Cookies from 'js-cookie';
import { Observable } from 'rxjs';

const COOKIE_JWT_TOKEN_KEY = 'termx-jwt-token';

@Injectable()
export class JwtHttpInterceptor implements HttpInterceptor {
  
  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    // Skip if not calling our API
    if (!req.url.startsWith(environment.termxApi)) {
      return next.handle(req);
    }
    
    // Get token from cookie
    const token = Cookies.get(COOKIE_JWT_TOKEN_KEY);
    
    if (token) {
      // Clone the request and add the token
      const authReq = req.clone({
        headers: req.headers.set('Authorization', `Bearer ${token}`)
      });
      
      return next.handle(authReq);
    }
    
    return next.handle(req);
  }
}
