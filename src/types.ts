/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface OnboardingAnswers {
  destination: string;
  travelDates: string;
  vibe: 'culture' | 'nightlife' | 'chill' | 'adventure' | 'all';
  travelStyle: 'budget' | 'boutique' | 'luxury';
  interests: string[];
}

export interface ItineraryItem {
  id: string;
  day: number;
  timeOfDay: 'Morning' | 'Afternoon' | 'Evening' | 'Night';
  activity: string;
  description: string;
  location: string;
  costEstimate: string;
  gayFriendlyRating: number; // 1-5 rating
  category: 'restaurant' | 'nightlife' | 'sightseeing' | 'experience' | 'relaxation';
}

export interface DestinationItinerary {
  id: string;
  destination: string;
  tagline: string;
  summary: string;
  days: ItineraryItem[];
}

export interface FlightUpdate {
  id: string;
  flightNumber: string;
  airline: string;
  origin: string;
  destination: string;
  scheduledTime: string;
  status: 'Scheduled' | 'Boarding' | 'Departed' | 'On Time' | 'Delayed' | 'Landed';
  gate: string;
  terminal: string;
  lastUpdated: string;
}

export interface SafetyZone {
  id: string;
  title: string;
  address: string;
  coords: { x: number; y: number }; // Simulated percentage-based coordinates for interactive offline-looking custom vector maps
  category: 'Bar/Nightclub' | 'Cultural Center' | 'Cruising Area' | 'General Area' | 'Sauna';
  safetyScore: number; // 1 to 10
  crowdLevel: 'Low' | 'Moderate' | 'Vibrant' | 'Overcrowded';
  verificationCount: number;
  tags: string[];
  reviews: { id: string; user: string; avatar: string; text: string; date: string; isVerified: boolean; rating: number }[];
}

export interface LocalGuide {
  id: string;
  name: string;
  location: string;
  languages: string[];
  bio: string;
  avatar: string;
  rating: number;
  experienceCount: number;
  interests: string[];
  online: boolean;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  receiverId: string;
  text: string;
  timestamp: string; // ISO string
}

export interface MemberPost {
  id: string;
  author: {
    name: string;
    avatar: string;
    location: string;
    verified: boolean;
  };
  imageUrl: string;
  caption: string;
  likesCount: number;
  commentsCount: number;
  hasLiked?: boolean;
  locationsRecommended: string[];
  date: string;
}

export interface Experience {
  id: string;
  title: string;
  price: number;
  category: 'tickets' | 'tours' | 'postcards' | 'souvenirs';
  description: string;
  imageUrl: string;
  details?: string;
}

export interface Booking {
  id: string;
  itemTitle: string;
  totalPrice: number;
  bookingDate: string;
  status: 'Confirmed' | 'Pending';
  photoUploaded?: string; // used for custom souvenirs like accessories or postcards
}

export interface BucketListItem {
  id: string;
  title: string;
  destination: string;
  completed: boolean;
}
