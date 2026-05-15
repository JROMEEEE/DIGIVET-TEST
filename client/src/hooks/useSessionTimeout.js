import { useEffect, useRef, useState } from 'react';

const TIMEOUT_MS  = 60 * 60 * 1000; // 60 minutes inactive → auto logout
const WARNING_MS  = 57 * 60 * 1000; // show warning at 57 minutes (3 min before logout)
const EVENTS      = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'click'];

export default function useSessionTimeout(onLogout) {
  const [showWarning, setShowWarning] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(120); // 2 minutes warning
  const warningTimer  = useRef(null);
  const logoutTimer   = useRef(null);
  const countdownRef  = useRef(null);

  function reset() {
    // Clear all timers
    clearTimeout(warningTimer.current);
    clearTimeout(logoutTimer.current);
    clearInterval(countdownRef.current);
    setShowWarning(false);
    setSecondsLeft(120);

    // Restart timers
    warningTimer.current = setTimeout(() => {
      setShowWarning(true);
      setSecondsLeft(120);
      countdownRef.current = setInterval(() => {
        setSecondsLeft(s => {
          if (s <= 1) { clearInterval(countdownRef.current); return 0; }
          return s - 1;
        });
      }, 1000);
    }, WARNING_MS);

    logoutTimer.current = setTimeout(() => {
      setShowWarning(false);
      onLogout();
    }, TIMEOUT_MS);
  }

  useEffect(() => {
    reset();
    EVENTS.forEach(e => window.addEventListener(e, reset, { passive: true }));
    return () => {
      clearTimeout(warningTimer.current);
      clearTimeout(logoutTimer.current);
      clearInterval(countdownRef.current);
      EVENTS.forEach(e => window.removeEventListener(e, reset));
    };
  }, []);

  return { showWarning, secondsLeft, stayLoggedIn: reset };
}