import { Injectable } from '@angular/core';
import { BehaviorSubject,lastValueFrom } from 'rxjs';
import { User } from '../models/user.interface';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';

@Injectable({
  providedIn: 'root'
})
export class UserService {
  public currentUserSubject = new BehaviorSubject<User | null>(null);
  currentUser$ = this.currentUserSubject.asObservable();
  private apiUrl = 'http://localhost:3000';

  constructor(private http: HttpClient,
    private router: Router
  ) {
    // Check if there's a stored user
    const storedUser = localStorage.getItem('currentUser');
    if (storedUser) {
      this.currentUserSubject.next(JSON.parse(storedUser));
    }
  }

  noAuthGetRequest(url: string){
    return lastValueFrom(this.http.get<any>(this.apiUrl + url));
  }

  noAuthPostRequest(url: string, param?: any) {
    return lastValueFrom(this.http.post<any>(this.apiUrl + url, { param: JSON.stringify(param) }));
  }

  authPostRequest(url: string, param: any){
    return lastValueFrom(this.http.post<any>(this.apiUrl + url, { param: JSON.stringify(param) }));
  }

  authGetRequest(url: string){
    return lastValueFrom(this.http.get<any>(this.apiUrl + url));
  }

  async register(username: string, email: string, password: string){
    try {
      const response  = await this.http.post(`${this.apiUrl}/register`, { username, email, password});
      // return response;
    } catch (error) {
      
    }

  }

  async login(username: string, email: string, password: string): Promise<User> {
    try {
      const response: any = await this.http.post(`${this.apiUrl}/login`, {
        email,
        password
      }).toPromise();

      // Store the token
      localStorage.setItem('token', response.token);
      
      // Update the current user
      this.currentUserSubject.next(response.user);
      return response.user;
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  }

  setCurrentUser(user: User) {
    localStorage.setItem('currentUser', JSON.stringify(user));
    // this.currentUserSubject.next(user);
  }

  getCurrentUser(): User | null {
    return this.currentUserSubject.value;
  }

  isLoggedIn(): boolean {
    return !!this.currentUserSubject.value;
  }

  logout(): void {
    localStorage.removeItem('token');
    localStorage.removeItem('currentUser');
    this.currentUserSubject.next(null);
    this.router.navigate(['/login']);
  }

  getToken(): string | null {
    return localStorage.getItem('token');
  }
} 