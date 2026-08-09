/*
 * Preset avatar images players can pick from (in addition to uploading their
 * own). Each is a tiny inline SVG data-URI — no network needed, renders as a
 * normal <img> anywhere the avatar image is expected.
 */
function emojiAvatar(emoji: string, from: string, to: string): string {
  return `data:image/svg+xml;utf8,${encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='100' height='100'>` +
      `<defs><linearGradient id='a' x1='0' y1='0' x2='1' y2='1'>` +
      `<stop offset='0' stop-color='${from}'/><stop offset='1' stop-color='${to}'/></linearGradient></defs>` +
      `<rect width='100' height='100' rx='50' fill='url(#a)'/>` +
      `<circle cx='50' cy='50' r='44' fill='rgba(255,255,255,0.08)'/>` +
      `<text x='50' y='66' font-size='52' text-anchor='middle'>${emoji}</text>` +
      `</svg>`
  )}`;
}

export interface PresetAvatar {
  id: string;
  label: string;
  data: string;
}

/** True when a stored avatar value is an image (data-URI or http(s) URL). */
export function isImageAvatar(v: string | null | undefined): v is string {
  if (!v) return false;
  return v.startsWith('data:image/') || v.startsWith('http://') || v.startsWith('https://') || v.startsWith('blob:');
}

export const PRESET_AVATARS: PresetAvatar[] = [
  { id: 'fox', label: 'Fox', data: emojiAvatar('🦊', '#b03a52', '#5c1230') },
  { id: 'panda', label: 'Panda', data: emojiAvatar('🐼', '#1c7a56', '#0a3a2a') },
  { id: 'tiger', label: 'Tiger', data: emojiAvatar('🐯', '#c07a1e', '#5c2e08') },
  { id: 'cat', label: 'Cat', data: emojiAvatar('🐱', '#2f6fc0', '#12305c') },
  { id: 'lion', label: 'Lion', data: emojiAvatar('🦁', '#a06a20', '#4a2c06') },
  { id: 'frog', label: 'Frog', data: emojiAvatar('🐸', '#1f8a64', '#0a4530') },
  { id: 'penguin', label: 'Penguin', data: emojiAvatar('🐧', '#3a5a8c', '#14283f') },
  { id: 'dino', label: 'Dino', data: emojiAvatar('🦖', '#4a7a3a', '#14312c') },
];