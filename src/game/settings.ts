import { GotiShape } from '@/components/board/TokenComponent';

export type BoardThemeId = 'ocean' | 'forest' | 'royal' | 'sunset';
export type GotiShapeId = GotiShape;

export interface GameSettings {
  gotiShape: GotiShapeId;
  theme: BoardThemeId;
}

export const GOTI_SHAPE_OPTIONS: { id: GotiShapeId; label: string; icon: string }[] = [
  { id: 'classic', label: 'Classic', icon: '🔵' },
  { id: 'star', label: 'Star', icon: '⭐' },
  { id: 'diamond', label: 'Diamond', icon: '🔷' },
  { id: 'gem', label: 'Gem', icon: '💎' },
];

export const THEME_OPTIONS: { id: BoardThemeId; label: string; color: string }[] = [
  { id: 'ocean', label: 'Ocean', color: '#0ea5e9' },
  { id: 'forest', label: 'Forest', color: '#22c55e' },
  { id: 'royal', label: 'Royal', color: '#a855f7' },
  { id: 'sunset', label: 'Sunset', color: '#f97316' },
];

export const DEFAULT_SETTINGS: GameSettings = {
  gotiShape: 'classic',
  theme: 'ocean',
};

const STORAGE_KEY = 'ludo_settings_v1';

export function loadSettings(): GameSettings {
  if (typeof window === 'undefined') return DEFAULT_SETTINGS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<GameSettings>;
      return { ...DEFAULT_SETTINGS, ...parsed };
    }
  } catch {
    /* ignore corrupt settings */
  }
  return DEFAULT_SETTINGS;
}

export function saveSettings(settings: GameSettings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    /* ignore */
  }
}

// Theme accent used to tint the board frame + footer
export const BOARD_THEME_ACCENT: Record<BoardThemeId, string> = {
  ocean: '#0ea5e9',
  forest: '#22c55e',
  royal: '#a855f7',
  sunset: '#f97316',
};