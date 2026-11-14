import { describe, expect, it } from 'vitest';
import { DEFAULT_RULES } from '../state/defaults';
import { emptyExtras, scoreCalc } from './scoring';
import { resultOptions } from './resultEntry';

const R = DEFAULT_RULES;
const value = (reAugen: number, reAnn = 0 as const, kontraAnn = 0 as const) =>
  scoreCalc({ reAugen, reAnn, kontraAnn, reExtras: emptyExtras(), kontraExtras: emptyExtras() }, false, R).reValue;

describe('quick result entry', () => {
  it('needs no Augen for plain results', () => {
    const won = resultOptions('re', 0, 0, 0, false, R);
    expect(won).toHaveLength(1);
    expect(value(won[0].reAugen)).toBe(1);
    const k90 = resultOptions('re', 1, 0, 0, false, R);
    expect(value(k90[0].reAugen)).toBe(2);
    const schwarz = resultOptions('kontra', 4, 0, 0, false, R);
    expect(schwarz).toEqual([{ reAugen: 0, label: '240' }]);
    expect(value(0)).toBe(-6); // gewonnen, u90, u60, u30, schwarz, gegen die Alten
  });
  it('maps every level to the right band', () => {
    expect(resultOptions('re', 2, 0, 0, false, R)[0].label).toBe('181–210');
    expect(resultOptions('re', 3, 0, 0, false, R)[0].label).toBe('211–239');
    expect(resultOptions('kontra', 1, 0, 0, false, R)[0].label).toBe('151–180');
  });
  it('asks for the Augen range only when the losers made an Absage', () => {
    // Re said "keine 90" and lost: Kontra gets "120 gegen keine 90" only with 120+ Augen.
    expect(resultOptions('kontra', 0, 2, 0, false, R).map((o) => o.label)).toEqual(['90–119', '121–150']);
    // Kontra said "keine 60" and lost: Re's points depend on reaching 90 and 120.
    expect(resultOptions('re', 0, 0, 3, false, R).map((o) => o.label)).toEqual(['60–89', '90–119', '121–150']);
  });
  it('rejects results that contradict the announcements', () => {
    // Re said "keine 60" but Kontra had 60–89: Re cannot have won "keine 90".
    expect(resultOptions('re', 1, 3, 0, false, R)).toEqual([]);
  });
  it('works for a solo', () => {
    const o = resultOptions('re', 1, 1, 0, true, R);
    expect(o).toHaveLength(1);
    expect(scoreCalc({ reAugen: o[0].reAugen, reAnn: 1, kontraAnn: 0, reExtras: emptyExtras(), kontraExtras: emptyExtras() }, true, R).reValue).toBe(4);
  });
});
