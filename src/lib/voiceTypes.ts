export const VOICE_CATEGORIES = [
  'GREETING',
  'REACTION',
  'CELEBRATION',
  'ATTACK',
  'CAPTURE',
  'VICTORY',
  'FUN',
  'SPORTSMANSHIP',
] as const;

export type VoiceCategory = (typeof VOICE_CATEGORIES)[number];

export interface VoicePhrase {
  id: string;
  text: string;
  language: string; // 'hi' | 'en' | ...
  category: VoiceCategory;
  audioUrl?: string | null;
  icon?: string;
  characterId?: string | null;
  isActive: boolean;
  sortOrder: number;
  usageCount?: number;
}
