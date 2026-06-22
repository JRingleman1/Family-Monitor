import React, { useEffect, useState } from 'react';
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity,
  ScrollView, Alert, Modal, TextInput, RefreshControl,
} from 'react-native';
import { monitoringAPI, usersAPI } from '../../src/services/api';
import useStore from '../../src/store/useStore';
import { COLORS, SIZES, FONTS } from '../../src/constants/theme';

export default function MonitoringScreen() {
  const { children, setChildren } = useStore();
  const [selectedChild, setSelectedChild] = useState(null);
  const [activity, setActivity] = useState([]);
  const [blocked, setBlocked] = useState([]);
  const [tab, setTab] = useState('activity'); // 'activity' | 'blocked'
  const [refreshing, setRefreshing] = useState(false);
  const [blockModal, setBlockModal] = useState(false);
  const [contentType, setContentType] = useState('');
  const [contentId, setContentId] = useState('');
  const [reason, setReason] = useState('');

  const loadChildren = async () => {
    try {
      const res = await usersAPI.getChildren();
      setChildren(res.data);
      if (res.data.length > 0 && !selectedChild) setSelectedChild(res.data[0]);
    } catch (e) {
      console.warn(e.message);
    }
  };

  const loadChildData = async (child) => {
    if (!child) return;
    try {
      const [actRes, blkRes] = await Promise.all([
        monitoringAPI.getActivity(child.uid),
        monitoringAPI.getBlocked(child.uid),
      ]);
      setActivity(actRes.data);
      setBlocked(blkRes.data);
    } catch (e) {
      console.warn(e.message);
    }
  };

  useEffect(() => { loadChildren(); }, []);
  useEffect(() => { loadChildData(selectedChild); }, [selectedChild]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadChildren();
    await loadChildData(selectedChild);
    setRefreshing(false);
  };

  const submitBlock = async () => {
    if (!contentType.trim() || !contentId.trim()) return Alert.alert('Error', 'Content type and ID are required.');
    try {
      const res = await monitoringAPI.blockContent(selectedChild.uid, {
        content_type: contentType.trim(),
        content_id: contentId.trim(),
        reason: reason.trim(),
      });
      setBlocked((prev) => [res.data, ...prev]);
      setBlockModal(false);
      setContentType(''); setContentId(''); setReason('');
    } catch (e) {
      Alert.alert('Error', e.response?.data?.detail || e.message);
    }
  };

  if (children.length === 0) {
    return (
      <View style={styles.emptyState}>
        <Text style={styles.emptyIcon}>👨‍👩‍👧</Text>
        <Text style={styles.emptyText}>No children registered yet.</Text>
        <Text style={styles.emptyHint}>Have your kids register with your Parent ID to get started.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Child selector */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.childSelector}>
        {children.map((child) => (
          <TouchableOpacity
            key={child.uid}
            style={[styles.childChip, selectedChild?.uid === child.uid && styles.childChipActive]}
            onPress={() => setSelectedChild(child)}
          >
            <Text style={[styles.childChipText, selectedChild?.uid === child.uid && styles.childChipTextActive]}>
              👦 {child.name}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Tabs */}
      <View style={styles.tabs}>
        {['activity', 'blocked'].map((t) => (
          <TouchableOpacity key={t} style={[styles.tab, tab === t && styles.tabActive]} onPress={() => setTab(t)}>
            <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
              {t === 'activity' ? '📊 Activity' : '🚫 Blocked'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Content */}
      <FlatList
        data={tab === 'activity' ? activity : blocked}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: SIZES.md, paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>{tab === 'activity' ? 'No activity logged yet.' : 'Nothing blocked.'}</Text>
          </View>
        }
        renderItem={({ item }) =>
          tab === 'activity' ? (
            <View style={styles.activityCard}>
              <View style={[styles.typeBadge, { backgroundColor: item.is_appropriate ? COLORS.success + '22' : COLORS.secondary + '22' }]}>
                <Text style={{ color: item.is_appropriate ? COLORS.success : COLORS.secondary, ...FONTS.small, fontWeight: '600' }}>
                  {item.type}
                </Text>
              </View>
              {item.app_name && <Text style={styles.appName}>{item.app_name}</Text>}
              <Text style={styles.activityMeta}>{item.duration} min · {new Date(item.timestamp).toLocaleString()}</Text>
            </View>
          ) : (
            <View style={styles.activityCard}>
              <Text style={styles.blockedType}>{item.content_type}</Text>
              <Text style={styles.blockedId}>{item.content_id}</Text>
              {item.reason ? <Text style={styles.activityMeta}>Reason: {item.reason}</Text> : null}
              <Text style={styles.activityMeta}>Blocked {new Date(item.blocked_at).toLocaleDateString()}</Text>
            </View>
          )
        }
      />

      {tab === 'blocked' && (
        <TouchableOpacity style={styles.fab} onPress={() => setBlockModal(true)}>
          <Text style={styles.fabText}>+ Block Content</Text>
        </TouchableOpacity>
      )}

      {/* Block Modal */}
      <Modal visible={blockModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>Block Content for {selectedChild?.name}</Text>
            <TextInput style={styles.input} placeholder="Content type (e.g. app, website)"
              placeholderTextColor={COLORS.subtext} value={contentType} onChangeText={setContentType} />
            <TextInput style={styles.input} placeholder="Content ID / URL / app name"
              placeholderTextColor={COLORS.subtext} value={contentId} onChangeText={setContentId} />
            <TextInput style={styles.input} placeholder="Reason (optional)"
              placeholderTextColor={COLORS.subtext} value={reason} onChangeText={setReason} />
            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setBlockModal(false)}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.blockBtn} onPress={submitBlock}>
                <Text style={styles.blockBtnText}>Block</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: SIZES.xl },
  emptyIcon: { fontSize: 56, marginBottom: SIZES.md },
  emptyText: { ...FONTS.h3, color: COLORS.text, textAlign: 'center' },
  emptyHint: { ...FONTS.small, color: COLORS.subtext, textAlign: 'center', marginTop: SIZES.sm },
  childSelector: { paddingHorizontal: SIZES.md, paddingVertical: SIZES.sm, maxHeight: 60 },
  childChip: {
    paddingHorizontal: SIZES.md, paddingVertical: SIZES.sm,
    borderRadius: 20, borderWidth: 2, borderColor: COLORS.border,
    marginRight: SIZES.sm, backgroundColor: COLORS.card,
  },
  childChipActive: { borderColor: COLORS.primary, backgroundColor: '#EEF0FF' },
  childChipText: { ...FONTS.small, color: COLORS.subtext, fontWeight: '600' },
  childChipTextActive: { color: COLORS.primary },
  tabs: { flexDirection: 'row', marginHorizontal: SIZES.md, marginBottom: SIZES.sm, backgroundColor: COLORS.card, borderRadius: 12, padding: 4 },
  tab: { flex: 1, paddingVertical: SIZES.sm, alignItems: 'center', borderRadius: 10 },
  tabActive: { backgroundColor: COLORS.primary },
  tabText: { ...FONTS.small, color: COLORS.subtext, fontWeight: '600' },
  tabTextActive: { color: '#fff' },
  activityCard: {
    backgroundColor: COLORS.card, borderRadius: 12,
    padding: SIZES.md, marginBottom: SIZES.sm,
  },
  typeBadge: { alignSelf: 'flex-start', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2, marginBottom: 6 },
  appName: { ...FONTS.body, color: COLORS.text, fontWeight: '600' },
  activityMeta: { ...FONTS.small, color: COLORS.subtext, marginTop: 4 },
  blockedType: { ...FONTS.small, color: COLORS.secondary, fontWeight: '700', textTransform: 'uppercase' },
  blockedId: { ...FONTS.body, color: COLORS.text, fontWeight: '600', marginTop: 2 },
  empty: { padding: SIZES.xl, alignItems: 'center' },
  fab: {
    position: 'absolute', bottom: 24, right: 24,
    backgroundColor: COLORS.secondary, borderRadius: 28,
    paddingHorizontal: SIZES.lg, paddingVertical: SIZES.md, elevation: 4,
  },
  fabText: { color: '#fff', ...FONTS.body, fontWeight: '700' },
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  modalSheet: { backgroundColor: COLORS.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: SIZES.lg, paddingBottom: SIZES.xl },
  modalTitle: { ...FONTS.h3, color: COLORS.text, marginBottom: SIZES.md },
  input: { backgroundColor: COLORS.background, borderRadius: 12, padding: SIZES.md, marginBottom: SIZES.md, ...FONTS.body, color: COLORS.text, borderWidth: 1, borderColor: COLORS.border },
  modalButtons: { flexDirection: 'row', gap: SIZES.sm },
  cancelBtn: { flex: 1, padding: SIZES.md, borderRadius: 12, alignItems: 'center', borderWidth: 1, borderColor: COLORS.border },
  cancelText: { ...FONTS.body, color: COLORS.subtext, fontWeight: '600' },
  blockBtn: { flex: 1, padding: SIZES.md, borderRadius: 12, alignItems: 'center', backgroundColor: COLORS.secondary },
  blockBtnText: { ...FONTS.body, color: '#fff', fontWeight: '700' },
});
