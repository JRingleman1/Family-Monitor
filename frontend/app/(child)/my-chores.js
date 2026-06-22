import React, { useEffect, useState } from 'react';
import {
  View, Text, FlatList, StyleSheet,
  TouchableOpacity, Alert, RefreshControl,
} from 'react-native';
import { useAuth } from '../../src/context/AuthContext';
import { choresAPI } from '../../src/services/api';
import useStore from '../../src/store/useStore';
import { COLORS, SIZES, FONTS } from '../../src/constants/theme';

export default function MyChoresScreen() {
  const { logout } = useAuth();
  const { user, chores, setChores, updateChore } = useStore();
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    try {
      const res = await choresAPI.getAll();
      setChores(res.data);
    } catch (e) {
      console.warn(e.message);
    }
  };

  useEffect(() => { load(); }, []);
  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const completeChore = async (chore) => {
    Alert.alert(
      'Complete Chore',
      `Mark "${chore.title}" as done and earn ${chore.points} points?`,
      [
        { text: 'Not yet', style: 'cancel' },
        {
          text: '✅ Done!',
          onPress: async () => {
            try {
              const res = await choresAPI.complete(chore.id);
              updateChore(res.data);
              Alert.alert('🎉 Awesome!', `You earned ${chore.points} points!`);
            } catch (e) {
              Alert.alert('Error', e.response?.data?.detail || e.message);
            }
          },
        },
      ]
    );
  };

  const pending = chores.filter((c) => c.status !== 'completed');
  const done = chores.filter((c) => c.status === 'completed');

  return (
    <View style={styles.container}>
      {/* Header greeting */}
      <View style={styles.header}>
        <Text style={styles.greeting}>Hey, {user?.name?.split(' ')[0]}! 👋</Text>
        <TouchableOpacity onPress={logout}>
          <Text style={styles.logout}>Sign out</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={[...pending, ...done]}
        keyExtractor={(c) => c.id}
        contentContainerStyle={{ padding: SIZES.md, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.success} />}
        ListHeaderComponent={
          pending.length === 0 && done.length === 0 ? null : (
            <Text style={styles.sectionLabel}>
              {pending.length} chore{pending.length !== 1 ? 's' : ''} to do
            </Text>
          )
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>🎉</Text>
            <Text style={styles.emptyTitle}>All done!</Text>
            <Text style={styles.emptyHint}>No chores assigned yet. Enjoy your day!</Text>
          </View>
        }
        renderItem={({ item }) => {
          const isDone = item.status === 'completed';
          return (
            <View style={[styles.card, isDone && styles.cardDone]}>
              <View style={styles.cardContent}>
                <Text style={[styles.choreTitle, isDone && styles.choreTitleDone]}>{item.title}</Text>
                {item.description ? <Text style={styles.choreDesc}>{item.description}</Text> : null}
                <View style={styles.metaRow}>
                  <View style={styles.pointsBadge}>
                    <Text style={styles.pointsText}>⭐ {item.points} pts</Text>
                  </View>
                  {isDone && <Text style={styles.completedLabel}>✅ Completed!</Text>}
                </View>
              </View>
              {!isDone && (
                <TouchableOpacity style={styles.doneBtn} onPress={() => completeChore(item)}>
                  <Text style={styles.doneBtnText}>Done</Text>
                </TouchableOpacity>
              )}
            </View>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', padding: SIZES.lg,
  },
  greeting: { ...FONTS.h2, color: COLORS.text },
  logout: { ...FONTS.small, color: COLORS.subtext },
  sectionLabel: { ...FONTS.small, color: COLORS.subtext, fontWeight: '600', marginBottom: SIZES.sm, textTransform: 'uppercase' },
  empty: { alignItems: 'center', marginTop: 80 },
  emptyIcon: { fontSize: 56, marginBottom: SIZES.sm },
  emptyTitle: { ...FONTS.h2, color: COLORS.text },
  emptyHint: { ...FONTS.body, color: COLORS.subtext, marginTop: SIZES.sm, textAlign: 'center' },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: SIZES.md,
    marginBottom: SIZES.sm,
    flexDirection: 'row',
    alignItems: 'center',
    borderLeftWidth: 4,
    borderLeftColor: COLORS.primary,
  },
  cardDone: { borderLeftColor: COLORS.success, opacity: 0.75 },
  cardContent: { flex: 1 },
  choreTitle: { ...FONTS.body, color: COLORS.text, fontWeight: '700' },
  choreTitleDone: { textDecorationLine: 'line-through', color: COLORS.subtext },
  choreDesc: { ...FONTS.small, color: COLORS.subtext, marginTop: 2 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: SIZES.sm, marginTop: 8 },
  pointsBadge: { backgroundColor: '#FFF8E7', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2 },
  pointsText: { ...FONTS.small, color: COLORS.warning, fontWeight: '700' },
  completedLabel: { ...FONTS.small, color: COLORS.success, fontWeight: '600' },
  doneBtn: {
    backgroundColor: COLORS.success,
    borderRadius: 12,
    paddingHorizontal: SIZES.md,
    paddingVertical: SIZES.sm,
    marginLeft: SIZES.sm,
  },
  doneBtnText: { color: '#fff', ...FONTS.small, fontWeight: '700' },
});
