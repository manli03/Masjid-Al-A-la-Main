import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../services/Auth/auth.service';  // Import AuthService

@Component({
  selector: 'app-authentication',
  templateUrl: './authentication.page.html',
  styleUrls: ['./authentication.page.scss'],
})
export class AuthenticationPage implements OnInit {
  ngOnInit() {
  }

  segment: string = 'login';  // Default to login form
  email: string = '';
  password: string = '';
  confirmPassword: string = '';

  constructor(
    private router: Router,
    private authService: AuthService
  ) { }

  segmentChanged(event: any) {
    this.segment = event.detail.value;
  }

  login() {
    if (this.email && this.password) {
      console.log('Cubaan log masuk:', this.email);
      // Here you can handle actual login logic, e.g., API call
      // Simulate login and retrieve a token (replace with actual login logic)

      const token = this.email + this.password;  // You should replace this with the real token from the API response
      this.authService.login(token);  // Store the token in localStorage
      
      // clear all input
      this.email = '';
      this.password = '';

      if (token==="adminadmin") {
        this.router.navigate(['/tabs/manage-announcement']);  // Redirect to the protected home page
      } else {
        this.router.navigate(['/tabs/profile']);  // Redirect to the protected home page
      }
    } else {
      alert('Sila isi semua ruang');
      console.log('Sila isi semua ruang');
    }
  }

  register() {
    if (this.email && this.password && this.confirmPassword) {

      if (this.password !== this.confirmPassword) {
        alert('Kata laluan tidak sama');
        console.log('Password not same');
        this.password = '';
        this.confirmPassword = '';
      } else {
        console.log('Try to register:', this.email, this.password);
        // clear all input
        this.email = '';
        this.password = '';
        this.confirmPassword = '';
        // Here you can handle actual registration logic
        this.segment = 'login';
      }
    } else {
      alert('Sila isi semua ruangan');
      console.log('Sila isi semua ruang');
    }
  }
}
