export interface User {
  _id: string;
  username: string;
  email: string;
  isOnline?: boolean;
  lastSeen?: Date;
  createdAt?: Date;
} 