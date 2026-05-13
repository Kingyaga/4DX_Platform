"use client";

import { useEffect, useState } from "react";

export function useTimedMessage<T extends string | null = string | null>(initialValue: T = null as T, timeoutMs = 7000) {
  const [message, setMessage] = useState<string | null>(initialValue);

  useEffect(() => {
    if (!message) return;

    const timer = window.setTimeout(() => {
      setMessage(initialValue);
    }, timeoutMs);

    return () => window.clearTimeout(timer);
  }, [message, timeoutMs, initialValue]);

  return [message, setMessage] as const;
}
