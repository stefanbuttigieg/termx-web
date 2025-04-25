import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { JwtAuthService } from '../jwt/jwt-auth.service';

@Component({
  selector: 'app-callback',
  template: `
    <div class="callback-container">
      <div class="spinner-border text-primary" role="status">
        <span class="visually-hidden">Loading...</span>
      </div>
      <p>Completing authentication, please wait...</p>
    </div>
  `,
  styles: [`
    .callback-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100vh;
      gap: 1rem;
    }
  `]
})
export class CallbackComponent implements OnInit {
  
  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private authService: JwtAuthService
  ) {}
  
  ngOnInit(): void {
    // Get the code and state from the URL
    this.route.queryParams.subscribe(params => {
      const code = params['code'];
      const providerId = params['state']?.split(':')[0]; // Assuming state format is "providerId:randomString"
      
      if (code && providerId) {
        this.authService.handleProviderCallback(providerId, code).subscribe({
          next: () => {
            // Redirect to home or stored redirect URL
            const redirectUrl = sessionStorage.getItem('__termx-redirect_origin_url') || '/';
            sessionStorage.removeItem('__termx-redirect_origin_url');
            this.router.navigateByUrl(redirectUrl);
          },
          error: () => {
            this.router.navigate(['/login']);
          }
        });
      } else {
        this.router.navigate(['/login']);
      }
    });
  }
}
