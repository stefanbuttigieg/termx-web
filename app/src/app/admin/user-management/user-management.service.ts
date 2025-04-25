import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { environment } from 'environments/environment';
import { Observable } from 'rxjs';
import { User } from './user.model';

@Injectable({
  providedIn: 'root'
})
export class UserManagementService {
  private readonly baseUrl = `${environment.termxApi}/users`;
  
  constructor(private http: HttpClient) {}
  
  getUsers(): Observable<User[]> {
    return this.http.get<User[]>(this.baseUrl);
  }
  
  getUser(id: number): Observable<User> {
    return this.http.get<User>(`${this.baseUrl}/${id}`);
  }
  
  createUser(user: Partial<User>): Observable<User> {
    return this.http.post<User>(this.baseUrl, user);
  }
  
  updateUser(id: number, user: Partial<User>): Observable<User> {
    return this.http.put<User>(`${this.baseUrl}/${id}`, user);
  }
  
  deleteUser(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }
  
  getUserPrivileges(id: number): Observable<string[]> {
    return this.http.get<string[]>(`${this.baseUrl}/${id}/privileges`);
  }
  
  addUserPrivilege(id: number, privilegeId: number): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/${id}/privileges`, { privilegeId });
  }
  
  removeUserPrivilege(id: number, privilegeId: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}/privileges/${privilegeId}`);
  }
  
  getUserRoles(id: number): Observable<string[]> {
    return this.http.get<string[]>(`${this.baseUrl}/${id}/roles`);
  }
  
  addUserRole(id: number, role: string): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/${id}/roles`, { role });
  }
  
  removeUserRole(id: number, role: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}/roles/${role}`);
  }
  
  changePassword(id: number, newPassword: string): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/${id}/change-password`, { newPassword });
  }
}
