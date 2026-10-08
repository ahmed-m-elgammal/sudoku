// ledgerLaw — the gate's pin on the Great Ledger's math (specs/17 phase 5.6).
//
// The web build keeps these inline in ../src/app/game/LedgerProfile.tsx; the port
// extracted them so they can be held WITHOUT native chrome. Each test cites the
// web line it pins:
//
//   SPARK    the standing graph's polyline (:24) — the exact points, the 20-window,
//            and the one-sided clamp (below-800 standings dip under the frame)
//   RATE     the win-rate percentiles (:94-98) incl. the missing-Order fallback
//   AUDIT    the T13 server-Ink guard (:36) — ok + finite or the line stays hidden
//   RECOVER  the restore law (:214-221) — ok + number, then MAX (local un-synced
//            Ink wins); the 5.6 done-when's "moves Ink to another device"
//   IMPORT   the save contract (:190-197) — JSON.parse + v:2, fail-closed
//   EXPORT   the payload (:175-178) — assize-save.json, pretty-printed
import { describe, it, expect } from 'vitest';
import {
  EXPORT_FILE_NAME,
  NAME_MAX,
  RECENT_CAP,
  STANDING_WINDOW,
  WIN_RATE_ORDERS,
  exportPayload,
  parseSaveImport,
  recoveryInkFrom,
  restoredInk,
  serverInkFrom,
  sparkPoints,
  winRatePct,
} from '@/ui/screens/ledgerLaw';
import { freshSave } from '@/state/save';

describe('ledgerLaw spark (LedgerProfile.tsx:24)', () => {
  it('SPARK-1 a single standing maps onto x=0 and the 800..2000 → 70..0 scale', () => {
    // (1000 - 800) / 1200 * 70 = 11.66…; y = 70 - 11.66… — the web's exact float
    expect(sparkPoints([1000])).toBe('0,58.333333333333336');
  });

  it('SPARK-2 two standings sweep x 0..280 in order', () => {
    const pts = sparkPoints([1000, 1600]).split(' ');
    expect(pts).toHaveLength(2);
    expect(pts[0]).toBe('0,58.333333333333336');
    // (1600-800)/1200*70 = 46.66… → y = 23.33…
    expect(pts[1]).toBe('280,23.333333333333336');
  });

  it(`SPARK-3 the window is the LAST ${STANDING_WINDOW} standings`, () => {
    const hist = Array.from({ length: 30 }, (_, i) => 800 + i * 40);
    expect(sparkPoints(hist).split(' ')).toHaveLength(STANDING_WINDOW);
    // the first point is the 11th standing (the window dropped the oldest ten)
    expect(sparkPoints(hist).startsWith(`0,${sparkPoints([hist[10]])!.split(',')[1]}`)).toBe(true);
  });

  it('SPARK-4 the clamp is one-sided: a Standing below 800 dips BELOW the frame', () => {
    // 70 - min(70, (500-800)/1200*70) = 70 + 17.5 — unclamped, the SVG crops it
    expect(sparkPoints([500])).toBe('0,87.5');
    // a Standing at/above 2000 clamps to the top edge (y = 0)
    expect(sparkPoints([2000]).endsWith(',0')).toBe(true);
    expect(sparkPoints([2400]).endsWith(',0')).toBe(true);
  });
});

describe('ledgerLaw win rate (LedgerProfile.tsx:94-98)', () => {
  it('RATE-1 the rows are the web\'s four Orders, in the web\'s order', () => {
    expect([...WIN_RATE_ORDERS]).toEqual(['scholar', 'executioner', 'apothecary', 'warden']);
  });

  it('RATE-2 a missing Order falls back to {w:0,l:0} → 0%', () => {
    expect(winRatePct({}, 'scholar')).toBe(0);
    expect(winRatePct({ apothecary: { w: 0, l: 0 } }, 'apothecary')).toBe(0);
  });

  it('RATE-3 the percentile rounds half-up over w/(w+l)', () => {
    expect(winRatePct({ scholar: { w: 3, l: 1 } }, 'scholar')).toBe(75);
    expect(winRatePct({ scholar: { w: 1, l: 2 } }, 'scholar')).toBe(33); // 33.33… → 33
    expect(winRatePct({ scholar: { w: 2, l: 1 } }, 'scholar')).toBe(67); // 66.66… → 67
  });
});

describe('ledgerLaw server-Ink audit (T13, LedgerProfile.tsx:36)', () => {
  it('AUDIT-1 an ok response with a finite ink number is shown', () => {
    expect(serverInkFrom({ ok: true, ink: 555 })).toBe(555);
  });

  it('AUDIT-2 anything else leaves the line hidden (null)', () => {
    expect(serverInkFrom(null)).toBeNull();
    expect(serverInkFrom(undefined)).toBeNull();
    expect(serverInkFrom({ ok: false, ink: 555 })).toBeNull();
    expect(serverInkFrom({ ok: true })).toBeNull();
    expect(serverInkFrom({ ok: true, ink: '555' })).toBeNull();
    expect(serverInkFrom({ ok: true, ink: Number.NaN })).toBeNull();
    expect(serverInkFrom({ ok: true, ink: Number.POSITIVE_INFINITY })).toBeNull();
  });
});

describe('ledgerLaw recovery restore (T13, LedgerProfile.tsx:214-221)', () => {
  it('RECOVER-1 an ok response with an ink number restores; the rest refuses', () => {
    expect(recoveryInkFrom({ ok: true, ink: 500 })).toBe(500);
    expect(recoveryInkFrom({ ok: false, ink: 500 })).toBeNull();
    expect(recoveryInkFrom(null)).toBeNull();
    expect(recoveryInkFrom({ ok: true })).toBeNull();
  });

  it('RECOVER-2 the MAX law: un-synced local Ink the server never heard about wins', () => {
    expect(restoredInk(0, 500)).toBe(500);
    expect(restoredInk(900, 500)).toBe(900);
    expect(restoredInk(500, 500)).toBe(500);
  });
});

describe('ledgerLaw save import (LedgerProfile.tsx:190-197)', () => {
  it('IMPORT-1 a v:2 save parses through', () => {
    const save = freshSave('Gaunt Notary 4821');
    expect(parseSaveImport(JSON.stringify(save))).toEqual(save);
  });

  it('IMPORT-2 everything else is refused fail-closed (the error sound\'s territory)', () => {
    expect(parseSaveImport('not json')).toBeNull();
    expect(parseSaveImport('')).toBeNull();
    expect(parseSaveImport('null')).toBeNull();
    expect(parseSaveImport('[]')).toBeNull();
    expect(parseSaveImport('{"v":1}')).toBeNull();
    expect(parseSaveImport('{"v":"2"}')).toBeNull();
    expect(parseSaveImport('2')).toBeNull();
  });
});

describe('ledgerLaw save export (LedgerProfile.tsx:175-178)', () => {
  it('EXPORT-1 the payload is the save, pretty-printed, under the web\'s file name', () => {
    const save = freshSave('Sallow Quill 1000');
    const text = exportPayload(save);
    expect(EXPORT_FILE_NAME).toBe('assize-save.json');
    expect(JSON.parse(text)).toEqual(save);
    expect(text).toContain('\n  "v": 2');
  });

  it('EXPORT-2 the name cap is the web input\'s maxLength', () => {
    expect(NAME_MAX).toBe(24);
    expect(RECENT_CAP).toBe(20);
  });
});
