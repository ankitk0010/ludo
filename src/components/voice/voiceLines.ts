// Pre-loaded voice lines — the in-game quick chatter, BGMI style.
// Each line has text (spoken aloud with the browser TTS voice) and an emoji.

export interface VoiceLine {
  id: string;
  text: string;
  emoji: string;
}

export const VOICE_LINES: VoiceLine[] = [
  { id: 'go', text: 'Let\'s go! Let\'s go!', emoji: '🔥' },
  { id: 'nice', text: 'Nice move!', emoji: '👏' },
  { id: 'gg', text: 'GG everybody, GG!', emoji: '👍' },
  { id: 'hurry', text: 'Hurry up! Hurry up!', emoji: '⏳' },
  { id: 'goodluck', text: 'Good luck, good luck!', emoji: '🍀' },
  { id: 'wow', text: 'Wow! I didn\'t see that coming!', emoji: '😲' },
  { id: 'oops', text: 'Oops! My bad!', emoji: '🙈' },
  { id: 'lol', text: 'Hahaha, too funny!', emoji: '😂' },
  { id: 'attack', text: 'Watch out, I\'m coming through!', emoji: '💥' },
  { id: 'cover', text: 'Give me a shield!', emoji: '🛡️' },
  { id: 'six', text: 'Yes! A six!', emoji: '✨' },
  { id: 'lone', text: 'Eliminated!', emoji: '🎯' },
];

// Shorty one-liners bots occasionally reply with (only ever after the player speaks,
// and never more than roughly every few seconds — keeps it quiet).
export const BOT_VOICE_REPLIES: VoiceLine[] = [
  { id: 'b-nice', text: 'Nice move! GG!', emoji: '😎' },
  { id: 'b-hurry', text: 'Hurry up, hurry up!', emoji: '⏳' },
  { id: 'b-gg', text: 'GG, GG!', emoji: '👍' },
  { id: 'b-go', text: 'Let\'s go! Let\'s go!', emoji: '🔥' },
  { id: 'b-wow', text: 'Wow, what a play!', emoji: '😲' },
];

// Best Available Voices (browser-provided TTS) for the pre-loaded lines.
export function getVoices(): SpeechSynthesisVoice[] {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return [];
  try {
    return window.speechSynthesis.getVoices();
  } catch {
    return [];
  }
}

export function speakLine(line: string, voiceName?: string | null) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  try {
    const utterance = new SpeechSynthesisUtterance(line);
    const voices = getVoices();
    if (voiceName) {
      const chosen = voices.find((v) => v.name === voiceName) || voices.find((v) => v.name.includes('English'));
      if (chosen) utterance.voice = chosen;
    }
    utterance.lang = 'en-US';
    utterance.rate = 1.05;
    utterance.pitch = 1.05;
    utterance.volume = 1;
    window.speechSynthesis.speak(utterance);
  } catch {
    /* TTS unavailable — the bubble still conveys the line */
  }
}