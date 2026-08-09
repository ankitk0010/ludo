import { PlayerColor } from '@/game/engine/types';

export type CharacterId = 'fox' | 'cat' | 'panda' | 'tiger';

export interface CharacterConfig {
  id: CharacterId;
  color: PlayerColor;
  name: string;
  title: string;
  emoji: string;
  primary: string;
  secondary: string;
  accent: string;
  skin: string;
  homeMotif: 'leaf' | 'bamboo' | 'sun' | 'moon';
  homeTint: string;
}

// Centralized character + color system. Kept separate from game logic.
export const CHARACTERS: Record<PlayerColor, CharacterConfig> = {
  red: {
    id: 'fox',
    color: 'red',
    name: 'Red',
    title: 'Sunset Fox',
    emoji: '🦊',
    primary: '#FF6B6B',
    secondary: '#FF9E7D',
    accent: '#2E2A35',
    skin: '#FFF3E0',
    homeMotif: 'leaf',
    homeTint: '#FFE4E6',
  },
  green: {
    id: 'panda',
    color: 'green',
    name: 'Green',
    title: 'Bamboo Panda',
    emoji: '🐼',
    primary: '#38D39F',
    secondary: '#6FE8C0',
    accent: '#1F3D2B',
    skin: '#F3FFF9',
    homeMotif: 'bamboo',
    homeTint: '#D1FAE5',
  },
  yellow: {
    id: 'tiger',
    color: 'yellow',
    name: 'Yellow',
    title: 'Golden Tiger',
    emoji: '🐯',
    primary: '#FFC857',
    secondary: '#FFE08A',
    accent: '#4A3000',
    skin: '#FFF7E0',
    homeMotif: 'sun',
    homeTint: '#FEF3C7',
  },
  blue: {
    id: 'cat',
    color: 'blue',
    name: 'Blue',
    title: 'Dreamy Cat',
    emoji: '🐱',
    primary: '#3B82F6',
    secondary: '#7FB6FF',
    accent: '#162A4A',
    skin: '#EFF6FF',
    homeMotif: 'moon',
    homeTint: '#DBEAFE',
  },
};

export function getCharacter(color: PlayerColor): CharacterConfig {
  return CHARACTERS[color];
}

export const CHARACTER_IDS: CharacterId[] = ['fox', 'panda', 'tiger', 'cat'];
export const CHARACTER_LIST: CharacterConfig[] = [
  CHARACTERS.red,
  CHARACTERS.green,
  CHARACTERS.yellow,
  CHARACTERS.blue,
];