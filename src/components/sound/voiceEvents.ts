// Tiny pub/sub so the mic in the profile sheet can tell the rest of the
// game UI "the player is / is not speaking right now".

type SpeakingListener = (speaking: boolean) => void;

const listeners = new Set<SpeakingListener>();
let currentlySpeaking = false;
let isActive = false;

export const voiceEngine = {
  /** Enable / disable speaking detection (tied to the local mic). */
  setActive(active: boolean) {
    isActive = active;
    if (!active) {
      currentlySpeaking = false;
      listeners.forEach((fn) => fn(false));
    }
  },

  setSpeaking(speaking: boolean) {
    if (!isActive) return;
    if (speaking === currentlySpeaking) return;
    currentlySpeaking = speaking;
    listeners.forEach((fn) => fn(speaking));
  },

  isSpeaking() {
    return currentlySpeaking;
  },

  isActive() {
    return isActive;
  },

  subscribe(fn: SpeakingListener): () => void {
    listeners.add(fn);
    fn(currentlySpeaking);
    return () => {
      listeners.delete(fn);
    };
  },
};

export default voiceEngine;