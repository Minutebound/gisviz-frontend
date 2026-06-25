import { useState, useEffect, useCallback } from 'react';

const storageKey = (handle: string) => `gisviz_saved_${handle}`;

function readSaved(handle: string): Set<string> {
  try {
    const raw = localStorage.getItem(storageKey(handle));
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    return new Set(Array.isArray(parsed) ? parsed : []);
  } catch {
    return new Set();
  }
}

function writeSaved(handle: string, ids: Set<string>): void {
  try {
    localStorage.setItem(storageKey(handle), JSON.stringify([...ids]));
  } catch {
    // storage might be unavailable — fail silently
  }
}

/**
 * Hook that reads/writes saved post IDs to localStorage.
 * Key is per-user so different users on the same browser don't share saves.
 * Returns savedIds (Set) and a toggleSave function.
 */
export function useSavedPosts(userHandle?: string) {
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());

  // hydrate from localStorage once handle is known
  useEffect(() => {
    if (!userHandle) {
      setSavedIds(new Set());
      return;
    }
    setSavedIds(readSaved(userHandle));
  }, [userHandle]);

  const toggleSave = useCallback(
    (publicationId: string) => {
      if (!userHandle) return;

      setSavedIds((prev) => {
        const next = new Set(prev);
        if (next.has(publicationId)) {
          next.delete(publicationId);
        } else {
          next.add(publicationId);
        }
        writeSaved(userHandle, next);
        return next;
      });
    },
    [userHandle]
  );

  return { savedIds, toggleSave };
}