export function compareVersions(a: string, b: string): number {
  const [mainA, preA] = splitPre(a);
  const [mainB, preB] = splitPre(b);
  const partsA = mainA.split('.');
  const partsB = mainB.split('.');
  for (let i = 0; i < Math.max(partsA.length, partsB.length); i++) {
    const diff = comparePart(partsA[i] ?? '0', partsB[i] ?? '0');
    if (diff !== 0) return diff;
  }
  if (preA === preB) return 0;
  if (preA === '') return 1;
  if (preB === '') return -1;
  return preA < preB ? -1 : 1;
}

function splitPre(version: string): [string, string] {
  const clean = version.trim().replace(/^v/, '');
  const index = clean.indexOf('-');
  return index === -1
    ? [clean, '']
    : [clean.slice(0, index), clean.slice(index + 1)];
}

function comparePart(a: string, b: string): number {
  const numA = Number(a);
  const numB = Number(b);
  if (Number.isInteger(numA) && Number.isInteger(numB)) return numA - numB;
  return a < b ? -1 : a > b ? 1 : 0;
}

export function maxVersion(versions: string[]): string | null {
  return versions.reduce<string | null>(
    (max, v) => (max === null || compareVersions(v, max) > 0 ? v : max),
    null,
  );
}
