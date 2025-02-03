// auth.service.ts
import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class AuthService {

  private readonly tokenKey = 'userToken';  // Key for storing the token in localStorage

  constructor() { }

  // Method to login and store the user token in localStorage
  login(token: string): void {
    localStorage.setItem(this.tokenKey, token);
  }

  // Method to logout by removing the token from localStorage
  logout(): void {
    localStorage.removeItem(this.tokenKey);
  }

  // Method to check if the user is authenticated (if the token exists)
  isAuthenticated(): boolean {
    return !!localStorage.getItem(this.tokenKey);  // Return true if the token exists
  }

  // Method to get the current token (if needed)
  getToken(): string | null {
    return localStorage.getItem(this.tokenKey);
  }
}
