const VISIBLE_PREFIX = 4;
const MIN_LENGTH_FOR_PREFIX = 12;

export function maskSecret(value: string): string {
  if (value.length < MIN_LENGTH_FOR_PREFIX) {
    return '********';
  }
  return `${value.slice(0, VISIBLE_PREFIX)}********`;
}
