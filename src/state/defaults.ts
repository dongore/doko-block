import type { AppData, Rules } from './types';

/** Saved data from before the Re/Kontra split had a single "lostAnnounced" switch. */
type LegacyTriggers = Partial<Rules['bock']['triggers']> & { lostAnnounced?: boolean };

/** Bump when a default changes that should also reset the rules carried over to the next evening. */
export const DEFAULTS_REV = 1;

export const DEFAULT_RULES: Rules = {
  extras: { fuchs: true, doppelkopf: true, karlchen: true, dulle: true, gegenDieAlten: true },
  bock: {
    enabled: true,
    mode: 'sequential',
    triggers: { tie120: true, lostKontra: true, lostRe: false, lostSolo: false, zeroGame: true },
  },
  pflichtsolo: { enabled: false, dealerStays: true },
  lustsolo: { dealerStays: true },
  reKontra: 'plus2',
  sitOut: 'opposite',
  rounds: null,
  money: { centsPerPoint: 5, mode: 'pairwise' },
};

export const emptyData = (): AppData => ({
  version: 1,
  sessions: [],
  knownPlayers: [],
  keepAwake: true,
  defaultsRev: DEFAULTS_REV,
});

/** Fill in fields that older saved data may lack. */
export function normalizeRules(r: Partial<Rules> | undefined): Rules {
  const d = DEFAULT_RULES;
  const { lostAnnounced, ...saved }: LegacyTriggers = r?.bock?.triggers ?? {};
  const legacy = lostAnnounced === undefined ? {} : { lostKontra: lostAnnounced };
  return {
    extras: { ...d.extras, ...r?.extras },
    bock: {
      ...d.bock,
      ...r?.bock,
      triggers: { ...d.bock.triggers, ...legacy, ...saved },
    },
    pflichtsolo: { ...d.pflichtsolo, ...r?.pflichtsolo },
    lustsolo: { ...d.lustsolo, ...r?.lustsolo },
    reKontra: r?.reKontra ?? d.reKontra,
    sitOut: r?.sitOut ?? d.sitOut,
    rounds: r?.rounds === undefined ? d.rounds : r.rounds,
    money: { ...d.money, ...r?.money },
  };
}
