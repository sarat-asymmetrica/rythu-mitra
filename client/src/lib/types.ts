/**
 * Domain types for Rythu Mitra.
 * Matches the F001 STDB schema. Using mock data until F001 module is published.
 */

// --- Enums ---

export type MoneyEventKind =
  | 'labor'
  | 'seeds'
  | 'fertilizer'
  | 'irrigation'
  | 'transport'
  | 'crop_sale'
  | 'govt_subsidy'
  | 'other';

export type CropEventKind =
  | 'sowing'
  | 'irrigation'
  | 'fertilizer'
  | 'pesticide'
  | 'inspection'
  | 'harvest'
  | 'sale';

export type Season = 'kharif' | 'rabi' | 'zaid';

export type IrrigationType =
  | 'borewell'
  | 'canal'
  | 'rain'
  | 'drip';

export type CropStage =
  | 'seed'       // విత్తు
  | 'plant'      // నాటు
  | 'growth'     // పెరుగుదల
  | 'harvest'    // కోత
  | 'sale';      // అమ్మకం

// --- Entities ---

export interface Farmer {
  id: string;
  name: string;
  phone: string;
  village: string;
  district: string;
  acreage: number;
}

export interface MoneyEvent {
  id: string;
  farmerId: string;
  kind: MoneyEventKind;
  amount: number;        // in rupees (positive = income, negative = expense)
  description: string;
  category: string;      // Telugu display name
  date: string;          // ISO date
  time: string;          // HH:mm display
  voiceOriginal?: string;
}

export interface CropEvent {
  id: string;
  farmerId: string;
  cropFieldId: string;
  kind: CropEventKind;
  title: string;
  body: string;
  date: string;
  photos: string[];       // photo URIs
  badge?: string;         // e.g. "✓ వేప నూనె పిచికారీ చేయబడింది"
}

export interface CropField {
  id: string;
  farmerId: string;
  name: string;          // e.g. "పొలం 1 — వేరుశెనగ"
  crop: string;
  acreage: number;
  village: string;
  district: string;
  season: Season;
  currentStage: CropStage;
  sowingDate: string;
  expectedHarvest: string;
  healthStatus: 'good' | 'warning' | 'critical';
  totalInvestment: number;
}

export interface MarketPrice {
  id: string;
  crop: string;
  mandiName: string;
  price: number;          // per quintal
  msp: number;
  distanceKm: number;
  transportCost: number;
  timestamp: string;
}

export interface PestAlert {
  id: string;
  cropFieldId: string;
  pestName: string;
  impactPercent: number;
  treatment: string;
  treatmentDone: boolean;
  nextInspection: string;
}

export interface GovtScheme {
  id: string;
  name: string;
  lastInstallment: string;
  lastAmount: number;
  nextExpected: string;
  status: 'pending' | 'received' | 'overdue';
}

// --- Screen-specific data shapes ---

export interface BriefingCard {
  id: string;
  accent: 'market' | 'govt' | 'crop' | 'alert' | 'money';
  icon: string;
  title: string;
  body: string;
  meta: string;
  speakText?: string;
  priceCompare?: { name: string; price: number; color: string; height: number }[];
}

export interface TransactionGroup {
  dateLabel: string;
  items: MoneyEvent[];
}

export interface DonutSegment {
  label: string;
  value: number;
  color: string;
  percent: number;
}

export interface MandiRow {
  name: string;
  price: number;
  distanceKm: number;
  transportCost: number;
  badge?: 'nearest' | 'best-price';
  barWidth: number;  // percentage
}

export type ScreenName = 'home' | 'dabbu' | 'market' | 'panta' | 'learn' | 'settings';
