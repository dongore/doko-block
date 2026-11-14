import type { Game, GameKind, SoloType } from '../state/types';

export const SOLO_TYPES: { value: SoloType; label: string; glyph: string; red?: boolean }[] = [
  { value: 'damen', label: 'Damen', glyph: 'D' },
  { value: 'buben', label: 'Buben', glyph: 'B' },
  { value: 'fleischlos', label: 'Fleischlos', glyph: 'F' },
  { value: 'kreuz', label: 'Kreuz', glyph: '♣' },
  { value: 'pik', label: 'Pik', glyph: '♠' },
  { value: 'herz', label: 'Herz', glyph: '♥', red: true },
  { value: 'karo', label: 'Karo', glyph: '♦', red: true },
  { value: 'stille-hochzeit', label: 'Stille Hochzeit', glyph: 'H' },
];

export const KIND_LABEL: Record<GameKind, string> = {
  normal: 'Normalspiel',
  hochzeit: 'Hochzeit',
  armut: 'Armut',
  solo: 'Solo',
};

export function soloInfo(t?: SoloType) {
  return SOLO_TYPES.find((s) => s.value === t);
}

export function gameTitle(g: Game): string {
  if (g.kind !== 'solo') return KIND_LABEL[g.kind];
  const s = soloInfo(g.soloType);
  if (!s) return 'Solo';
  if (s.value === 'stille-hochzeit') return 'Stille Hochzeit';
  if (s.value === 'fleischlos') return 'Fleischloser';
  return `${s.label}solo`;
}
