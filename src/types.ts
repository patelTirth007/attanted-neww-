import { Timestamp } from './firebase';

export interface Student {
  id: string;
  uid?: string; // Firebase Auth UID
  name: string;
  rollNo: string;
  faceImage?: string; // Base64 encoded reference face image
  onLeave?: boolean; // If student is on leave
  createdAt: Timestamp;
}

export interface AttendanceSession {
  id: string;
  className: string;
  date: string; // YYYY-MM-DD
  qrToken: string;
  active: boolean;
  createdAt: Timestamp;
}

export interface AttendanceRecord {
  id: string;
  studentId: string;
  sessionId: string;
  studentName: string;
  rollNo: string;
  timestamp: Timestamp;
}

export interface UserProfile {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  role: 'teacher' | 'student';
}
