import { Component } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-forgot-password',
  templateUrl: './forgot-password.page.html',
  styleUrls: ['./forgot-password.page.scss'],
})
export class ForgotPasswordPage {

  constructor(private router: Router) { }

  email: string = '';

  async resetPassword() {
    if (this.email) {
      // Handle password reset logic
      console.log('Password reset request for:', this.email);
      alert('Pautan reset kata laluan telah dihantar ke ' + this.email);
      this.router.navigate(['/tabs/authentication']);
    } else {
      console.log('Please enter your email address');
      alert('Sila masukkan alamat e-mel anda.');
    }
  }

}
