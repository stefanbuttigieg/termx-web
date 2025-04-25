import { Component } from '@angular/core';
import { MigrationService } from './migration.service';

@Component({
  selector: 'app-migration',
  templateUrl: './migration.component.html',
  styleUrls: ['./migration.component.scss']
})
export class MigrationComponent {
  isLoading = false;
  migrationResult: { count: number, message: string } | null = null;
  error: string | null = null;
  
  constructor(private migrationService: MigrationService) {}
  
  migrateKeycloakUsers(): void {
    if (confirm('Are you sure you want to migrate users from Keycloak? This operation cannot be undone.')) {
      this.isLoading = true;
      this.error = null;
      this.migrationResult = null;
      
      this.migrationService.migrateKeycloakUsers().subscribe({
        next: (result) => {
          this.migrationResult = result;
          this.isLoading = false;
        },
        error: (error) => {
          this.error = error.error?.message || 'An error occurred during migration';
          this.isLoading = false;
        }
      });
    }
  }
}
