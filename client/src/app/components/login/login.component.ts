import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { UserService } from '../../services/user.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css'
})
export class LoginComponent {
  username: string = '';
  email: string = '';
  password: string = '';

  constructor(
    private userService: UserService,
    private router: Router
  ) {}

  async login() {
    let param = {
      username: this.username.trim(), email: this.email.trim(), password: this.password.trim()
    }
    let encResult = await this.userService.noAuthPostRequest('/api/login', param);
    // Store the token
    localStorage.setItem('token', encResult.token);

    // Update the current user
    this.userService.currentUserSubject.next(encResult.user);
    this.router.navigate(['/chat']);
    if (encResult.success) {
      console.log(encResult);
    }
    else {
      console.log(encResult);
    }

  }
} 