import { Injectable, PLATFORM_ID, Inject } from '@angular/core';
import { Socket } from 'ngx-socket-io';
import { Observable, BehaviorSubject } from 'rxjs';
import { Message } from '../models/message.interface';
import { User } from '../models/user.interface';
import { isPlatformBrowser } from '@angular/common';
import { UserService } from './user.service';

@Injectable({
  providedIn: 'root'
})
export class ChatService {
  private socket: Socket | null = null;
  private messagesSubject = new BehaviorSubject<Message[]>([]);
  private currentRoom: string | null = null;

  constructor(
    @Inject(PLATFORM_ID) private platformId: Object,
    private userService: UserService
  ) {
    if (isPlatformBrowser(this.platformId)) {
      this.initializeSocket();
    }
  }

  private initializeSocket() {
    const token = this.userService.getToken();

    this.socket = new Socket({
      url: 'http://localhost:3000',
      options: {
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
        timeout: 60000,
        autoConnect: false, // Disable autoConnect initially
        query: {
          token: token, // Pass token as query parameter
        }
      }
    });

    // Set the authentication token **before connecting**
    console.log('tokrn', token);
    // if (token) {
    //   this.socket.ioSocket.authentication = { token:token };
    // }

    console.log("Token being sent:", this.socket.ioSocket.authentication);

    this.socket.connect(); // Manually connect after setting auth

    // Listen for new messages
    this.socket.on('message', (message: Message) => {
      if (message.room === this.currentRoom) {
        const currentMessages = this.messagesSubject.value;
        this.messagesSubject.next([...currentMessages, message]);
      }
    });

    // Listen for room messages when joining
    this.socket.on('room-messages', (messages: Message[]) => {
      this.messagesSubject.next(messages);
    });

    // Handle connection events
    this.socket.on('connect', () => {
      console.log('Connected to server');
    });

    this.socket.on('connect_error', (error: Error) => {
      console.error('Connection error:', error);
    });

    this.socket.on('disconnect', (reason: string) => {
      console.log('Disconnected from server:', reason);
    });

    this.listenForErrors();
  }

  private listenForErrors() {
    if (this.socket) {
      this.socket.ioSocket.on("connect_error", (err: any) => {
        console.error("Socket connection error:", err.message);
      });
    }
  }

  getMessages(): Observable<Message[]> {
    return this.messagesSubject.asObservable();
  }

  getNewMessage(): Observable<Message> {
    return new Observable<Message>(observer => {
      if (this.socket) {
        this.socket.on('message', (message: Message) => {
          if (message.room === this.currentRoom) {
            observer.next(message);
          }
        });
      }
    });
  }

  joinRoom(roomName: string): void {
    if (this.socket) {
      if (this.currentRoom) {
        this.socket.emit('leave-room', this.currentRoom);
      }
      this.socket.emit('join-room', roomName);
      this.currentRoom = roomName;
      this.messagesSubject.next([]); // Clear messages when joining new room

      // Request room messages
      this.socket.emit('get-room-messages', roomName);
    }
  }

  sendMessage(message: Message): void {
    console.log(this.socket, this.currentRoom);
    if (this.socket && this.currentRoom) {
      const currentUser = this.userService.getCurrentUser();
      if (!currentUser) {
        console.error('No authenticated user found');
        return;
      }

      const messageWithRoom = {
        ...message,
        room: this.currentRoom,
        user: {
          _id: currentUser._id,
          username: currentUser.username,
          email: currentUser.email
        },
        timestamp: new Date(),
        type: 'text'
      };

      console.log(messageWithRoom);

      this.socket.emit('message', messageWithRoom);
    }
  }

  getCurrentRoom(): string | null {
    return this.currentRoom;
  }

  disconnect(): void {
    if (this.socket) {
      if (this.currentRoom) {
        this.socket.emit('leave-room', this.currentRoom);
      }
      this.socket.disconnect();
      this.currentRoom = null;
      this.messagesSubject.next([]);
    }
  }
} 