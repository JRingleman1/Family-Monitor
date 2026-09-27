import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../state/AuthContext';
import { useHousehold } from '../../state/HouseholdContext';
import { useChildPolicies } from '../../state/useChildPolicies';
import { baselineStatus, currentStreakDays, effectivePolicy } from '../../domain/economy';
import { expireStalePasses } from '../../data/store';
import { Avatar, Card, Pill, formatMinutes } from '../../components/ui';
import ApprovalQueue from './ApprovalQueue';
import GrantScreenTime from './GrantScreenTime';
import ManageChores from './ManageChores';
import ManageMembers from './ManageMembers';
import ManagePrizes from './ManagePrizes';
import NominateDeed from './NominateDeed';
import Settings from './Settings';

type Tab = 'queue' | 'deeds' | 'grant' | 'prizes' | 'chores' | 'family' | 'settings';

const TABS: { key: Tab; label: string }[] = [
  { key: 'queue', label: 'Queue' },
  { key: 'deeds', label: 'Deeds' },
  { key: 'grant', label: 'Screen time' },
  { key: 'prizes', label: 'Prizes' },
  { key: 'chores', label: 'Chores' },
  { key: 'family', label: 'Family' },
  { key: 'settings', label: 'Settings' },
];

export default function ParentHome() {
  const { member, householdId, signOut } = useAuth();
  const { children, chores, completions, deeds, grants, settings, balanceFor } = useHousehold();
  const { policyFor } = useChildPolicies();
  const [tab, setTab] = useState<Tab>('queue');

  // Cheap housekeeping on load: passes nobody used should stop looking live.
  useEffect(() => {
    if (!householdId) return;
    void expireStalePasses(householdId).catch(() => {
      // Not worth surfacing. Worst case a stale pass shows one more time.
    });
  }, [householdId]);

  const waiting =
    completions.filter((c) => c.status === 'pending').length +
    deeds.filter((d) => d.status === 'pending').length;
  const requests = grants.filter((g) => g.status === 'requested').length;

  const summaries = useMemo(() => {
    const now = Date.now();
    return children.map((child) => {
      const policy = effectivePolicy(settings, policyFor(child.id), child.id);
      return {
        child,
        policy,
        balance: balanceFor(child.id),
        streak: currentStreakDays({ completions, childId: child.id, now }),
        baseline: baselineStatus({ chores, completions, childId: child.id, now }),
      };
    });
  }, [children, settings, policyFor, balanceFor, completions, chores]);

  if (!member) return null;

  return (
    <div className="app">
      <div className="topbar">
        <div>
          <h1>{member.displayName}</h1>
          <p className="muted" style={{ margin: 0 }}>
            {waiting > 0 ? `${waiting} waiting on you` : 'Nothing waiting'}
            {requests > 0 ? ` · ${requests} screen time request${requests === 1 ? '' : 's'}` : ''}
          </p>
        </div>
        <button className="ghost" onClick={() => void signOut()}>
          Sign out
        </button>
      </div>

      <div className="stack" style={{ marginBottom: 14 }}>
        {summaries.map(({ child, policy, balance, streak, baseline }) => (
          <div className="card tight" key={child.id}>
            <div className="row">
              <Avatar member={child} />
              <div className="grow">
                <h3>{child.displayName}</h3>
                <div className="row wrap">
                  <Pill tone="good">{formatMinutes(balance.availableMinutes)} banked</Pill>
                  <Pill tone="gold">{balance.empathyPoints} empathy</Pill>
                  {streak > 0 && <Pill>{streak} day streak</Pill>}
                  <Pill>{policy.label}</Pill>
                  {policy.requireBaselineForCashout &&
                    (baseline.satisfied ? (
                      <Pill tone="good">own jobs done</Pill>
                    ) : (
                      <Pill tone="warn">
                        {baseline.outstanding.length} own job
                        {baseline.outstanding.length === 1 ? '' : 's'} left
                      </Pill>
                    ))}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="tabs" role="tablist">
        {TABS.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-current={tab === key}
            onClick={() => setTab(key)}
          >
            {label}
            {key === 'queue' && waiting > 0 ? ` (${waiting})` : ''}
            {key === 'grant' && requests > 0 ? ` (${requests})` : ''}
          </button>
        ))}
      </div>

      {tab === 'queue' && <ApprovalQueue />}
      {tab === 'deeds' && <NominateDeed />}
      {tab === 'grant' && <GrantScreenTime />}
      {tab === 'prizes' && <ManagePrizes />}
      {tab === 'chores' && <ManageChores />}
      {tab === 'family' && <ManageMembers />}
      {tab === 'settings' && <Settings />}

      {children.length === 0 && (
        <Card variant="banner">
          No kids added yet. Open the Family tab and add them, then run the seed script to
          load the two tracks.
        </Card>
      )}
    </div>
  );
}
