import { useMemo, useState } from 'react';
import { useAuth } from '../../state/AuthContext';
import { useHousehold } from '../../state/HouseholdContext';
import { currentStreakDays } from '../../domain/economy';
import { parentPrizeView, prizesForChild } from '../../domain/prizes';
import { deletePrize, markPrizeRevealed, refreshHintBand, savePrize } from '../../data/store';
import { Card, Empty, ErrorNote, Meter, Pill } from '../../components/ui';
import type { ChildMetrics, Prize, PrizeMetric } from '../../domain/types';

const METRIC_LABEL: Record<PrizeMetric, string> = {
  empathy: 'empathy points',
  streakDays: 'days in a row',
  lifetimeMinutes: 'minutes earned ever',
};

const METRIC_NOTE: Record<PrizeMetric, string> = {
  empathy:
    'Only adult-nominated deeds move this. Chores cannot touch it, so no amount of ' +
    'grinding buys the prize.',
  streakDays:
    'Consecutive days with at least one approved chore. Rewards turning up daily rather ' +
    'than one big Saturday.',
  lifetimeMinutes: 'Total minutes ever earned. Straight volume.',
};

/**
 * Prize ladders, per child.
 *
 * Parents see everything: the metric, the threshold, how close each kid is. The
 * kids see a vague band and nothing else, which is why this whole screen is
 * parent-only in the security rules rather than just hidden in the UI.
 */
export default function ManagePrizes() {
  const { householdId } = useAuth();
  const { children, prizes, prizeUnlocks, completions, balanceFor } = useHousehold();

  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState<{
    title: string;
    metric: PrizeMetric;
    threshold: number;
    childId: string;
  }>({ title: '', metric: 'empathy', threshold: 100, childId: '' });

  const metricsByChild = useMemo(() => {
    const map = new Map<string, ChildMetrics>();
    const now = Date.now();
    for (const child of children) {
      const balance = balanceFor(child.id);
      map.set(child.id, {
        empathy: balance.empathyPoints,
        lifetimeMinutes: balance.lifetimeMinutes,
        streakDays: currentStreakDays({ completions, childId: child.id, now }),
      });
    }
    return map;
  }, [children, balanceFor, completions]);

  async function onAdd(event: React.FormEvent) {
    event.preventDefault();
    if (!householdId || !draft.title.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await savePrize({
        householdId,
        prize: {
          title: draft.title.trim(),
          metric: draft.metric,
          threshold: Math.max(1, Math.round(draft.threshold)),
          childId: draft.childId || null,
          active: true,
        },
      });
      setDraft({ title: '', metric: 'empathy', threshold: 100, childId: '' });
    } catch {
      setError('Could not save that prize.');
    } finally {
      setBusy(false);
    }
  }

  async function onToggle(prize: Prize) {
    if (!householdId) return;
    await savePrize({
      householdId,
      prize: {
        id: prize.id,
        title: prize.title,
        metric: prize.metric,
        threshold: prize.threshold,
        childId: prize.childId,
        active: !prize.active,
      },
    }).catch(() => setError('Could not update that prize.'));
  }

  async function onDelete(prize: Prize) {
    if (!householdId) return;
    if (!window.confirm(`Delete "${prize.title}"? Unlocks already earned stay recorded.`)) {
      return;
    }
    await deletePrize(householdId, prize.id).catch(() => setError('Could not delete that.'));
  }

  async function onReveal(prizeId: string, childId: string) {
    if (!householdId) return;
    try {
      await markPrizeRevealed({ householdId, prizeId, childId });
      // Clears the child's "you unlocked something" banner and moves their hint
      // on to the next rung.
      await refreshHintBand({
        householdId,
        childId,
        metrics:
          metricsByChild.get(childId) ?? { empathy: 0, streakDays: 0, lifetimeMinutes: 0 },
      });
    } catch {
      setError('Could not mark that revealed.');
    }
  }

  const pendingReveal = prizeUnlocks.filter((u) => !u.revealedAt);

  return (
    <>
      <ErrorNote message={error} />

      {pendingReveal.length > 0 && (
        <Card variant="hint">
          <h3>Waiting to be revealed</h3>
          {pendingReveal.map((unlock) => {
            const prize = prizes.find((p) => p.id === unlock.prizeId);
            const child = children.find((c) => c.id === unlock.childId);
            return (
              <div className="row between" key={unlock.id} style={{ marginBottom: 8 }}>
                <div className="grow">
                  <strong>{child?.displayName ?? 'Someone'}</strong> unlocked{' '}
                  <strong>{prize?.title ?? 'a deleted prize'}</strong>
                </div>
                <button className="good" onClick={() => void onReveal(unlock.prizeId, unlock.childId)}>
                  Told them
                </button>
              </div>
            );
          })}
          <p className="muted">
            Their screen just says "you unlocked something". Tell them in person — that is the
            whole point of keeping it hidden.
          </p>
        </Card>
      )}

      {children.map((child) => {
        const metrics = metricsByChild.get(child.id) ?? {
          empathy: 0,
          streakDays: 0,
          lifetimeMinutes: 0,
        };
        const ladder = prizesForChild(child.id, prizes).sort(
          (a, b) => a.threshold - b.threshold,
        );

        return (
          <div key={child.id}>
            <h2>{child.displayName}</h2>
            <Card tight>
              <div className="row wrap">
                <Pill tone="gold">{metrics.empathy} empathy</Pill>
                <Pill tone="good">{metrics.streakDays} day streak</Pill>
                <Pill>{metrics.lifetimeMinutes} min lifetime</Pill>
              </div>
            </Card>

            {ladder.length === 0 ? (
              <Empty>No prizes for {child.displayName} yet.</Empty>
            ) : (
              <div className="stack">
                {ladder.map((prize) => {
                  const view = parentPrizeView({
                    prize,
                    childId: child.id,
                    metrics,
                    unlocks: prizeUnlocks,
                  });
                  return (
                    <div className="card tight" key={`${prize.id}-${child.id}`}>
                      <div className="row between">
                        <div className="grow">
                          <h3>{prize.title}</h3>
                          <div className="row wrap">
                            <Pill>
                              {prize.threshold} {METRIC_LABEL[prize.metric]}
                            </Pill>
                            {prize.childId === null && <Pill>shared</Pill>}
                            {!prize.active && <Pill tone="bad">off</Pill>}
                            {view.unlocked && (
                              <Pill tone={view.revealed ? 'good' : 'gold'}>
                                {view.revealed ? 'given' : 'unlocked, not told'}
                              </Pill>
                            )}
                          </div>
                          <p className="muted" style={{ marginTop: 6 }}>
                            {view.current} of {prize.threshold}
                            {view.remaining > 0 ? ` — ${view.remaining} to go` : ' — reached'}
                          </p>
                          <Meter percent={view.percent} />
                        </div>
                      </div>
                      <div className="row" style={{ marginTop: 10 }}>
                        <button className="ghost" onClick={() => void onToggle(prize)}>
                          {prize.active ? 'Turn off' : 'Turn on'}
                        </button>
                        <button className="bad" onClick={() => void onDelete(prize)}>
                          Delete
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}

      <h2>Add a prize</h2>
      <Card>
        <form onSubmit={onAdd}>
          <div className="field">
            <label htmlFor="ptitle">What it is</label>
            <input
              id="ptitle"
              value={draft.title}
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              placeholder="Trampoline park trip"
              required
            />
          </div>
          <div className="field">
            <label htmlFor="pwho">Who it's for</label>
            <select
              id="pwho"
              value={draft.childId}
              onChange={(e) => setDraft({ ...draft, childId: e.target.value })}
            >
              <option value="">Either of them</option>
              {children.map((child) => (
                <option key={child.id} value={child.id}>
                  {child.displayName}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="pmetric">What has to build up</label>
            <select
              id="pmetric"
              value={draft.metric}
              onChange={(e) => setDraft({ ...draft, metric: e.target.value as PrizeMetric })}
            >
              {(Object.keys(METRIC_LABEL) as PrizeMetric[]).map((metric) => (
                <option key={metric} value={metric}>
                  {METRIC_LABEL[metric]}
                </option>
              ))}
            </select>
            <p className="muted" style={{ marginTop: 6 }}>
              {METRIC_NOTE[draft.metric]}
            </p>
          </div>
          <div className="field">
            <label htmlFor="pthreshold">How many</label>
            <input
              id="pthreshold"
              type="number"
              min={1}
              value={draft.threshold}
              onChange={(e) => setDraft({ ...draft, threshold: Number(e.target.value) })}
            />
          </div>
          <button className="primary big" type="submit" disabled={busy || !draft.title.trim()}>
            {busy ? 'Saving…' : 'Add prize'}
          </button>
        </form>
      </Card>
    </>
  );
}
