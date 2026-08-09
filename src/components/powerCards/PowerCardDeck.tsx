'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { PowerCardType } from '@/game/engine/types';
import { POWER_CARD_DEFINITIONS } from '@/game/engine/constants';
import { soundEngine } from '../sound/soundEngine';

interface PowerCardDeckProps {
  availableCards: PowerCardType[];
  isMyTurn: boolean;
  onUseCard: (cardType: PowerCardType) => void;
  onSelectLuckyRoll?: (value: number) => void;
  onCancelLuckyRoll?: () => void;
  pendingLuckyRoll?: boolean;
}

export const PowerCardDeck: React.FC<PowerCardDeckProps> = ({
  availableCards,
  isMyTurn,
  onUseCard,
  onSelectLuckyRoll,
  onCancelLuckyRoll,
  pendingLuckyRoll,
}) => {
  const [showLuckyRollModal, setShowLuckyRollModal] = useState(false);

  const openLuckyRoll = () => setShowLuckyRollModal(true);
  const closeLuckyRoll = useCallback(() => {
    setShowLuckyRollModal(false);
    onCancelLuckyRoll?.();
  }, [onCancelLuckyRoll]);

  // Close on Escape
  useEffect(() => {
    if (!showLuckyRollModal && !pendingLuckyRoll) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeLuckyRoll();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [showLuckyRollModal, pendingLuckyRoll, closeLuckyRoll]);

  const handleCardClick = (cardType: PowerCardType) => {
    if (!isMyTurn) return;
    soundEngine.playPowerCard();

    if (cardType === 'lucky_roll') {
      openLuckyRoll();
      onUseCard(cardType);
    } else {
      onUseCard(cardType);
    }
  };

  const handlePickLuckyValue = (val: number) => {
    setShowLuckyRollModal(false);
    if (onSelectLuckyRoll) {
      onSelectLuckyRoll(val);
    }
  };

  return (
    <div className="flex flex-col gap-1.5 w-full select-none">
      {/* Header */}
      <div className="flex items-center justify-between px-0.5">
        <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1">
          <span>🃏</span> POWER CARDS
        </span>
        <span
          className={`text-[9px] font-black px-1.5 py-0.5 rounded-full border ${
            availableCards.length > 0 ? 'bg-purple-500/15 text-purple-300 border-purple-500/40' : 'bg-slate-800 text-slate-500 border-slate-700'
          }`}
        >
          {availableCards.length}
        </span>
      </div>

      {/* Cards — horizontal scroll on mobile, wrapping grid on desktop */}
      <div className="overflow-x-auto -mx-0.5 px-0.5 pb-0.5 sm:overflow-visible sm:pb-0">
        <div className="flex sm:grid sm:grid-cols-5 gap-1.5 w-max sm:w-full min-w-full">
          {availableCards.map((cardType, idx) => {
            const cardInfo = POWER_CARD_DEFINITIONS[cardType];
            if (!cardInfo) return null;

            return (
              <motion.button
                key={`${cardType}-${idx}`}
                whileHover={isMyTurn ? { scale: 1.06, y: -2 } : {}}
                whileTap={isMyTurn ? { scale: 0.94 } : {}}
                onClick={() => handleCardClick(cardType)}
                disabled={!isMyTurn}
                title={`${cardInfo.name}: ${cardInfo.description}`}
                style={{
                  borderColor: isMyTurn ? cardInfo.color : 'rgba(51,65,85,0.6)',
                }}
                className={`shrink-0 w-14 sm:w-full flex-1 min-w-0 sm:min-w-0 bg-slate-900/90 border rounded-lg p-1 flex flex-col items-center justify-center text-center gap-0.5 transition-all shadow-sm ${
                  isMyTurn
                    ? 'cursor-pointer hover:shadow-purple-500/20 hover:bg-slate-800'
                    : 'opacity-40 cursor-not-allowed'
                }`}
              >
                <div className="text-sm leading-none">{cardInfo.icon}</div>
                <div className="text-[8px] sm:text-[9px] font-black text-white leading-tight truncate w-full">
                  {cardInfo.name}
                </div>
                <div
                  className="text-[7px] font-black uppercase leading-none"
                  style={{ color: isMyTurn ? cardInfo.color : '#64748b' }}
                >
                  ● 1
                </div>
              </motion.button>
            );
          })}

          {availableCards.length === 0 && (
            <div className="col-span-full py-1 text-center text-[10px] text-slate-500 italic w-full">
              No power cards available
            </div>
          )}
        </div>
      </div>

      {/* Lucky Roll Selector Modal — portaled so it always centers on the viewport */}
      {typeof document !== 'undefined' &&
        createPortal(
          <AnimatePresence>
            {(showLuckyRollModal || pendingLuckyRoll) && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={closeLuckyRoll}
                className="fixed inset-0 z-[70] bg-black/75 backdrop-blur-sm flex items-center justify-center p-4"
              >
                <motion.div
                  initial={{ scale: 0.9, y: 20 }}
                  animate={{ scale: 1, y: 0 }}
                  exit={{ scale: 0.9, y: 20 }}
                  onClick={(e) => e.stopPropagation()}
                  className="relative bg-slate-900 border-2 border-amber-400 rounded-3xl p-5 max-w-xs w-full text-center shadow-2xl space-y-3"
                >
                  {/* Close button */}
                  <button
                    onClick={closeLuckyRoll}
                    className="absolute top-2.5 right-2.5 w-7 h-7 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center transition-colors text-sm leading-none"
                    aria-label="Close lucky roll"
                  >
                    ✕
                  </button>

                  <div className="text-3xl">🎲</div>
                  <h3 className="text-lg font-black text-amber-300">LUCKY ROLL</h3>
                  <p className="text-[11px] text-slate-300">Pick any dice value you want for this turn!</p>

                  <div className="grid grid-cols-3 gap-2 pt-1">
                    {[1, 2, 3, 4, 5, 6].map((num) => (
                      <button
                        key={num}
                        onClick={() => handlePickLuckyValue(num)}
                        className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 text-slate-950 font-black text-xl shadow-lg hover:scale-110 active:scale-95 transition-transform flex items-center justify-center"
                      >
                        {num}
                      </button>
                    ))}
                  </div>

                  <button
                    onClick={closeLuckyRoll}
                    className="mt-1 text-[10px] font-bold text-slate-400 hover:text-white transition-colors"
                  >
                    Cancel lucky roll
                  </button>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>,
          document.body
        )}
    </div>
  );
};