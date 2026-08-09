'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import AuthScreen from '@/components/auth/AuthScreen';
import { PlayerProfile, saveProfile, saveAuthToken } from '@/game/profile';

interface AuthModalProps {
  open: boolean;
  onClose: () => void;
  /** Pre-fill the auth form (character, username, …). */
  initial?: Partial<PlayerProfile>;
  onAuthenticated?: (profile: PlayerProfile, token: string) => void;
}

/*
 * Login / sign-up as an overlay sheet — lets players authenticate directly
 * from the game lobby (where the friends / invites panel needs a session)
 * without having to go back to the home page.
 */
export const AuthModal: React.FC<AuthModalProps> = ({ open, onClose, initial, onAuthenticated }) => {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-[120] bg-black/80 backdrop-blur-sm"
          />
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 260 }}
            className="fixed inset-x-0 bottom-0 z-[120] mx-auto w-full sm:max-w-md rounded-t-[28px] bg-slate-900 border-t border-l border-r border-slate-700/60 p-4 shadow-2xl max-h-[88dvh] overflow-y-auto sm:rounded-3xl sm:bottom-4 sm:inset-x-4 sm:top-auto sm:mx-auto sm:border"
            role="dialog"
            aria-modal="true"
            aria-label="Log in or sign up"
          >
            <div className="mx-auto w-10 h-1 rounded-full bg-slate-700 mb-2 sm:hidden" />
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-black uppercase tracking-wider text-slate-300">Your account</span>
              <button
                onClick={onClose}
                className="p-2 rounded-full bg-slate-800 text-slate-400 hover:text-white transition-colors"
                aria-label="Close login"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <AuthScreen
              initial={initial}
              onAuthenticated={(profile, token) => {
                saveProfile(profile);
                saveAuthToken(token);
                onAuthenticated?.(profile, token);
                onClose();
              }}
            />
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default AuthModal;