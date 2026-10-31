// Short labels for the map. The full names stay in the scenario data.
const SHORT: Record<string, string> = {
  'fr-guard': 'Guard',
  'fr-vanguard': 'Vanguard',
  'fr-left': 'Eugène',
  'fr-right': 'Davout',
  'fr-south': 'Poniatowski',
  'ru-1st': '1st Army',
  'ru-2nd': '2nd Army',
  'ru-cossacks': 'Cossacks',
  'ru-neverovsky': 'Neverovsky',
};

export function shortName(id: string, full: string): string {
  return SHORT[id] ?? full.split(/[ :]/)[0] ?? id;
}

export function thousands(n: number): string {
  return n >= 10_000 ? `${Math.round(n / 1000)}k` : n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);
}
