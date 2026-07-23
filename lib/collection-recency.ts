/**
 * Per-device recency tracking for the "File Under" collection picker.
 *
 * Records which collections the user recently added items to (in localStorage)
 * so the picker can float the most-recently-used collections to the front —
 * no horizontal scrolling to reach the one you just used.
 */

const STORAGE_KEY = "trove:collection-recency";

type RecencyMap = Record<string, number>;

/** Read the collectionId → last-used-timestamp map. Safe on the server. */
export function getCollectionRecency(): RecencyMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as RecencyMap) : {};
  } catch {
    return {};
  }
}

/** Stamp the given collections as "just used". Best-effort. */
export function recordCollectionsUsed(ids: string[]): void {
  if (typeof window === "undefined" || ids.length === 0) return;
  try {
    const map = getCollectionRecency();
    const now = Date.now();
    for (const id of ids) map[id] = now;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    // localStorage unavailable (private mode / quota) — recency is optional.
  }
}

/**
 * Return a new array ordered by recency of use (most recent first). Collections
 * never used keep their original relative order at the end. Pure and stable.
 */
export function sortCollectionsByRecency<T extends { id: string }>(
  collections: T[],
  recency: RecencyMap
): T[] {
  return collections
    .map((collection, index) => ({ collection, index }))
    .sort((a, b) => {
      const ta = recency[a.collection.id] ?? 0;
      const tb = recency[b.collection.id] ?? 0;
      if (ta !== tb) return tb - ta; // more recently used first
      return a.index - b.index; // otherwise preserve original order (stable)
    })
    .map((entry) => entry.collection);
}
