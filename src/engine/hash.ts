import { hashString } from './rng';

/** JSON with object keys sorted, so equal states always serialise identically. */
export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const record = value as Record<string, unknown>;
  const entries = Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`);
  return `{${entries.join(',')}}`;
}

/** 64-bit fingerprint of any serialisable value, used by golden replays and resumption tests. */
export function stateHash(value: unknown): string {
  const text = stableStringify(value);
  const hex = (n: number) => n.toString(16).padStart(8, '0');
  return hex(hashString(text, 1)) + hex(hashString(text, 2));
}
