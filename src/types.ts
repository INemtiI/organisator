export type UserRole = 'participant' | 'organizer';

export interface UserProfile {
  id: string;
  displayName: string;
  email: string;
  role: UserRole;
  photoURL?: string;
  createdAt: any;
}

export interface Event {
  id: string;
  title: string;
  description: string;
  startTime: any;
  endTime: any;
  location: string;
  type: 'session' | 'masterclass' | 'break' | 'other';
  speakerName?: string;
  maxParticipants?: number;
  currentParticipantsCount?: number;
  confirmedCount?: number;
}

export interface Registration {
  id: string;
  userId: string;
  eventId: string;
  status: 'confirmed' | 'waitlist';
  queuePosition?: number;
  timestamp: any;
}

export interface ChatMessage {
  id: string;
  userId: string;
  userName: string;
  text: string;
  timestamp: any;
}

export interface Question {
  id: string;
  eventId: string;
  userId: string;
  userName: string;
  text: string;
  votes: number;
  timestamp: any;
}

export interface Poll {
  id: string;
  question: string;
  options: string[];
  isActive: boolean;
  createdAt: any;
}

export interface Announcement {
  id: string;
  text: string;
  timestamp: any;
  authorName: string;
  type?: 'info' | 'urgent' | 'schedule';
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: 'create' | 'update' | 'delete' | 'list' | 'get' | 'write';
  path: string | null;
  authInfo: {
    userId: string;
    email: string;
    emailVerified: boolean;
    isAnonymous: boolean;
    providerInfo: { providerId: string; displayName: string; email: string; }[];
  }
}
