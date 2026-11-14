export type PlayerId = string;

export interface Player {
  id: PlayerId;
  name: string;
}

/** Ansage/Absage level of one party: 0 none, 1 Re/Kontra, 2 keine 90, 3 keine 60, 4 keine 30, 5 schwarz. */
export type Ann = 0 | 1 | 2 | 3 | 4 | 5;

export type Party = 're' | 'kontra';

export type GameKind = 'normal' | 'hochzeit' | 'armut' | 'solo';

export type SoloType =
  | 'damen'
  | 'buben'
  | 'fleischlos'
  | 'kreuz'
  | 'pik'
  | 'herz'
  | 'karo'
  | 'stille-hochzeit';

export interface Extras {
  fuchs: number;
  doppelkopf: number;
  karlchen: number;
  /** House rule: opponents' Herz-10 (Dulle) caught in the last trick. */
  dulle: number;
}

export interface CalcInput {
  /** Augen of the Re party, 0..240. */
  reAugen: number;
  reAnn: Ann;
  kontraAnn: Ann;
  reExtras: Extras;
  kontraExtras: Extras;
}

export interface QuickInput {
  winner: Party | null; // null = no winner (value 0)
  /** Spielwert per Spieler before Bock (solo: what each opponent pays). */
  value: number;
}

export type BockTrigger = 'tie120' | 'lostKontra' | 'lostRe' | 'lostSolo' | 'zeroGame' | 'manual';

/** Bock triggers that the app can detect from a game result. */
export type AutoTrigger = Exclude<BockTrigger, 'manual'>;

export interface Game {
  id: string;
  createdAt: number;
  dealerId: PlayerId;
  /** The four players at the table for this game. */
  playerIds: PlayerId[];
  kind: GameKind;
  soloType?: SoloType;
  /** Solo counts as the soloist's Pflichtsolo. */
  pflicht?: boolean;
  /** Re party. For a solo: just the soloist. */
  reIds: PlayerId[];
  mode: 'calc' | 'quick';
  calc?: CalcInput;
  quick?: QuickInput;
  /** Bock rounds triggered by this game (each entry = one Bockrunde). */
  bockTriggers: BockTrigger[];
}

export interface Rules {
  extras: {
    fuchs: boolean;
    doppelkopf: boolean;
    karlchen: boolean;
    dulle: boolean;
    gegenDieAlten: boolean;
  };
  bock: {
    enabled: boolean;
    /** sequential: queued rounds play one after another (×2). overlap: rounds stack (×2, ×4, …). */
    mode: 'sequential' | 'overlap';
    triggers: {
      tie120: boolean;
      /** "Kontra" was announced and the Kontra party did not win. */
      lostKontra: boolean;
      /** "Re" was announced and the Re party did not win. */
      lostRe: boolean;
      lostSolo: boolean;
      zeroGame: boolean;
    };
  };
  pflichtsolo: {
    enabled: boolean;
    /** After a Pflichtsolo the same player deals again. */
    dealerStays: boolean;
  };
  lustsolo: {
    /** House rule: the soloist leads, so the same player deals again – unless the soloist would have led anyway. */
    dealerStays: boolean;
  };
  /** Who sits out with 6/7 players: opposite = dealer + player(s) opposite, left4 = the four left of dealer play. */
  sitOut: 'opposite' | 'left4';
  /** Planned number of rounds, null = open end. */
  rounds: number | null;
  money: {
    centsPerPoint: number;
    mode: 'pairwise' | 'pot';
  };
}

export interface ManualBock {
  /** Bock round starts with the game at this index (0-based). */
  beforeGame: number;
  count: number;
}

export interface Session {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  finishedAt?: number;
  example?: boolean;
  /** Everyone who ever took part. */
  players: Player[];
  /** Current table in clockwise order (4–7 player ids). */
  seating: PlayerId[];
  firstDealerId: PlayerId;
  /** Overrides the computed dealer for the next game. */
  nextDealerId?: PlayerId;
  rules: Rules;
  games: Game[];
  manualBocks: ManualBock[];
}

export interface AppData {
  version: 1;
  sessions: Session[];
  knownPlayers: string[];
  lastRules?: Rules;
  keepAwake: boolean;
}
