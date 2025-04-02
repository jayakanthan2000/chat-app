import { User } from './user.interface';

export interface Message {
  _id?: string;
  content: string;
  timestamp: Date;
  user: User;
  room: string;
  type?: 'text' | 'image' | 'file';
  metadata?: any;
} 