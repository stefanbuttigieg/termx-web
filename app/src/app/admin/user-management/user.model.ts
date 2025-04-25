export interface User {
  id: number;
  username: string;
  email: string;
  firstName?: string;
  lastName?: string;
  status: UserStatus;
  lastLogin?: string;
  emailVerified: boolean;
}

export enum UserStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  LOCKED = 'LOCKED',
  PENDING_ACTIVATION = 'PENDING_ACTIVATION'
}
