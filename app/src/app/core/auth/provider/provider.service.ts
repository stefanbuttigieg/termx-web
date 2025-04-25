import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { environment } from 'environments/environment';
import { Observable } from 'rxjs';
import { AuthProvider } from '../models/auth-provider.model';

@Injectable({
  providedIn: 'root'
})
export class ProviderService {
  private readonly baseUrl = `${environment.termxApi}/auth/providers`;
  
  constructor(private http: HttpClient) {}
  
  getEnabledProviders(): Observable<AuthProvider[]> {
    return this.http.get<AuthProvider[]>(`${this.baseUrl}/enabled`);
  }
  
  getAllProviders(): Observable<AuthProvider[]> {
    return this.http.get<AuthProvider[]>(this.baseUrl);
  }
  
  getProvider(id: number): Observable<AuthProvider> {
    return this.http.get<AuthProvider>(`${this.baseUrl}/${id}`);
  }
  
  createProvider(provider: Partial<AuthProvider>): Observable<AuthProvider> {
    return this.http.post<AuthProvider>(this.baseUrl, provider);
  }
  
  updateProvider(id: number, provider: Partial<AuthProvider>): Observable<AuthProvider> {
    return this.http.put<AuthProvider>(`${this.baseUrl}/${id}`, provider);
  }
  
  deleteProvider(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }
  
  enableProvider(id: number, enabled: boolean): Observable<void> {
    return this.http.put<void>(`${this.baseUrl}/${id}/enable`, { enabled });
  }
}
