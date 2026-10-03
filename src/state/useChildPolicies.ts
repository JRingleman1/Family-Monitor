import { useEffect, useMemo, useState } from 'react';
import { watchChildPolicies, watchChildPolicy } from '../data/store';
import { useAuth } from './AuthContext';
import type { ChildPolicy } from '../domain/types';

/**
 * Per-child track overrides.
 *
 * A parent listens to the whole collection. A child listens only to their own
 * document, because the rules allow a read only on that one and Firestore
 * refuses a collection query it cannot prove stays inside what is allowed.
 */
export function useChildPolicies() {
  const { householdId, member } = useAuth();
  const [policies, setPolicies] = useState<ChildPolicy[]>([]);

  useEffect(() => {
    if (!householdId || !member) return;

    if (member.role === 'parent') {
      return watchChildPolicies(householdId, setPolicies);
    }
    return watchChildPolicy(householdId, member.id, (policy) => {
      setPolicies(policy ? [policy] : []);
    });
  }, [householdId, member]);

  return useMemo(() => {
    const byId = new Map(policies.map((p) => [p.childId, p]));
    return {
      policies,
      policyFor: (childId: string) => byId.get(childId),
    };
  }, [policies]);
}
