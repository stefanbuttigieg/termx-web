export interface AuthProvider {
  id: number;
  providerId: string;
  name: string;
  description?: string;
  type: ProviderType;
  enabled: boolean;
  config?: Record<string, string>;
}

export enum ProviderType {
  OIDC = 'OIDC',
  OAUTH2 = 'OAUTH2',
  SAML = 'SAML',
  LDAP = 'LDAP',
  CUSTOM = 'CUSTOM'
}
