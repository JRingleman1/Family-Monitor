import { Timestamp, type DocumentData, type QueryDocumentSnapshot } from 'firebase/firestore';

/**
 * Firestore hands back Timestamps, and a `serverTimestamp()` write reads as
 * null until the server confirms it. The domain layer works in epoch
 * milliseconds, so everything crossing the boundary is normalised here.
 */
export function toMillis(value: unknown, fallback = Date.now()): number {
  if (value instanceof Timestamp) return value.toMillis();
  if (typeof value === 'number') return value;
  if (value instanceof Date) return value.getTime();
  return fallback;
}

export function toOptionalMillis(value: unknown): number | undefined {
  if (value === null || value === undefined) return undefined;
  return toMillis(value);
}

export function withId<T>(
  snap: QueryDocumentSnapshot<DocumentData>,
  map: (data: DocumentData, id: string) => T,
): T {
  return map(snap.data(), snap.id);
}
