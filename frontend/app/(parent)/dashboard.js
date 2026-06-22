import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet,
  TouchableOpacity, RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../src/context/AuthContext';
import { choresAPI, usersAPI } from '../../src/services/api';
import useStore from '../../src/store/useStore';
import { COLORS, SIZES, FONTS } from '../../src/constants/theme';

export default function ParentDashboard() {
  const insets = useSafeAreaInsets();
  const { logout } = useAuth();
  const { user, chores, setChores, children, setChildren } = useStore();
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    try {
      const [choresRes, childrenRes] = await Promise.all([
        choresAPI.getAll(),
        usersAPI.getChildren(),
      ]);
      setChores(choresRes.data);
      setChildren(childrenRes.data);
    } catch (e) {
      console.warn('Dashboard load error:', e.message);
    }
  };

  useEffect(() => { load(); }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const pending = chores.filter((c) => c.status !== 'completed').length;
  const completed = chores.filter((c) => c.status === 'completed').length;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: insets.bottom + SIZES.xl }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
    >
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Hello, {user?.name?.split(' ')[0]} 👋</Text>
          <Text style={styles.subgreeting}>Here's your family overview</Text>
        </View>
        <TouchableOpacity onPress={logout} style={styles.logoutBtn}>
          <Text style={styles.logoutText}>Sign out</Text>
        </TouchableOpacity>
      </View>

      {/* Your ID card */}
      <View style={styles.idCard}>
        <Text style={styles.idLabel}>Your Parent ID (share with kids):</Text>
        <Text style={styles.idValue}>{user?.uid}</Text>
      </View>

      {/* Stats row */}
      <View style={styles.statsRow}>
        <StatCard label="Kids" value={children.length} icon="👨‍👩‍👧" color={COLORS.primary} />
        <StatCard label="Pending" value={pending} icon="⏳" color={COLORS.warning} />
        <StatCard label="Done" value={completed} icon="✅" color={COLORS.success} />
      </View>

      {/* Children list */}
      {children.length > 0 && (
        <Section title="Your Children">
          {children.map((child) => (
            <ChildCard key={child.uid} child={child} />
          ))}
        </Section>
      )}

      {/* Recent chores */}
      {chores.length > 0 && (
        <Section title="Recent Chores">
          {chores.slice(0, 5).map((c) => (
            <ChoreRow key={c.id} chore={c} />
          ))}
        </Section>
      )}
    </ScrollView>
  );
}

function StatCard({ label, value, icon, color }) {
  return (
    <View style={[styles.statCard, { borderTopColor: color }]}>
      <Text style={styles.statIcon}>{icon}</Text>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function Section({ title, children }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function ChildCard({ child }) {
  return (
    <View style={styles.childCard}>
      <Text style={styles.childAvatar}>👦</Text>
      <View style={{ flex: 1 }}>
        <Text style={styles.childName}>{child.name}</Text>
        <Text style={styles.childSub}>{child.total_points} pts · {child.screen_time_allowance} min/day</Text>
      </View>
    </View>
  );
}

function ChoreRow({ chore }) {
  const statusColor = { pending: COLORS.warning, 'in-progress': COLORS.primary, completed: COLORS.success };
  return (
    <View style={styles.choreRow}>
      <View style={[styles.statusDot, { backgroundColor: statusColor[chore.status] || COLORS.subtext }]} />
      <View style={{ flex: 1 }}>
        <Text style={styles.choreTitle}>{chore.title}</Text>
        <Text style={styles.choreSub}>{chore.points} pts · {chore.status}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', padding: SIZES.lg },
  greeting: { ...FONTS.h2, color: COLORS.text },
  subgreeting: { ...FONTS.small, color: COLORS.subtext, marginTop: 2 },
  logoutBtn: { paddingVertical: SIZES.xs, paddingHorizontal: SIZES.sm },
  logoutText: { ...FONTS.small, color: COLORS.subtext },
  idCard: {
    marginHorizontal: SIZES.lg,
    backgroundColor: '#EEF0FF',
    borderRadius: 12,
    padding: SIZES.md,
    marginBottom: SIZES.md,
  },
  idLabel: { ...FONTS.small, color: COLORS.primary, fontWeight: '600', marginBottom: 4 },
  idValue: { ...FONTS.small, color: COLORS.text, fontFamily: 'monospace' },
  statsRow: { flexDirection: 'row', gap: SIZES.sm, paddingHorizontal: SIZES.lg, marginBottom: SIZES.md },
  statCard: {
    flex: 1,
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: SIZES.md,
    alignItems: 'center',
    borderTopWidth: 3,
  },
  statIcon: { fontSize: 22, marginBottom: 4 },
  statValue: { ...FONTS.h2 },
  statLabel: { ...FONTS.small, color: COLORS.subtext, marginTop: 2 },
  section: { marginHorizontal: SIZES.lg, marginBottom: SIZES.lg },
  sectionTitle: { ...FONTS.h3, color: COLORS.text, marginBottom: SIZES.sm },
  childCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: SIZES.md,
    marginBottom: SIZES.sm,
    gap: SIZES.sm,
  },
  childAvatar: { fontSize: 28 },
  childName: { ...FONTS.body, color: COLORS.text, fontWeight: '600' },
  childSub: { ...FONTS.small, color: COLORS.subtext },
  choreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: SIZES.md,
    marginBottom: SIZES.sm,
    gap: SIZES.sm,
  },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  choreTitle: { ...FONTS.body, color: COLORS.text, fontWeight: '500' },
  choreSub: { ...FONTS.small, color: COLORS.subtext },
});
