import type { VoicePhrase } from '@/lib/voiceTypes';

/*
 * Voice phrase / reaction system.
 *
 * There are two separate systems in the game:
 *  A) LIVE voice chat  → handled by useVoiceMic (real microphone).
 *  B) PRESET voice reactions → short taps, spoken aloud with TTS (hi-IN / en-US)
 *     or played from an uploaded admin audio clip.
 *
 * This module owns (B): a cached AudioManager, TTS playback, the built-in
 * Hindi + English phrase library and fetching the server-managed library.
 */

const AUDIO_CACHE = new Map<string, HTMLAudioElement>();

function getVoices(): SpeechSynthesisVoice[] {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return [];
  try {
    return window.speechSynthesis.getVoices();
  } catch {
    return [];
  }
}

function pickVoice(language: string): SpeechSynthesisVoice | null {
  const lang = language.toLowerCase();
  const voices = getVoices();
  return (
    voices.find((v) => v.name.toLowerCase().includes(lang)) ||
    voices.find((v) => v.lang.toLowerCase().startsWith(lang)) ||
    null
  );
}

/** Speak a phrase with TTS in the right language (browser voices, cached). */
export function speakText(text: string, language = 'hi') {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  try {
    const utterance = new SpeechSynthesisUtterance(text);
    const lang = (language || 'hi').toLowerCase().includes('en') ? 'en-US' : 'hi-IN';
    utterance.lang = lang;
    const voice = pickVoice(language);
    if (voice) utterance.voice = voice;
    utterance.rate = 1.0;
    utterance.pitch = 1.05;
    utterance.volume = 1;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  } catch {
    /* TTS unavailable — the speech bubble still conveys the line */
  }
}

/** Cached audio player — never recreates Audio objects for the same clip. */
export const voiceAudio = {
  get(url: string): HTMLAudioElement {
    let audio = AUDIO_CACHE.get(url);
    if (!audio) {
      audio = new Audio(url);
      audio.preload = 'auto';
      AUDIO_CACHE.set(url, audio);
    }
    return audio;
  },
  play(url: string) {
    try {
      const audio = this.get(url);
      audio.currentTime = 0;
      audio.play().catch(() => { });
    } catch {
      /* ignore */
    }
  },
  preload(urls: string[]) {
    urls.slice(0, 8).forEach((u) => {
      if (!AUDIO_CACHE.has(u)) {
        const a = new Audio(u);
        a.preload = 'auto';
        AUDIO_CACHE.set(u, a);
      }
    });
  },
};

/** Play a phrase: the uploaded clip when available, else TTS in its language. */
export async function playPhrase(phrase: VoicePhrase) {
  if (phrase.audioUrl) {
    voiceAudio.play(phrase.audioUrl);
  } else {
    speakText(phrase.text, phrase.language);
  }
}

/** Preload commonly used clips. */
export function preloadPhrases(phrases: VoicePhrase[]) {
  voiceAudio.preload(phrases.filter((p) => p.audioUrl).map((p) => p.audioUrl as string));
}

// ---------------------------------------------------------------------------
// Built-in library (fallback + seed when the server library is offline).
// ---------------------------------------------------------------------------

export const BUILTIN_PHRASES: VoicePhrase[] = [
  // Hindi
  { id: 'hi-chalo', text: 'चलो!', language: 'hi', category: 'GREETING', icon: '🇮🇳', sortOrder: 0, isActive: true },
  { id: 'hi-wah', text: 'अरे वाह!', language: 'hi', category: 'REACTION', icon: '🇮🇳', sortOrder: 1, isActive: true },
  { id: 'hi-kya-chal', text: 'क्या चाल चली!', language: 'hi', category: 'REACTION', icon: '🇮🇳', sortOrder: 2, isActive: true },
  { id: 'hi-ruko', text: 'रुको!', language: 'hi', category: 'REACTION', icon: '🇮🇳', sortOrder: 3, isActive: true },
  { id: 'hi-bach', text: 'बच गया!', language: 'hi', category: 'REACTION', icon: '🇮🇳', sortOrder: 4, isActive: true },
  { id: 'hi-badhiya', text: 'बहुत बढ़िया!', language: 'hi', category: 'CELEBRATION', icon: '🇮🇳', sortOrder: 5, isActive: true },
  { id: 'hi-yar', text: 'अरे यार!', language: 'hi', category: 'FUN', icon: '🇮🇳', sortOrder: 6, isActive: true },
  { id: 'hi-jeet', text: 'जीत गया!', language: 'hi', category: 'VICTORY', icon: '🏆', sortOrder: 7, isActive: true },
  { id: 'hi-chal-bhai', text: 'चल भाई!', language: 'hi', category: 'GREETING', icon: '🇮🇳', sortOrder: 8, isActive: true },
  { id: 'hi-shabash', text: 'शाबाश!', language: 'hi', category: 'CELEBRATION', icon: '🇮🇳', sortOrder: 9, isActive: true },
  { id: 'hi-kya-baat', text: 'क्या बात है!', language: 'hi', category: 'CELEBRATION', icon: '🎉', sortOrder: 10, isActive: true },
  { id: 'hi-ek-aur', text: 'एक और!', language: 'hi', category: 'FUN', icon: '🇮🇳', sortOrder: 11, isActive: true },
  { id: 'hi-acchi-chal', text: 'अच्छी चाल!', language: 'hi', category: 'SPORTSMANSHIP', icon: '👏', sortOrder: 12, isActive: true },
  { id: 'hi-oho', text: 'ओहो!', language: 'hi', category: 'REACTION', icon: '🇮🇳', sortOrder: 13, isActive: true },
  { id: 'hi-kya', text: 'क्या हुआ?', language: 'hi', category: 'REACTION', icon: '🤔', sortOrder: 14, isActive: true },
  { id: 'hi-pakda', text: 'पकड़ लिया!', language: 'hi', category: 'CAPTURE', icon: '🎯', sortOrder: 15, isActive: true },
  { id: 'hi-dekh', text: 'देख लेंगे!', language: 'hi', category: 'ATTACK', icon: '😏', sortOrder: 16, isActive: true },
  { id: 'hi-gg-hi', text: 'GG!', language: 'hi', category: 'SPORTSMANSHIP', icon: '👍', sortOrder: 17, isActive: true },

  // English
  { id: 'en-nice', text: 'Nice!', language: 'en', category: 'REACTION', icon: '🇬🇧', sortOrder: 30, isActive: true },
  { id: 'en-good', text: 'Good move!', language: 'en', category: 'SPORTSMANSHIP', icon: '🇬🇧', sortOrder: 31, isActive: true },
  { id: 'en-oops', text: 'Oops!', language: 'en', category: 'REACTION', icon: '🇬🇧', sortOrder: 32, isActive: true },
  { id: 'en-lgo', text: "Let's go!", language: 'en', category: 'GREETING', icon: '🇬🇧', sortOrder: 33, isActive: true },
  { id: 'en-gg', text: 'GG!', language: 'en', category: 'SPORTSMANSHIP', icon: '🇬🇧', sortOrder: 34, isActive: true },
  { id: 'en-wow', text: 'Wow!', language: 'en', category: 'REACTION', icon: '🇬🇧', sortOrder: 35, isActive: true },
];

// ---------------------------------------------------------------------------
// Server-managed library (admin voice packs)
// ---------------------------------------------------------------------------

export async function fetchVoiceLibrary(): Promise<VoicePhrase[]> {
  try {
    const res = await fetch('/api/voice', { cache: 'no-store' });
    if (!res.ok) return BUILTIN_PHRASES;
    const data = await res.json();
    const remote: VoicePhrase[] = data.phrases || [];
    // The admin library replaces the built-ins when it exists.
    return remote.length > 0 ? remote : BUILTIN_PHRASES;
  } catch {
    return BUILTIN_PHRASES;
  }
}
