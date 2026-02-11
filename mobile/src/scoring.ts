export function scoreBase(type: 'A' | 'B' | 'AB' | 'K') {
  switch (type) {
    case 'A':
    case 'B':
      return 100;
    case 'AB':
      return 150;
    case 'K':
      return 250;
  }
}

export function speedMultiplier(remaining: number, total: number) {
  const pct = Math.max(0, Math.min(1, remaining / total));
  return 1.0 + 0.5 * pct;
}
