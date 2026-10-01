// WeeklyScreen (T21) — the Weekly Assize: the Daily's week-long sibling. One
// deterministic modified duel per week, identical for every Clerk: two named
// writs (rule modifiers) read aloud, a fixed presiding Shade wearing a real
// Magistrate arc, and a Monday turnover. One completion per week; the first
// win mints the Ink bonus.
'use client';
import { useMemo } from 'react';
import { useUi } from '@/state/ui';
import { useSave } from '@/state/save';
import i18n from '@/i18n/en.json';
import { synth } from '@/audio/synth';
import { weekIndexFor, weekEndsAtMs, weeklyForWeek, weeklyModDefs, weeklyInkBonus } from '@shared/weekly';

export default function WeeklyScreen() {
  const ui = useUi();
  const save = useSave((s) => s.save);

  const { week, foe, writs } = useMemo(
    () => {
      const w = weekIndexFor(Date.now());
      return { week: w, foe: weeklyForWeek(w), writs: weeklyModDefs(w) };
    },
    [], // the screen mounts fresh per visit; the week cannot turn mid-mount in practice
  );

  if (!save) return null;
  const sat = save.weekly?.lastWeek === week;
  const msLeft = Math.max(0, weekEndsAtMs(week) - Date.now());
  const days = Math.floor(msLeft / 86_400_000);
  const hours = Math.floor((msLeft % 86_400_000) / 3_600_000);

  return (
    <main className="page-turn" style={{ minHeight: '100dvh', padding: 'calc(var(--safe-top) + 18px) 16px calc(var(--safe-bottom) + 24px)' }}>
      <header style={{ marginBottom: 8 }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--fs-lg)' }}>{i18n.weekly.title}</h1>
      </header>
      <p style={{ color: 'var(--fg-dim)', fontSize: 'var(--fs-sm)', maxWidth: 520, marginBottom: 14 }}>{i18n.weekly.sub}</p>

      <div style={{ display: 'grid', gap: 10, maxWidth: 560 }}>
        <div className="panel card" style={{ padding: '14px 16px' }}>
          <p style={{ color: 'var(--fg-dim)', fontSize: 'var(--fs-xs)' }}>{i18n.weekly.writsLabel}</p>
          {writs.map((m) => (
            <div key={m.id} style={{ marginTop: 8 }}>
              <h3 style={{ fontSize: 'var(--fs-md)', fontFamily: 'var(--font-display)', color: 'var(--brass)' }}>{m.name}</h3>
              <p style={{ color: 'var(--fg-dim)', fontSize: 'var(--fs-xs)' }}>{m.blurb}</p>
            </div>
          ))}
        </div>

        <div className="panel card" style={{ padding: '14px 16px' }}>
          <p style={{ color: 'var(--fg-dim)', fontSize: 'var(--fs-xs)' }}>{i18n.weekly.foeLabel}</p>
          <h3 style={{ fontSize: 'var(--fs-md)', fontFamily: 'var(--font-display)', marginTop: 4 }}>{foe.name}</h3>
          <p style={{ color: 'var(--fg-dim)', fontSize: 'var(--fs-xs)', marginTop: 4 }}>
            {i18n.weekly.tierLabel} {foe.tier} · {foe.seals[1]} {i18n.weekly.sealsLabel} · {foe.bossRung} ({i18n.weekly.arcBadge})
          </p>
          <button
            className="btn btn-primary"
            onClick={() => {
              synth.uiTap();
              ui.go('duel', { duelMode: 'weekly', campaignDuel: null, endlessRung: null, pendingEcho: null, pendingPersonalShade: null });
            }}
            style={{ marginTop: 12, width: '100%', minHeight: 44 }}
          >
            {i18n.weekly.sit} →
          </button>
        </div>

        <p style={{ color: sat ? 'var(--brass)' : 'var(--fg-dim)', fontSize: 'var(--fs-xs)', maxWidth: 560 }}>
          {sat ? i18n.weekly.satLine : i18n.weekly.openLine}
        </p>
        <p style={{ color: 'var(--fg-dim)', fontSize: 'var(--fs-xs)', maxWidth: 560 }}>
          {i18n.weekly.endsLabel.replace('{days}', String(days)).replace('{hours}', String(hours))}
          {' · '}
          {i18n.weekly.law.replace('{ink}', String(weeklyInkBonus))}
        </p>
      </div>

      <button
        className="panel card"
        onClick={() => { synth.uiTap(); ui.go('antechamber'); }}
        style={{ marginTop: 16, maxWidth: 560, width: '100%', textAlign: 'center', color: 'var(--fg-dim)' }}
      >
        ← {i18n.weekly.back}
      </button>
    </main>
  );
}
