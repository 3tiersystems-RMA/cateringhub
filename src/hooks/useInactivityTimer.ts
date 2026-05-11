import { useEffect, useRef, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

const INACTIVITY_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes
const WARNING_AT_MS = 3 * 60 * 1000;          // show warning at 3 minutes
const WARNING_DURATION_MS = 2 * 60 * 1000;    // 2 minutes countdown

interface UseInactivityTimerOptions {
  enabled: boolean;
}

export function useInactivityTimer({ enabled }: UseInactivityTimerOptions) {
  const router = useRouter();
  const supabase = createClient();

  const [showWarning, setShowWarning] = useState(false);
  const [countdown, setCountdown] = useState(WARNING_DURATION_MS / 1000); // 120 seconds

  const inactivityTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const warningTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearAllTimers = useCallback(() => {
    if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
    if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
  }, []);

  const performLogout = useCallback(async () => {
    clearAllTimers();
    setShowWarning(false);
    await supabase.auth.signOut();
    router.replace('/staff/login?reason=timeout');
  }, [clearAllTimers, router, supabase]);

  const startCountdown = useCallback(() => {
    setCountdown(WARNING_DURATION_MS / 1000);
    countdownIntervalRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(countdownIntervalRef.current!);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  const startTimers = useCallback(() => {
    clearAllTimers();
    setShowWarning(false);

    // Show warning at 3 minutes
    warningTimerRef.current = setTimeout(() => {
      setShowWarning(true);
      startCountdown();
    }, WARNING_AT_MS);

    // Auto logout at 5 minutes
    inactivityTimerRef.current = setTimeout(() => {
      performLogout();
    }, INACTIVITY_TIMEOUT_MS);
  }, [clearAllTimers, startCountdown, performLogout]);

  const resetTimer = useCallback(() => {
    if (!enabled) return;
    startTimers();
  }, [enabled, startTimers]);

  const stayLoggedIn = useCallback(() => {
    setShowWarning(false);
    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    startTimers();
  }, [startTimers]);

  // Attach activity listeners and start timers
  useEffect(() => {
    if (!enabled) return;

    startTimers();

    const activityEvents = ['mousemove', 'mousedown', 'keypress', 'scroll', 'touchstart', 'click'];

    const handleActivity = () => {
      // Only reset if warning is NOT showing — once warning shows, user must click a button
      if (!showWarning) {
        startTimers();
      }
    };

    activityEvents.forEach((event) => window.addEventListener(event, handleActivity, { passive: true }));

    return () => {
      clearAllTimers();
      activityEvents.forEach((event) => window.removeEventListener(event, handleActivity));
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  // When countdown hits 0, trigger logout
  useEffect(() => {
    if (countdown === 0 && showWarning) {
      performLogout();
    }
  }, [countdown, showWarning, performLogout]);

  return {
    showWarning,
    countdown,
    stayLoggedIn,
    logOutNow: performLogout,
  };
}
