import firebase from 'firebase/compat/app';
import 'firebase/compat/firestore';

// --- CORE DATA MODELS ---

export interface UserProfile {
  uid: string;
  email: string | null;
  displayName?: string | null;
  createdAt: string;
}

export interface Trip {
  id: string;
  ownerUid: string;
  title: string;
  startDate: string;
  endDate: string;
  baseCurrency: string;
  allowedEmails: string[];
  noticeBoard?: string;
  createdAt: string;
}

export interface TripMember {
  uid: string;
  email: string;
  role: 'owner' | 'editor';
  nickname?: string;
  createdAt: string;
}

// --- APP NAVIGATION ---

export enum AppTab {
  Schedule = 'schedule',
  Bookings = 'bookings',
  Expenses = 'expenses',
  Members = 'members',
  Planning = 'planning',
  // Journal removed
}

// --- FEATURE-SPECIFIC TYPES ---

export type ScheduleType = 'sightseeing' | 'food' | 'transport' | 'hotel' | 'flight';
export type ThemeColor = 'blue' | 'green' | 'orange';

export interface FlightDetails {
  flightNumber: string;
  airline?: string;
  terminal?: string;
  gate?: string;
  seat?: string;
  origin: string;
  destination: string;
  arrivalTime?: string;
  arrivalDate?: string;
  bookingReference?: string;
  checkInTime?: string;
  baggageAllowanceKg?: string;
  status?: string;
  lastUpdated?: string;
}

export interface ScheduleItem {
  id: string;
  type: ScheduleType;
  title: string;
  date: string;
  time: string;
  endDate?: string;
  endTime?: string;
  participants?: string[];
  themeColor?: ThemeColor;
  flightDetails?: FlightDetails;
  notes?: string;
  locationLink?: string;
  createdAt?: any;
  createdBy?: string;
}

export interface Transaction {
  id: string;
  tripId: string;
  type: 'expense' | 'settlement';
  title: string;
  amount: number;
  currency: 'JPY' | 'HKD';
  paidBy: string;
  splitAmong: string[];
  date: string;
  createdAt: string;
  createdBy?: string;
}

// --- LOGGING ---

export type LogCategory = 'plan' | 'booking' | 'expense' | 'member';

export interface LogEntry {
  id: string;
  tripId: string;
  timestamp: string; // ISO string
  category: LogCategory;
  action: 'create' | 'update' | 'delete';
  title: string;
  details: string;
  userUid: string;
  userName: string;
}
