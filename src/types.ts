// FIX: Add compat imports to define firebase types.
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
  id: string; // Document ID
  ownerUid: string;
  title: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  baseCurrency: string;
  allowedEmails: string[];
  createdAt: string;
}

export interface TripMember {
  uid: string; // Corresponds to user's auth UID
  email: string;
  role: 'owner' | 'editor';
  nickname?: string;
  createdAt: string;
}


// --- FEATURE-SPECIFIC TYPES ---

export type ScheduleType = 'sightseeing' | 'food' | 'transport' | 'hotel' | 'flight';

export interface FlightDetails {
  flightNumber: string;
  airline?: string;
  terminal?: string;
  gate?: string;
  seat?: string;
  origin: string; // Airport Code
  destination: string; // Airport Code
  arrivalTime?: string; // HH:mm
  arrivalDate?: string; // YYYY-MM-DD
  bookingReference?: string;
  checkInTime?: string;
  baggageAllowanceKg?: string;
  status?: string; // e.g. 'On Time', 'Delayed'
  lastUpdated?: string;
}

export interface ScheduleItem {
  id: string; // Document ID
  date: string; // YYYY-MM-DD (Start Date / Departure Date for flights)
  time: string; // HH:mm (Start Time / Departure Time for flights)
  endDate?: string; // YYYY-MM-DD (End Date / Check-out Date)
  endTime?: string; // HH:mm (Optional End Time)
  type: ScheduleType;
  title: string;
  locationLink?: string;
  notes?: string;
  participants?: string[]; // Array of emails
  flightDetails?: FlightDetails;
  createdAt?: firebase.firestore.FieldValue; // serverTimestamp
}

export interface TodoItem {
  id: string; // Document ID
  type: 'packing' | 'shopping' | 'general';
  text: string;
  assignedToUid: string | 'all';
  done: boolean;
  createdAt: string;
}


// --- APPLICATION UI TYPES ---

export enum AppTab {
  Schedule = 'schedule',
  Bookings = 'bookings',
  Expenses = 'expenses',
  Journal = 'journal',
  Planning = 'planning',
  Members = 'members',
}