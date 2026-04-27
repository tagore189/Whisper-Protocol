import { useCallback, useEffect, useState } from "react";
import {
    getAdvertiserError,
    getAdvertiserState,
    isAdvertiserAvailable,
    startWhisperAdvertising,
    stopWhisperAdvertising,
    type AdvertiserState,
} from "./bleAdvertiser";

export function useWhisperAdvertising(options?: { autoStart?: boolean }) {
  const autoStart = options?.autoStart ?? true;
  const [state, setState] = useState<AdvertiserState>(getAdvertiserState());
  const [error, setError] = useState<string | null>(getAdvertiserError());

  const start = useCallback(async (): Promise<boolean> => {
    const ok = await startWhisperAdvertising();
    setState(getAdvertiserState());
    setError(getAdvertiserError());
    return ok;
  }, []);

  const stop = useCallback(async (): Promise<void> => {
    await stopWhisperAdvertising();
    setState(getAdvertiserState());
    setError(getAdvertiserError());
  }, []);

  useEffect(() => {
    if (!isAdvertiserAvailable() || !autoStart) return;
    start();
    return () => {
      stopWhisperAdvertising();
    };
  }, [autoStart]);

  return {
    state,
    error,
    available: isAdvertiserAvailable(),
    start,
    stop,
  };
}
