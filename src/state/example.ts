import { detectBockTriggers, emptyExtras, scoreGame } from '../logic/scoring';
import { computeSession } from '../logic/session';
import { DEFAULT_RULES } from './defaults';
import type { Ann, Extras, Game, Session, SoloType } from './types';
import { uid } from '../logic/format';

interface Script {
  augen: number;
  re?: Ann;
  ko?: Ann;
  /** Index into the four players at the table (play order). */
  pair?: [number, number];
  solo?: { by: number; type: SoloType };
  kind?: Game['kind'];
  reEx?: Partial<Extras>;
  koEx?: Partial<Extras>;
}

// A plausible evening: mostly normal games, two solos, two 120:120 games that start Bockrunden.
const SCRIPT: Script[] = [
  { augen: 128, pair: [0, 2] },
  { augen: 152, re: 1, pair: [1, 3], reEx: { fuchs: 1 } },
  { augen: 98, pair: [0, 1] },
  { augen: 120, pair: [2, 3] },
  { augen: 117, ko: 1, pair: [0, 3], koEx: { doppelkopf: 1 } },
  { augen: 125, solo: { by: 2, type: 'damen' } },
  { augen: 141, pair: [1, 2], reEx: { doppelkopf: 1 } },
  { augen: 160, re: 2, pair: [0, 2], reEx: { doppelkopf: 1 } },
  { augen: 133, pair: [1, 3], kind: 'hochzeit' },
  { augen: 135, re: 1, pair: [0, 1], reEx: { karlchen: 1 } },
  { augen: 100, solo: { by: 0, type: 'herz' } },
  { augen: 120, pair: [2, 3] },
  { augen: 144, pair: [0, 3], reEx: { fuchs: 1 } },
  { augen: 77, ko: 1, pair: [1, 2] },
];

/** Builds a realistic example evening so people can look around before their first game. */
export function makeExampleSession(): Session {
  const names = ['Anna', 'Ben', 'Carla', 'David', 'Eva'];
  const players = names.map((name) => ({ id: uid(), name }));
  const start = Date.now() - 1000 * 60 * 60 * 2.5;
  const session: Session = {
    id: uid(),
    name: 'Beispiel: Doko bei Carla',
    createdAt: start,
    updatedAt: start,
    example: true,
    players,
    seating: players.map((p) => p.id),
    firstDealerId: players[0].id,
    rules: { ...DEFAULT_RULES, rounds: 4 },
    games: [],
    manualBocks: [],
  };

  SCRIPT.forEach((s, i) => {
    const view = computeSession(session);
    const table = view.next.playerIds;
    const reIds = s.solo ? [table[s.solo.by]] : (s.pair ?? [0, 1]).map((k) => table[k]);
    const game: Game = {
      id: uid(),
      createdAt: start + i * 9 * 60 * 1000,
      dealerId: view.next.dealerId,
      playerIds: table,
      kind: s.solo ? 'solo' : (s.kind ?? 'normal'),
      soloType: s.solo?.type,
      pflicht: s.solo ? false : undefined,
      reIds,
      mode: 'calc',
      calc: {
        reAugen: s.augen,
        reAnn: s.re ?? 0,
        kontraAnn: s.ko ?? 0,
        reExtras: { ...emptyExtras(), ...s.reEx },
        kontraExtras: { ...emptyExtras(), ...s.koEx },
      },
      bockTriggers: [],
    };
    game.bockTriggers = detectBockTriggers(game, scoreGame(game, session.rules), session.rules);
    session.games.push(game);
  });
  session.updatedAt = Date.now() - 1000 * 60 * 4;
  return session;
}
