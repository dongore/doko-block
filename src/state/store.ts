import { useSyncExternalStore } from 'react';
import { DEFAULTS_REV, emptyData, normalizeRules } from './defaults';
import { determineWinner, emptyExtras } from '../logic/scoring';
import type { AppData, BockTrigger, Game, Rules, Session } from './types';

/** Older saves stored one "lostAnnounced" trigger; split it into Kontra or Re by who actually lost. */
function migrateTriggers(g: Game): BockTrigger[] {
  const list = (g.bockTriggers ?? []) as (BockTrigger | 'lostAnnounced')[];
  return list.map((t) => {
    if (t !== 'lostAnnounced') return t;
    const c = g.calc;
    return c && c.kontraAnn >= 1 && determineWinner(c).winner !== 'kontra' ? 'lostKontra' : 'lostRe';
  });
}

const KEY = 'doko-block:v1';

function load(): AppData {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return emptyData();
    return sanitize(JSON.parse(raw));
  } catch {
    return emptyData();
  }
}

/** Accepts saved or imported data and fills in anything missing. Throws on unusable input. */
export function sanitize(input: unknown): AppData {
  if (!input || typeof input !== 'object') throw new Error('Keine gültige Sicherung');
  const d = input as Partial<AppData>;
  if (!Array.isArray(d.sessions)) throw new Error('Keine Spielabende in der Datei gefunden');
  const sessions: Session[] = d.sessions.map((s) => ({
    ...s,
    rules: normalizeRules(s.rules),
    games: (s.games ?? []).map((g) => ({
      ...g,
      bockTriggers: migrateTriggers(g),
      calc: g.calc && {
        ...g.calc,
        reExtras: { ...emptyExtras(), ...g.calc.reExtras },
        kontraExtras: { ...emptyExtras(), ...g.calc.kontraExtras },
      },
    })),
    manualBocks: s.manualBocks ?? [],
    seating: s.seating ?? s.players.map((p) => p.id),
  }));
  let lastRules = d.lastRules ? normalizeRules(d.lastRules) : undefined;
  // Rev 1: Pflichtsolo became off by default; switch it off for the next new evening once.
  if ((d.defaultsRev ?? 0) < 1 && lastRules) lastRules = { ...lastRules, pflichtsolo: { ...lastRules.pflichtsolo, enabled: false } };
  return {
    version: 1,
    sessions,
    knownPlayers: Array.isArray(d.knownPlayers) ? d.knownPlayers.filter((x) => typeof x === 'string') : [],
    lastRules,
    keepAwake: d.keepAwake ?? true,
    defaultsRev: DEFAULTS_REV,
  };
}

let state: AppData = load();
let saveFailed = false;
const listeners = new Set<() => void>();

function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
    saveFailed = false;
  } catch {
    saveFailed = true;
  }
}

export function getState() {
  return state;
}

export function storageFailed() {
  return saveFailed;
}

export function setState(update: (s: AppData) => AppData) {
  state = update(state);
  persist();
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function useAppData(): AppData {
  return useSyncExternalStore(subscribe, getState, getState);
}

export function useSession(id: string | undefined): Session | undefined {
  const data = useAppData();
  return id ? data.sessions.find((s) => s.id === id) : undefined;
}

/* ---------- actions ---------- */

function patchSession(id: string, fn: (s: Session) => Session) {
  setState((d) => ({
    ...d,
    sessions: d.sessions.map((s) => (s.id === id ? { ...fn(s), updatedAt: Date.now() } : s)),
  }));
}

export const actions = {
  createSession(session: Session) {
    setState((d) => {
      const names = session.players.map((p) => p.name);
      const known = [...names, ...d.knownPlayers.filter((n) => !names.some((m) => m.toLowerCase() === n.toLowerCase()))].slice(0, 30);
      return {
        ...d,
        sessions: [session, ...d.sessions.filter((s) => !s.example || session.example)],
        knownPlayers: session.example ? d.knownPlayers : known,
        lastRules: session.example ? d.lastRules : session.rules,
      };
    });
  },
  updateSession(id: string, fn: (s: Session) => Session) {
    patchSession(id, fn);
  },
  deleteSession(id: string) {
    setState((d) => ({ ...d, sessions: d.sessions.filter((s) => s.id !== id) }));
  },
  restoreSession(session: Session, index: number) {
    setState((d) => {
      const sessions = [...d.sessions];
      sessions.splice(Math.min(index, sessions.length), 0, session);
      return { ...d, sessions };
    });
  },
  addGame(id: string, game: Game) {
    patchSession(id, (s) => ({ ...s, games: [...s.games, game], nextDealerId: undefined }));
  },
  updateGame(id: string, game: Game) {
    patchSession(id, (s) => ({ ...s, games: s.games.map((g) => (g.id === game.id ? game : g)) }));
  },
  deleteGame(id: string, gameId: string) {
    patchSession(id, (s) => {
      const index = s.games.findIndex((g) => g.id === gameId);
      if (index < 0) return s;
      return {
        ...s,
        games: s.games.filter((g) => g.id !== gameId),
        manualBocks: s.manualBocks.map((m) => (m.beforeGame > index ? { ...m, beforeGame: m.beforeGame - 1 } : m)),
      };
    });
  },
  addManualBock(id: string, count: number) {
    patchSession(id, (s) => ({ ...s, manualBocks: [...s.manualBocks, { beforeGame: s.games.length, count }] }));
  },
  /** Removes manual Bock rounds that have not started yet. */
  removePendingManualBock(id: string) {
    patchSession(id, (s) => {
      const i = s.manualBocks.map((m) => m.beforeGame >= s.games.length).lastIndexOf(true);
      if (i < 0) return s;
      const list = [...s.manualBocks];
      const m = list[i];
      if (m.count > 1) list[i] = { ...m, count: m.count - 1 };
      else list.splice(i, 1);
      return { ...s, manualBocks: list };
    });
  },
  setRules(id: string, rules: Rules) {
    patchSession(id, (s) => ({ ...s, rules }));
    setState((d) => ({ ...d, lastRules: rules }));
  },
  setKeepAwake(on: boolean) {
    setState((d) => ({ ...d, keepAwake: on }));
  },
  importData(data: AppData) {
    setState((d) => {
      const ids = new Set(data.sessions.map((s) => s.id));
      return {
        ...d,
        sessions: [...data.sessions, ...d.sessions.filter((s) => !ids.has(s.id))].sort((a, b) => b.updatedAt - a.updatedAt),
        knownPlayers: Array.from(new Set([...d.knownPlayers, ...data.knownPlayers])).slice(0, 30),
      };
    });
  },
};

/* ---------- small per-device preferences ---------- */

const PREF_KEY = 'doko-block:prefs';
export interface Prefs {
  cellMode: 'stand' | 'punkte';
  entryMode: 'calc' | 'quick';
  augenParty: 're' | 'kontra';
  /** Rechner: enter the result (winner + keine 90 …) or the exact Augen. */
  augenInput: 'result' | 'exact';
}
const defaultPrefs: Prefs = { cellMode: 'stand', entryMode: 'calc', augenParty: 're', augenInput: 'result' };

export function loadPrefs(): Prefs {
  try {
    return { ...defaultPrefs, ...JSON.parse(localStorage.getItem(PREF_KEY) ?? '{}') };
  } catch {
    return defaultPrefs;
  }
}
export function savePrefs(p: Prefs) {
  try {
    localStorage.setItem(PREF_KEY, JSON.stringify(p));
  } catch {
    /* preferences are optional */
  }
}
