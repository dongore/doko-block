import { useEffect } from 'react';

/** Keeps the screen on while `enabled` (where the browser allows it). */
export function useWakeLock(enabled: boolean) {
  useEffect(() => {
    if (!enabled || !('wakeLock' in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    let active = true;
    const request = async () => {
      try {
        const l = await navigator.wakeLock.request('screen');
        if (active) lock = l;
        else l.release().catch(() => {});
      } catch {
        /* not allowed here – fine */
      }
    };
    const onVisible = () => {
      if (document.visibilityState === 'visible') request();
    };
    request();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      active = false;
      document.removeEventListener('visibilitychange', onVisible);
      lock?.release().catch(() => {});
    };
  }, [enabled]);
}
