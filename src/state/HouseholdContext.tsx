/**
 * One live subscription set for the whole household, shared by every screen.
 *
 * A child's listeners are scoped to their own rows, because that is all the
 * Firestore rules will hand over. A parent sees everything.
 */

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  watchChores,
  watchCompletions,
  watchDeeds,
  watchGrants,
  watchLedger,
  watchMembers,
  watchPasses,
  watchPrizeUnlocks,
  watchPrizes,
  watchSettings,
} from '../data/store';
import { computeBalance } from '../domain/economy';
import { DEFAULT_SETTINGS } from '../domain/types';
import type {
  Balance,
  Chore,
  Completion,
  Deed,
  Grant,
  HouseholdSettings,
  LedgerEntry,
  Member,
  Pass,
  Prize,
  PrizeUnlock,
} from '../domain/types';
import { useAuth } from './AuthContext';

interface HouseholdState {
  ready: boolean;
  members: Member[];
  children: Member[];
  parents: Member[];
  chores: Chore[];
  completions: Completion[];
  deeds: Deed[];
  passes: Pass[];
  ledger: LedgerEntry[];
  grants: Grant[];
  /** Empty for a child: the rules deny them any read here. */
  prizes: Prize[];
  prizeUnlocks: PrizeUnlock[];
  settings: HouseholdSettings;
  balanceFor: (childId: string) => Balance;
  memberName: (id: string) => string;
  caregiver: Member | null;
}

const HouseholdContext = createContext<HouseholdState | null>(null);

export function HouseholdProvider({ children }: { children: ReactNode }) {
  const { householdId, member } = useAuth();

  const [members, setMembers] = useState<Member[]>([]);
  const [chores, setChores] = useState<Chore[]>([]);
  const [completions, setCompletions] = useState<Completion[]>([]);
  const [deeds, setDeeds] = useState<Deed[]>([]);
  const [passes, setPasses] = useState<Pass[]>([]);
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [grants, setGrants] = useState<Grant[]>([]);
  const [prizes, setPrizes] = useState<Prize[]>([]);
  const [prizeUnlocks, setPrizeUnlocks] = useState<PrizeUnlock[]>([]);
  const [settings, setSettings] = useState<HouseholdSettings>(DEFAULT_SETTINGS);
  const [ready, setReady] = useState(false);

  const isParent = member?.role === 'parent';
  const scope = isParent ? null : (member?.id ?? null);

  useEffect(() => {
    if (!householdId || !member) return;

    const unsubs = [
      watchMembers(householdId, setMembers),
      watchChores(householdId, setChores),
      watchCompletions(householdId, scope, setCompletions),
      watchDeeds(householdId, scope, setDeeds),
      watchPasses(householdId, scope, setPasses),
      watchLedger(householdId, scope, setLedger),
      watchGrants(householdId, scope, setGrants),
      watchPrizeUnlocks(householdId, scope, setPrizeUnlocks),
      watchSettings(householdId, setSettings),
    ];

    // Prize titles and thresholds are parent-only. Not subscribing for a child
    // is belt to the rules' braces: nothing secret ever reaches that device.
    if (isParent) unsubs.push(watchPrizes(householdId, setPrizes));

    setReady(true);
    return () => unsubs.forEach((u) => u());
  }, [householdId, member, isParent, scope]);

  const value = useMemo<HouseholdState>(() => {
    const byId = new Map(members.map((m) => [m.id, m]));
    return {
      ready,
      members,
      children: members.filter((m) => m.role === 'child'),
      parents: members.filter((m) => m.role === 'parent'),
      chores,
      completions,
      deeds,
      passes,
      ledger,
      grants,
      prizes,
      prizeUnlocks,
      settings,
      balanceFor: (childId) => computeBalance(childId, ledger),
      memberName: (id) => byId.get(id)?.displayName ?? 'Someone',
      caregiver: settings.primaryCaregiverId
        ? byId.get(settings.primaryCaregiverId) ?? null
        : members.find((m) => m.isPrimaryCaregiver) ?? null,
    };
  }, [ready, members, chores, completions, deeds, passes, ledger, grants, prizes, prizeUnlocks, settings]);

  return <HouseholdContext.Provider value={value}>{children}</HouseholdContext.Provider>;
}

export function useHousehold(): HouseholdState {
  const ctx = useContext(HouseholdContext);
  if (!ctx) throw new Error('useHousehold must be used inside HouseholdProvider');
  return ctx;
}
