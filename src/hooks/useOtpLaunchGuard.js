import { useCallback, useEffect, useRef, useState } from "react";

export function useOtpLaunchGuard(timeoutMs = 3000) {
  const lockedRef = useRef(false);
  const lockIdRef = useRef(0);
  const timerRef = useRef(null);

  const [isOtpLaunching, setIsOtpLaunching] = useState(false);

  const releaseLock = useCallback((lockId) => {
    // Ignore callbacks/timers belonging to an older launch.
    if (lockId !== lockIdRef.current) {
      return;
    }

    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    lockedRef.current = false;
    setIsOtpLaunching(false);
  }, []);

  const acquireLock = useCallback(() => {
    // A launch is already in progress.
    if (lockedRef.current) {
      return null;
    }

    // Create a unique ID for this launch.
    const lockId = ++lockIdRef.current;

    lockedRef.current = true;
    setIsOtpLaunching(true);

    // Safety fallback.
    // This prevents the lock from remaining stuck if MSG91
    // closes silently or does not trigger success/failure.
    timerRef.current = setTimeout(() => {
      releaseLock(lockId);
    }, timeoutMs);

    // Return a release function belonging ONLY to this launch.
    return () => {
      releaseLock(lockId);
    };
  }, [releaseLock, timeoutMs]);

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  return {
    isOtpLaunching,
    acquireLock,
  };
}
