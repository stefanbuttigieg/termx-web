import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { JwtAuthService } from '../jwt/jwt-auth.service';
import { AuthProvider } from '../models/auth-provider.model';
import { ProviderService } from '../provider/provider.service';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss']
})
export class LoginComponent implements OnInit {
  loginForm: FormGroup;
  loading = false;
  providers: AuthProvider[] = [];
  
  constructor(
    private formBuilder: FormBuilder,
    private authService: JwtAuthService,
    private providerService: ProviderService,
    private router: Router
  ) {
    this.loginForm = this.formBuilder.group({
      username: ['', Validators.required],
      password: ['', Validators.required]
    });
  }
  
  ngOnInit(): void {
    // Load external identity providers
    this.providerService.getEnabledProviders().subscribe(providers => {
      this.providers = providers;
    });
  }
  
  onSubmit(): void {
    if (this.loginForm.invalid) {
      return;
    }
    
    this.loading = true;
    const { username, password } = this.loginForm.value;
    
    this.authService.login(username, password).subscribe({
      next: () => {
        this.router.navigate(['/']);
      },
      error: () => {
        this.loading = false;
      },
      complete: () => {
        this.loading = false;
      }
    });
  }
  
  loginWithProvider(providerId: string): void {
    this.authService.loginWithProvider(providerId);
  }
}
