import { useState, useCallback } from "react";

export function usePersistedFilter<T extends string>(key: string, defaultValue: T): [T, (v: T) => void] {
  const [value, setValue] = useState<T>(() => {
    try {
      const stored = localStorage.getItem(`filter:${key}`);
      return (stored as T) ?? defaultValue;
    } catch {
      return defaultValue;
    }
  });

  const set = useCallback((v: T) => {
    setValue(v);
    try {
      localStorage.setItem(`filter:${key}`, v);
    } catch {}
  }, [key]);

  return [value, set];
}
