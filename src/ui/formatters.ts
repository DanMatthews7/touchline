import { ALL_ATTRIBUTE_PATHS, getAttributeValue } from '../domain/attributes';
import type { VisiblePlayer } from '../domain/models';

export function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase();
}

export function ageOnDate(dateOfBirth: string | null, date: string): number | null {
  if (dateOfBirth === null) return null;
  const born = new Date(`${dateOfBirth}T00:00:00Z`);
  const current = new Date(`${date.slice(0, 10)}T00:00:00Z`);
  if (!Number.isFinite(born.getTime()) || !Number.isFinite(current.getTime()) || born > current) return null;
  let age = current.getUTCFullYear() - born.getUTCFullYear();
  if (current.getUTCMonth() < born.getUTCMonth() || (current.getUTCMonth() === born.getUTCMonth() && current.getUTCDate() < born.getUTCDate())) age -= 1;
  return age;
}

export function assessedCount(player: Pick<VisiblePlayer, 'attributes'>): number {
  return ALL_ATTRIBUTE_PATHS.filter(path => getAttributeValue(player.attributes, path) !== null).length;
}

/** Missing values remain last in both directions; string sorting is case-insensitive. */
export function compareValues(a: string | number | null, b: string | number | null, direction: 'asc' | 'desc'): number {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  const result = typeof a === 'number' && typeof b === 'number'
    ? a - b
    : String(a).localeCompare(String(b), 'en', { sensitivity: 'base', numeric: true });
  return direction === 'asc' ? result : -result;
}

export function readableDate(value: string): string {
  const date = new Date(`${value.slice(0, 10)}T00:00:00Z`);
  if (!Number.isFinite(date.getTime())) return value;
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
}
