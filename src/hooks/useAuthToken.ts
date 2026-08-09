'use client';

import { useEffect, useState } from 'react';
import { getAuthToken } from '@/game/profile';

/*
 * Reactive auth token: reads the stored session token from localStorage and
 * keeps it in sync with reality — re-checks on a short interval, on window
 * focus and on `storage` events. This fixes the "I am logged in but the UI
 * thinks I am not" case, e.g. when a panel mounted before/around login, or a
 * session was restored/cleared in another tab.
 */
export function useAuthToken(): string | null {
  const [token, setToken] = useState<string | null>(() =>
    typeof window === 'undefined' ? null : getAuthToken()
  );

  useEffect(() => {
    const sync = () => {
      setToken((prev) => {
        const t = getAuthToken();
        return t === prev ? prev : t;
      });
    };
    window.addEventListener('storage', sync);
    window.addEventListener('focus', sync);
    const boot = setTimeout(sync, 250);
    const id = setInterval(sync, 1500);

    return () => {
      window.removeEventListener('storage', sync);
      window.removeEventListener('focus', sync);
      clearTimeout(boot);
      clearInterval(id);
    };
  }, []);

  return token;
}