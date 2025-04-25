import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { environment } from 'environments/environment';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class MigrationService {
  private readonly baseUrl = `${environment.termxApi}/admin/migration`;
  
  constructor(private http: HttpClient) {}
  
  migrateKeycloakUsers(): Observable<{ count: number, message: string }> {
    return this.http.post<{ count: number, message: string }>(`${this.baseUrl}/keycloak`, {});
  }
}
