'use client';

import React, { useId } from 'react';
import { PlayerColor } from '@/game/engine/types';
import { getCharacter, CharacterConfig } from '@/game/characters';

export type TokenExpression = 'idle' | 'happy' | 'excited' | 'attacking' | 'hurt' | 'home' | 'win';

/*
 * Original SVG character family — four cute creatures drawn with the same
 * base proportions, soft 3D shading and consistent rendering style:
 *  - fox   (red)
 *  - panda (green)
 *  - tiger (yellow)
 *  - cat   (blue)
 *
 * Shared by tokens, avatars, the profile sheet and the leaderboard so every
 * representation of a character stays pixel-identical.
 *
 * NOTE: every SVG instance uses UNIQUE gradient ids (via useId) so multiple
 * tokens on the board never resolve url(#…) to another hidden copy of the
 * same gradient — that previously left some gotis transparent.
 */
export const CharacterArt: React.FC<{
  color: PlayerColor;
  expression?: TokenExpression;
  className?: string;
}> = ({ color, expression = 'idle', className = '' }) => {
  const rawUid = useId();
  const uid = rawUid.replace(/[^a-zA-Z0-9]/g, '');
  const ids = {
    body: `g-body-${color}-${uid}`,
    shine: `g-shine-${color}-${uid}`,
    ear: `g-ear-${color}-${uid}`,
  };

  const cfg: CharacterConfig = getCharacter(color);
  const { primary, secondary, accent, skin } = cfg;

  const happy =
    expression === 'happy' || expression === 'excited' || expression === 'home' || expression === 'win';
  const attacking = expression === 'attacking';
  const hurt = expression === 'hurt';
  const worried = attacking || hurt;

  const eyeY = happy ? 46 : 48;
  const eyeRX = happy ? 3.5 : 3;
  const eyeRY = happy ? 5 : 4.5;
  const mouthPath = happy
    ? 'M 46 58 Q 50 65 54 58'
    : worried
      ? 'M 47 60 Q 50 57 53 60'
      : 'M 47 58 Q 50 62 53 58';

  return (
    <svg viewBox="0 0 100 100" className={`w-full h-full block ${className}`} aria-hidden>
      <defs>
        <linearGradient id={ids.body} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={secondary} />
          <stop offset="100%" stopColor={primary} />
        </linearGradient>
        <radialGradient id={ids.shine} cx="0.32" cy="0.22" r="0.8">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={ids.ear} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={primary} />
          <stop offset="100%" stopColor={accent} />
        </linearGradient>
      </defs>

      {/* soft contact shadow */}
      <ellipse cx="50" cy="90" rx="26" ry="5" fill="#000" opacity="0.18" />

      {/* ears */}
      {color === 'red' && (
        <>
          <path d="M 30 24 L 22 6 L 42 16 Z" fill={`url(#${ids.ear})`} />
          <path d="M 70 24 L 78 6 L 58 16 Z" fill={`url(#${ids.ear})`} />
          <path d="M 30 21 L 26 10 L 38 15 Z" fill="#FFD0C2" opacity="0.8" />
          <path d="M 70 21 L 74 10 L 62 15 Z" fill="#FFD0C2" opacity="0.8" />
        </>
      )}
      {color === 'green' && (
        <>
          <circle cx="28" cy="24" r="12" fill={`url(#${ids.ear})`} />
          <circle cx="72" cy="24" r="12" fill={`url(#${ids.ear})`} />
          <circle cx="28" cy="24" r="6" fill="#9BE8C9" />
          <circle cx="72" cy="24" r="6" fill="#9BE8C9" />
        </>
      )}
      {color === 'yellow' && (
        <>
          <circle cx="28" cy="24" r="12" fill={`url(#${ids.ear})`} />
          <circle cx="72" cy="24" r="12" fill={`url(#${ids.ear})`} />
          <circle cx="28" cy="24" r="5.5" fill="#FFEDB0" />
          <circle cx="72" cy="24" r="5.5" fill="#FFEDB0" />
        </>
      )}
      {color === 'blue' && (
        <>
          <path d="M 30 26 L 22 6 L 40 18 Z" fill={`url(#${ids.ear})`} />
          <path d="M 70 26 L 78 6 L 60 18 Z" fill={`url(#${ids.ear})`} />
          <path d="M 30 23 L 26 11 L 37 17 Z" fill="#C9DFFF" opacity="0.9" />
          <path d="M 70 23 L 74 11 L 63 17 Z" fill="#C9DFFF" opacity="0.9" />
        </>
      )}

      {/* body */}
      <circle cx="50" cy="52" r="34" fill={`url(#${ids.body})`} />
      {/* bright rim + dark contour so the character clearly separates from the
          board (especially on red-on-red cells) */}
      <circle cx="50" cy="52" r="34" fill="none" stroke="rgba(255,255,255,0.34)" strokeWidth="2.2" />
      <circle cx="50" cy="52" r="34" fill="none" stroke="#121a2b" strokeOpacity="0.5" strokeWidth="1.6" />

      {/* blush cheeks */}
      <circle cx="32" cy="55" r="5" fill="#FF9D9D" opacity="0.5" />
      <circle cx="68" cy="55" r="5" fill="#FF9D9D" opacity="0.5" />

      {/* muzzle */}
      <ellipse cx="50" cy="55" rx="17" ry="12" fill={skin} opacity="0.92" />

      {/* nose */}
      <ellipse cx="50" cy="52" rx="3.4" ry="2.6" fill={accent} />

      {/* eyes */}
      {worried ? (
        <>
          <path d="M 30 48 q 5 -6 10 0" stroke={accent} strokeWidth="2.6" fill="none" strokeLinecap="round" />
          <path d="M 60 48 q 5 -6 10 0" stroke={accent} strokeWidth="2.6" fill="none" strokeLinecap="round" />
        </>
      ) : (
        <>
          <ellipse cx="34" cy={eyeY} rx={eyeRX} ry={eyeRY} fill={accent} />
          <ellipse cx="66" cy={eyeY} rx={eyeRX} ry={eyeRY} fill={accent} />
          <circle cx="35.2" cy={eyeY - 1.4} r="1.1" fill="#fff" />
          <circle cx="67.2" cy={eyeY - 1.4} r="1.1" fill="#fff" />
        </>
      )}

      {/* mouth */}
      <path d={mouthPath} stroke={accent} strokeWidth="2.4" fill="none" strokeLinecap="round" />

      {/* tiger stripes */}
      {color === 'yellow' && (
        <>
          <path d="M 42 30 q 4 4 0 7" stroke={accent} strokeWidth="2.6" fill="none" opacity="0.5" />
          <path d="M 50 29 q 4 4 0 7" stroke={accent} strokeWidth="2.6" fill="none" opacity="0.5" />
          <path d="M 58 30 q 4 4 0 7" stroke={accent} strokeWidth="2.6" fill="none" opacity="0.5" />
        </>
      )}

      {/* fox whiskers */}
      {color === 'red' && (
        <>
          <line x1="22" y1="53" x2="34" y2="55" stroke="#FFD0C2" strokeWidth="1.6" strokeLinecap="round" />
          <line x1="66" y1="55" x2="78" y2="53" stroke="#FFD0C2" strokeWidth="1.6" strokeLinecap="round" />
        </>
      )}

      {/* cat whiskers */}
      {color === 'blue' && (
        <>
          <line x1="24" y1="52" x2="36" y2="54" stroke="#C9DFFF" strokeWidth="1.6" strokeLinecap="round" />
          <line x1="64" y1="54" x2="76" y2="52" stroke="#C9DFFF" strokeWidth="1.6" strokeLinecap="round" />
          <line x1="24" y1="58" x2="36" y2="57" stroke="#C9DFFF" strokeWidth="1.6" strokeLinecap="round" />
          <line x1="64" y1="57" x2="76" y2="58" stroke="#C9DFFF" strokeWidth="1.6" strokeLinecap="round" />
        </>
      )}

      {/* gloss */}
      <circle cx="50" cy="52" r="34" fill={`url(#${ids.shine})`} />
    </svg>
  );
};

export default CharacterArt;