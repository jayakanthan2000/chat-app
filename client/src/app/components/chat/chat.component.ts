import { Component, OnInit, OnDestroy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { ChatService } from '../../services/chat.service';
import { UserService } from '../../services/user.service';
import { Message } from '../../models/message.interface';
import { User } from '../../models/user.interface';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-chat',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './chat.component.html',
  styleUrl: './chat.component.css'
})
export class ChatComponent implements OnInit, OnDestroy {
  messages: Message[] = [];
  newMessage: string = '';
  currentUser: User | null = null;
  currentRoom: string | null = null;
  newRoomName: string = '';
  availableRooms: string[] = ['General', 'Random', 'Tech', 'Gaming'];
  private messageSubscription: Subscription | null = null;

  constructor(
    private chatService: ChatService,
    private userService: UserService
  ) {}

  ngOnInit() {
    // Subscribe to user changes
    this.userService.currentUser$.subscribe(user => {
      this.currentUser = user;
      if (user) {
        this.userService.setCurrentUser(user);
      }
    });

    // Subscribe to messages
    this.messageSubscription = this.chatService.getMessages().subscribe(messages => {
      this.messages = messages;
    });

    // Check if we're already in a room
    this.currentRoom = this.chatService.getCurrentRoom();
  }

  ngOnDestroy() {
    if (this.messageSubscription) {
      this.messageSubscription.unsubscribe();
    }
  }

  joinRoom(roomName: string) {
    this.chatService.joinRoom(roomName);
    this.currentRoom = roomName;
  }

  createAndJoinRoom() {
    if (this.newRoomName.trim()) {
      this.joinRoom(this.newRoomName.trim());
      this.newRoomName = '';
    }
  }

  leaveRoom() {
    this.chatService.joinRoom(''); // This will clear the current room
    this.currentRoom = null;
  }

  sendMessage() {
    if (this.newMessage.trim() && this.currentUser && this.currentRoom) {
      const message: Message = {
        content: this.newMessage.trim(),
        timestamp: new Date(),
        user: this.currentUser,
        room: this.currentRoom
      };
      this.chatService.sendMessage(message);
      this.newMessage = '';
    }
    else{
      console.log('else');
    }
  }

  logout() {
    this.userService.logout();
  }
} 