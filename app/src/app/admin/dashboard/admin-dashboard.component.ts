import { Component } from '@angular/core';

@Component({
  selector: 'app-admin-dashboard',
  templateUrl: './admin-dashboard.component.html',
  styleUrls: ['./admin-dashboard.component.scss']
})
export class AdminDashboardComponent {
  adminModules = [
    {
      title: 'User Management',
      description: 'Manage users, roles, and privileges',
      icon: 'users',
      route: '/admin/users',
      privilege: 'admin.user.view'
    },
    {
      title: 'Identity Providers',
      description: 'Configure external authentication providers',
      icon: 'key',
      route: '/admin/providers',
      privilege: 'admin.provider.view'
    },
    {
      title: 'Migration',
      description: 'Migrate users from Keycloak',
      icon: 'exchange-alt',
      route: '/admin/migration',
      privilege: 'admin.migration.execute'
    }
  ];
}
