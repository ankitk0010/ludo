'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Trophy, Gamepad2, Zap, Settings, LogOut, Pencil, Mic, MicOff, Loader, Mail } from 'lucide-react';
import { PlayerProfile, profileName } from '@/game/profile';
import { CharacterAvatar } from '@/components/avatar/CharacterAvatar';
import { PlayerColor } from '@/game/engine/types';
import { PRESET_AVATARS } from '@/game/avatars';
import { gameTheme } from '@/theme/tokens';
import { soundEngine } from '@/components/sound/soundEngine';
import { useVoiceMic, VoiceMicApi } from '@/components/sound/useVoiceMic';

interface ProfileDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  username: string;
  profile?: PlayerProfile;
  /** Shared mic state — pass it so the sheet reflects the in-game mic. */
  mic?: VoiceMicApi;
  onUpdateProfile?: (profile: PlayerProfile) => void;
  onLogout?: () => void;
}

/*
 * Compact profile sheet. Slides from the bottom on mobile, from the right on
 * larger screens. Shows character, level, wins / games / XP and settings.
 */
export const ProfileDrawer: React.FC<ProfileDrawerProps> = ({
  isOpen,
  onClose,
  username,
  profile,
  mic: micProp,
  onUpdateProfile,
  onLogout,
}) => {
  const [editing, setEditing] = useState(false);
  const [avatar, setAvatar] = useState<PlayerColor>(profile?.characterId || 'red');
  const [displayName, setDisplayName] = useState('');
  const [avatarImage, setAvatarImage] = useState<string>(profile?.avatarUrl || '');

  const pickAvatar = (file: File) => {
    if (!file.type.startsWith('image/')) return;
    if (file.size > 2_600_000) return;
    const reader = new FileReader();
    reader.onload = () => setAvatarImage(String(reader.result || ''));
    reader.readAsDataURL(file);
  };

  // When a shared mic is handed in (in-game), drive it; otherwise own one here.
  const internalMic = useVoiceMic();
  const { micOn, micBusy, micError, speaking, toggleMic } = micProp ?? internalMic;

  const charColor = profile?.characterId || avatar;
  const charStyle = gameTheme.players[charColor];
  const wins = profile?.wins ?? 12;
  const games = profile?.games ?? 18;
  const xp = profile?.xp ?? 450;
  const level = profile?.level ?? 1;
  const winRate = games > 0 ? Math.round((wins / games) * 100) : 0;

  const saveEdit = () => {
    if (onUpdateProfile && profile) {
      onUpdateProfile({
        ...profile,
        characterId: avatar,
        displayName: displayName.trim() || profile.displayName,
        avatarUrl: avatarImage || undefined,
      });
      soundEngine.playClick();
    }
    setEditing(false);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm"
          />
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 260 }}
            className="fixed inset-x-0 bottom-0 z-[100] mx-auto w-full sm:max-w-md rounded-t-[28px] bg-slate-900 border-t border-l border-r border-slate-700/60 p-5 shadow-2xl max-h-[86dvh] overflow-y-auto sm:rounded-3xl sm:bottom-4 sm:inset-x-4 sm:top-auto sm:mx-auto sm:border"
            role="dialog"
            aria-modal="true"
            aria-label="Player profile"
          >
            {/* grab handle for mobile sheets */}
            <div className="mx-auto w-10 h-1 rounded-full bg-slate-700 mb-4 sm:hidden" />

            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-black text-white flex items-center gap-2">
                <span className="text-xl">👤</span> PLAYER PROFILE
              </h3>
              <button
                onClick={onClose}
                className="p-2 rounded-full bg-slate-800 text-slate-400 hover:text-white transition-colors"
                aria-label="Close profile"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Identity header */}
            <div
              className="relative flex items-center gap-3 p-4 rounded-2xl border overflow-hidden"
              style={{
                background: `linear-gradient(135deg, ${charStyle.primary}26 0%, rgba(15,23,42,0.9) 65%)`,
                borderColor: `${charStyle.primary}55`,
              }}
            >
              <div className="relative shrink-0">
                <CharacterAvatar color={charColor} glow image={avatarImage} className="w-16 h-16" />
                <div
                  className="absolute -bottom-1 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full text-[8px] font-black text-white whitespace-nowrap border border-white/20"
                  style={{ background: charStyle.primary, boxShadow: `0 0 10px ${charStyle.glow}` }}
                >
                  Lv {level}
                </div>
              </div>
              <div className="min-w-0 flex-1">
                <h4 className="text-[15px] font-extrabold text-white leading-tight truncate">
                  {profileName(profile || ({ username, characterId: charColor } as PlayerProfile))}
                </h4>
                <div className="mt-0.5 text-[10px] font-bold uppercase tracking-wide" style={{ color: charStyle.primary }}>
                  {gameTheme.players[charColor].name} • {xp} XP
                </div>
                {profile?.email && (
                  <div className="mt-1 flex items-center gap-1 text-[9px] font-bold text-slate-400 truncate">
                    <Mail className="w-3 h-3 shrink-0 text-slate-500" />
                    <span className="truncate">{profile.email}</span>
                  </div>
                )}
                <div className="mt-2.5 flex items-center gap-2">
                  <div className="h-1.5 flex-1 bg-slate-950/70 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{
                        width: `${Math.min(100, Math.round((xp % 500) / 5))}%`,
                        background: `linear-gradient(90deg, ${charStyle.primary}, ${charStyle.light})`,
                      }}
                    />
                  </div>
                  <span className="text-[8px] font-black text-slate-400 tabular-nums shrink-0">
                    {Math.max(0, 500 - (xp % 500))} XP
                  </span>
                </div>
              </div>
            </div>

            {/* Stats grid */}
            <div className="grid grid-cols-3 gap-2 mt-4">
              <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800 text-center">
                <Trophy className="w-5 h-5 text-amber-400 mx-auto" />
                <div className="text-lg font-extrabold text-white mt-1">{wins}</div>
                <div className="text-[9px] font-black uppercase tracking-wide text-slate-500">Wins</div>
              </div>
              <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800 text-center">
                <Gamepad2 className="w-5 h-5 text-blue-400 mx-auto" />
                <div className="text-lg font-extrabold text-white mt-1">{games}</div>
                <div className="text-[9px] font-black uppercase tracking-wide text-slate-500">Games</div>
              </div>
              <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800 text-center">
                <Zap className="w-5 h-5 text-purple-400 mx-auto" />
                <div className="text-lg font-extrabold text-white mt-1">{winRate}%</div>
                <div className="text-[9px] font-black uppercase tracking-wide text-slate-500">Win rate</div>
              </div>
            </div>

            {/* XP row */}
            <div className="flex items-center justify-between bg-slate-950/60 mt-2 p-3 rounded-xl border border-slate-800">
              <span className="text-xs font-bold text-slate-300">Total XP</span>
              <span className="text-sm font-extrabold text-amber-300">{xp} XP</span>
            </div>

            {/* Edit character + name */}
            <div className="mt-4">
              <button
                onClick={() => setEditing((e) => !e)}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-black uppercase tracking-wider text-slate-200 transition-colors"
              >
                <Pencil className="w-3.5 h-3.5" /> {editing ? 'Cancel editing' : 'Edit character & name'}
              </button>

              <AnimatePresence>
                {editing && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="pt-3 space-y-3">
                      {/* Goti color — your tokens on the board */}
                      <div>
                        <div className="text-[9px] font-black uppercase tracking-wider text-slate-500 mb-1.5">Goti color</div>
                        <div className="flex gap-2">
                          {(['red', 'green', 'yellow', 'blue'] as PlayerColor[]).map((c) => (
                            <button
                              key={c}
                              type="button"
                              onClick={() => setAvatar(c)}
                              className={`w-9 h-9 rounded-full border-2 transition-transform active:scale-90 ${
                                avatar === c ? 'border-white scale-110' : 'border-transparent opacity-70 hover:opacity-100'
                              }`}
                              style={{
                                background: `radial-gradient(circle at 35% 30%, ${gameTheme.players[c].primary}, ${gameTheme.players[c].dark})`,
                              }}
                              aria-label={`Goti ${c}`}
                            />
                          ))}
                        </div>
                      </div>

                      {/* Avatar image — upload from device */}
                      <div>
                        <div className="text-[9px] font-black uppercase tracking-wider text-slate-500 mb-1.5 flex items-center justify-between">
                          <span>Avatar image</span>
                          {avatarImage && (
                            <button
                              type="button"
                              onClick={() => setAvatarImage('')}
                              className="text-[9px] font-black text-red-400 hover:text-red-300"
                            >
                              ✕ Remove
                            </button>
                          )}
                        </div>

                        {/* Preset avatars to choose from */}
                        <div className="grid grid-cols-4 gap-1.5 mb-2">
                          {PRESET_AVATARS.map((a) => (
                            <button
                              key={a.id}
                              type="button"
                              onClick={() => setAvatarImage(a.data)}
                              title={a.label}
                              className={`w-full aspect-square rounded-full overflow-hidden border-2 transition-transform active:scale-90 ${
                                avatarImage === a.data
                                  ? 'border-purple-400 ring-2 ring-purple-400/40'
                                  : 'border-transparent hover:border-slate-500'
                              }`}
                            >
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={a.data} alt={a.label} className="w-full h-full object-cover" />
                            </button>
                          ))}
                        </div>

                        <label className="flex items-center gap-3 rounded-xl bg-slate-950/80 border border-slate-700 px-3 py-2.5 cursor-pointer hover:border-purple-400/60 transition-colors">
                          <span className="w-11 h-11 rounded-full shrink-0 overflow-hidden flex items-center justify-center bg-slate-800">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            {avatarImage ? <img src={avatarImage} alt="" className="w-full h-full object-cover" /> : <span className="text-lg">📷</span>}
                          </span>
                          <span className="text-[11px] font-bold text-slate-300">
                            {avatarImage ? 'Change avatar image' : 'Tap to upload your image'}
                          </span>
                          <input
                            type="file"
                            accept="image/jpeg,image/png,image/webp"
                            className="hidden"
                            onChange={(e) => {
                              const f = e.target.files?.[0];
                              if (f) pickAvatar(f);
                              e.currentTarget.value = '';
                            }}
                          />
                        </label>
                        <p className="text-[8px] text-slate-600 mt-1">
                          JPG / PNG / WebP, max 2.5 MB. Your character still represents you on the board.
                        </p>
                      </div>

                      <input
                        type="text"
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        placeholder="New display name"
                        maxLength={20}
                        className="w-full py-2.5 px-3 rounded-xl bg-slate-950/80 border border-slate-700 text-white text-sm focus:outline-none focus:border-purple-400"
                      />
                      <button
                        onClick={saveEdit}
                        className="w-full py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-black text-xs uppercase tracking-wider transition-colors"
                      >
                        Save changes
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Microphone / voice */}
            <div className={`mt-4 p-4 rounded-2xl border transition-colors ${micOn ? 'bg-emerald-500/10 border-emerald-500/40' : 'bg-slate-950/60 border-slate-800'}`}>
              <div className="flex items-center justify-between mb-3">
                <h5 className="text-xs font-black uppercase tracking-wider text-slate-200 flex items-center gap-1.5">
                  <Mic className="w-4 h-4 text-emerald-400" /> Voice chat
                </h5>
                <button
                  onClick={toggleMic}
                  disabled={micBusy}
                  className={`relative w-12 h-12 rounded-full flex items-center justify-center transition-all shadow-lg ${
                    micBusy
                      ? 'bg-slate-700 text-slate-400'
                      : micOn
                        ? 'bg-emerald-500 text-white shadow-emerald-500/40'
                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                  aria-label={micOn ? 'Turn mic off' : 'Turn mic on'}
                >
                  {micBusy ? <Loader className="w-5 h-5 animate-spin" /> : micOn ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
                  {micOn && (
                    <motion.span
                      animate={{ scale: speaking ? [1, 1.6, 1] : 1, opacity: speaking ? [1, 0.4, 1] : 1 }}
                      transition={{ repeat: Infinity, duration: 0.9 }}
                      className={`absolute -top-1 -right-1 w-3 h-3 rounded-full border-2 border-slate-950 ${speaking ? 'bg-emerald-400' : 'bg-white/60'}`}
                    />
                  )}
                </button>
              </div>

              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <div className={`text-sm font-extrabold ${micOn ? 'text-white' : 'text-slate-400'}`}>
                    {micOn ? (speaking ? 'You are speaking' : 'Listening…') : 'Mic is off'}
                  </div>
                  <div className="text-[10px] text-slate-500">
                    {micOn
                      ? speaking
                        ? 'Everyone can see you talking'
                        : 'Tap the mic and say something'
                      : 'Tap the mic button to start speaking'}
                  </div>
                </div>
              </div>

              {/* Live voice level bars */}
              {micOn && (
                <div className="flex items-center gap-1 h-6 mt-3">
                  {Array.from({ length: 18 }).map((_, i) => (
                    <div
                      key={i}
                      className="flex-1 rounded-full transition-all"
                      style={{
                        height: speaking ? `${30 + Math.abs(Math.sin(i * 0.9)) * 60}%` : '18%',
                        background: speaking ? '#10b981' : '#334155',
                      }}
                    />
                  ))}
                </div>
              )}

              {micError && <div className="text-[10px] text-red-400 font-bold mt-2">{micError}</div>}
            </div>

            {/* Footer actions */}
            <div className="mt-4 pt-4 border-t border-slate-800 space-y-2">
              <button className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-slate-800/70 hover:bg-slate-700 text-xs font-black uppercase tracking-wider text-slate-300 transition-colors">
                <Settings className="w-3.5 h-3.5" /> Settings
              </button>
              {onLogout && (
                <button
                  onClick={() => {
                    soundEngine.playClick();
                    onLogout();
                  }}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-xs font-black uppercase tracking-wider text-red-400 transition-colors"
                >
                  <LogOut className="w-3.5 h-3.5" /> Log out
                </button>
              )}
              <div className="text-center text-[10px] text-slate-600 font-bold pt-1">
                Ludo Master v1.0 • #{username.slice(0, 6).toUpperCase() || 'GUEST'}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default ProfileDrawer;