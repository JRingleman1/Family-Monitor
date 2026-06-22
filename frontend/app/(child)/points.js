import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ref, onValue } from 'firebase/database';
import { database } from '../../src/config/firebase';
import { usersAPI } from '../../src/services/api';
import useStore from '../../src/store/useStore';
import { COLORS, SIZES, FONTS } from '../../src/constants/theme';

export default function PointsScreen() {
  const insets = useSafeAreaInsets();
  const { user, chores } = useStore();
  const [stats, setStats] = useState(null);
  const [livePoints, setLivePoints] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const loadStats = async () => {
    if (!user) return;
    try {
      const res = await usersAPI.getStats(user.uid);
      setStats(res.data);
    } catch (e) {
      console.warn(e.message);
    }
  };

  useEffect(() => {
    loadStats();
  }, [user]);

  // Subscribe to live point updates from Firebase Realtime DB
  useEffect(() => {
    if (!user) return;
    const pointsRef = ref(database, `points/${user.uid}`);
    const unsub = onValue(pointsRef, (snapshot) => {
      const data = snapshot.val();
      if (data?.totalPoints !== undefined) setLivePoints(data.totalPoints);
    });
    return unsub;
  }, [user]);

  const onRefresh = async () => { setRefreshing(true); await loadStats(); setRefreshing(false); };

  const totalPoints = livePoints ?? stats?.total_points ?? user?.total_points ?? 0;
  const allowance = stats?.screen_time_allowance ?? user?.screen_time_allowance ?? 60;
  const used = stats?.screen_time_used ?? user?.screen_time_used ?? 0;
  const remaining = Math.max(0, allowance - used);
  const pct = allowance > 0 ? Math.min(1, used / allowance) : 0;

  const completedChores = chores.filter((c) => c.status === 'completed');

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: insets.bottom + SIZES.xl }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.success} />}
    >
      {/* Points hero */}
      <View style={styles.hero}>
        <Text style={styles.heroLabel}>Total Points</Text>
        <Text style={styles.heroPoints}>{totalPoints}</Text>
        <Text style={styles.heroStar}>⭐</Text>
        {livePoints !== null && <Text style={styles.liveTag}>● Live</Text>}
      </View>

      {/* Screen time card */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>📱 Screen Time Today</Text>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: `${pct * 100}%` }]} />
        </View>
        <View style={styles.timeRow}>
          <Text style={styles.timeSub}>{used} min used</Text>
          <Text style={[styles.timeSub, { color: remaining > 10 ? COLORS.success : COLORS.secondary }]}>
            {remaining} min left
          </Text>
        </View>
        <Text style={styles.allowance}>Daily allowance: {allowance} min</Text>
      </View>

      {/* Chore history */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Completed Chores ({completedChores.length})</Text>
        {completedChores.length === 0 ? (
          <Text style={styles.noHistory}>Complete chores to earn points!</Text>
        ) : (
          completedChores.map((c) => (
            <View key={c.id} style={styles.historyRow}>
              <Text style={styles.historyTitle}>{c.title}</Text>
              <Text style={styles.historyPoints}>+{c.points} ⭐</Text>
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  hero: {
    alignItems: 'center',
    backgroundColor: COLORS.success,
    paddingVertical: SIZES.xl * 1.5,
    paddingHorizontal: SIZES.lg,
  },
  heroLabel: { ...FONTS.body, color: 'rgba(255,255,255,0.8)', fontWeight: '600' },
  heroPoints: { fontSize: 72, fontWeight: '900', color: '#fff', lineHeight: 80 },
  heroStar: { fontSize: 32 },
  liveTag: { ...FONTS.small, color: 'rgba(255,255,255,0.9)', marginTop: SIZES.sm, fontWeight: '600' },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    margin: SIZES.lg,
    padding: SIZES.md,
  },
  cardTitle: { ...FONTS.h3, color: COLORS.text, marginBottom: SIZES.md },
  progressBar: {
    height: 12,
    backgroundColor: COLORS.border,
    borderRadius: 6,
    overflow: 'hidden',
    marginBottom: SIZES.sm,
  },
  progressFill: { height: '100%', backgroundColor: COLORS.primary, borderRadius: 6 },
  timeRow: { flexDirection: 'row', justifyContent: 'space-between' },
  timeSub: { ...FONTS.small, color: COLORS.subtext, fontWeight: '600' },
  allowance: { ...FONTS.small, color: COLORS.subtext, marginTop: SIZES.xs },
  section: { marginHorizontal: SIZES.lg },
  sectionTitle: { ...FONTS.h3, color: COLORS.text, marginBottom: SIZES.sm },
  noHistory: { ...FONTS.body, color: COLORS.subtext, fontStyle: 'italic' },
  historyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: SIZES.md,
    marginBottom: SIZES.sm,
  },
  historyTitle: { ...FONTS.body, color: COLORS.text, flex: 1 },
  historyPoints: { ...FONTS.body, color: COLORS.warning, fontWeight: '700' },
});
