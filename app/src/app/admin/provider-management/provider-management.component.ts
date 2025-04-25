import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { AuthProvider, ProviderType } from '../../core/auth/models/auth-provider.model';
import { ProviderManagementService } from './provider-management.service';

@Component({
  selector: 'app-provider-management',
  templateUrl: './provider-management.component.html',
  styleUrls: ['./provider-management.component.scss']
})
export class ProviderManagementComponent implements OnInit {
  providers: AuthProvider[] = [];
  selectedProvider: AuthProvider | null = null;
  providerForm: FormGroup;
  configForm: FormGroup;
  isLoading = false;
  isEditing = false;
  providerTypes = Object.values(ProviderType);
  
  constructor(
    private providerService: ProviderManagementService,
    private formBuilder: FormBuilder
  ) {
    this.providerForm = this.formBuilder.group({
      providerId: ['', [Validators.required, Validators.pattern('[a-z0-9-]+')]],
      name: ['', Validators.required],
      description: [''],
      type: [ProviderType.OIDC, Validators.required],
      enabled: [true]
    });
    
    this.configForm = this.formBuilder.group({});
  }
  
  ngOnInit(): void {
    this.loadProviders();
  }
  
  loadProviders(): void {
    this.isLoading = true;
    this.providerService.getAllProviders().subscribe({
      next: (providers) => {
        this.providers = providers;
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error loading providers', error);
        this.isLoading = false;
      }
    });
  }
  
  selectProvider(provider: AuthProvider): void {
    this.selectedProvider = provider;
    this.isEditing = true;
    
    this.providerForm.patchValue({
      providerId: provider.providerId,
      name: provider.name,
      description: provider.description,
      type: provider.type,
      enabled: provider.enabled
    });
    
    this.providerForm.get('providerId')?.disable();
    this.providerForm.get('type')?.disable();
    
    this.updateConfigForm(provider.type, provider.config);
  }
  
  createNewProvider(): void {
    this.selectedProvider = null;
    this.isEditing = false;
    
    this.providerForm.reset({
      type: ProviderType.OIDC,
      enabled: true
    });
    
    this.providerForm.get('providerId')?.enable();
    this.providerForm.get('type')?.enable();
    
    this.updateConfigForm(ProviderType.OIDC);
  }
  
  onProviderTypeChange(type: ProviderType): void {
    this.updateConfigForm(type);
  }
  
  updateConfigForm(type: ProviderType, config?: Record<string, string>): void {
    // Reset config form
    this.configForm = this.formBuilder.group({});
    
    // Add fields based on provider type
    switch (type) {
      case ProviderType.OIDC:
        this.configForm = this.formBuilder.group({
          clientId: [config?.clientId || '', Validators.required],
          clientSecret: [config?.clientSecret || '', Validators.required],
          authorizationEndpoint: [config?.authorizationEndpoint || '', Validators.required],
          tokenEndpoint: [config?.tokenEndpoint || '', Validators.required],
          userInfoEndpoint: [config?.userInfoEndpoint || '', Validators.required],
          scope: [config?.scope || 'openid profile email']
        });
        break;
        
      case ProviderType.OAUTH2:
        this.configForm = this.formBuilder.group({
          clientId: [config?.clientId || '', Validators.required],
          clientSecret: [config?.clientSecret || ''],
          authorizationEndpoint: [config?.authorizationEndpoint || '', Validators.required],
          tokenEndpoint: [config?.tokenEndpoint || '', Validators.required],
          userInfoEndpoint: [config?.userInfoEndpoint || '', Validators.required],
          scope: [config?.scope || ''],
          userIdField: [config?.userIdField || 'id'],
          userEmailField: [config?.userEmailField || 'email'],
          userNameField: [config?.userNameField || 'name']
        });
        break;
        
      case ProviderType.SAML:
        this.configForm = this.formBuilder.group({
          entityId: [config?.entityId || '', Validators.required],
          metadataUrl: [config?.metadataUrl || ''],
          assertionConsumerServiceUrl: [config?.assertionConsumerServiceUrl || '', Validators.required],
          singleSignOnServiceUrl: [config?.singleSignOnServiceUrl || '', Validators.required],
          x509Certificate: [config?.x509Certificate || '']
        });
        break;
        
      case ProviderType.LDAP:
        this.configForm = this.formBuilder.group({
          url: [config?.url || '', Validators.required],
          bindDn: [config?.bindDn || ''],
          bindCredential: [config?.bindCredential || ''],
          searchBase: [config?.searchBase || '', Validators.required],
          searchFilter: [config?.searchFilter || '(uid={0})'],
          userIdAttribute: [config?.userIdAttribute || 'uid'],
          userEmailAttribute: [config?.userEmailAttribute || 'mail'],
          userFirstNameAttribute: [config?.userFirstNameAttribute || 'givenName'],
          userLastNameAttribute: [config?.userLastNameAttribute || 'sn']
        });
        break;
    }
  }
  
  saveProvider(): void {
    if (this.providerForm.invalid || this.configForm.invalid) {
      return;
    }
    
    const providerData = this.providerForm.getRawValue();
    providerData.config = this.configForm.value;
    
    this.isLoading = true;
    
    if (this.isEditing && this.selectedProvider) {
      // Update existing provider
      this.providerService.updateProvider(this.selectedProvider.id, providerData).subscribe({
        next: () => {
          this.loadProviders();
          this.selectedProvider = null;
        },
        error: (error) => {
          console.error('Error updating provider', error);
          this.isLoading = false;
        }
      });
    } else {
      // Create new provider
      this.providerService.createProvider(providerData).subscribe({
        next: () => {
          this.loadProviders();
          this.selectedProvider = null;
        },
        error: (error) => {
          console.error('Error creating provider', error);
          this.isLoading = false;
        }
      });
    }
  }
  
  toggleProviderStatus(provider: AuthProvider): void {
    this.isLoading = true;
    this.providerService.enableProvider(provider.id, !provider.enabled).subscribe({
      next: () => {
        provider.enabled = !provider.enabled;
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error toggling provider status', error);
        this.isLoading = false;
      }
    });
  }
  
  deleteProvider(provider: AuthProvider): void {
    if (confirm(`Are you sure you want to delete provider ${provider.name}?`)) {
      this.isLoading = true;
      this.providerService.deleteProvider(provider.id).subscribe({
        next: () => {
          this.loadProviders();
          if (this.selectedProvider?.id === provider.id) {
            this.selectedProvider = null;
          }
        },
        error: (error) => {
          console.error('Error deleting provider', error);
          this.isLoading = false;
        }
      });
    }
  }
  
  cancel(): void {
    this.selectedProvider = null;
    this.providerForm.reset({
      type: ProviderType.OIDC,
      enabled: true
    });
    this.updateConfigForm(ProviderType.OIDC);
  }
}
