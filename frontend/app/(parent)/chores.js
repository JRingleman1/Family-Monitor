import React, { useEffect, useState } from 'react';
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity,
  Alert, Modal, TextInput, ScrollView, RefreshControl,
} from 'react-native';
import { choresAPI, usersAPI } from '../../src/services/api';
import useStore from '../../src/store/useStore';
import { COLORS, SIZES, FONTS } from '../../src/constants/theme';

export default function ChoresScreen() {
  const { chores, setChores, addChore, removeChore, children, setChildren } = useStore();
  const [refreshing, setRefreshing] = useState(false);
  const [modal, setModal] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [points, setPoints] = useState('10');
  const [assignedTo, setAssignedTo] = useState('');
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try {
      const [choresRes, childrenRes] = await Promise.all([
        choresAPI.getAll(),
        usersAPI.getChildren(),
      ]);
      setChores(choresRes.data);
      setChildren(childrenRes.data);
      if (!assignedTo && childrenRes.data.length > 0) setAssignedTo(childrenRes.data[0].uid);
    } catch (e) {
      console.warn(e.message);
    }
  };

  useEffect(() => { load(); }, []);

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const openModal = () => {
    setTitle(''); setDescription(''); setPoints('10');
    if (children.length > 0) setAssignedTo(children[0].uid);
    setModal(true);
  };

  const createChore = async () => {
    if (!title.trim()) return Alert.alert('Error', 'Chore title is required.');
    if (!assignedTo) return Alert.alert('Error', 'Please select a child.');
    setSaving(true);
    try {
      const res = await choresAPI.create({
        title: title.trim(),
        description: description.trim(),
        points: parseInt(points, 10) || 10,
        assigned_to: assignedTo,
      });
      addChore(res.data);
      setModal(false);
    } catch (e) {
      Alert.alert('Error', e.response?.data?.detail || e.message);
    } finally {
      setSaving(false);
    }
  };

  const deleteChore = (id) => {
    Alert.alert('Delete Chore', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await choresAPI.delete(id);
            removeChore(id);
          } catch (e) {
            Alert.alert('Error', e.response?.data?.detail || e.message);
          }
        },
      },
    ]);
  };

  const childName = (uid) => children.find((c) => c.uid === uid)?.name || 'Unknown';
  const statusColor = { pending: COLORS.warning, 'in-progress': COLORS.primary, completed: COLORS.success };

  return (
    <View style={styles.container}>
      <FlatList
        data={chores}
        keyExtractor={(c) => c.id}
        contentContainerStyle={{ padding: SIZES.lg, paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>📋</Text>
            <Text style={styles.emptyText}>No chores yet. Add one!</Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.cardLeft}>
              <View style={[styles.statusBadge, { backgroundColor: statusColor[item.status] + '22' }]}>
                <Text style={[styles.statusText, { color: statusColor[item.status] }]}>{item.status}</Text>
              </View>
              <Text style={styles.choreTitle}>{item.title}</Text>
              {item.description ? <Text style={styles.choreDesc}>{item.description}</Text> : null}
              <Text style={styles.choreMeta}>👦 {childName(item.assigned_to)} · ⭐ {item.points} pts</Text>
            </View>
            <TouchableOpacity onPress={() => deleteChore(item.id)} style={styles.deleteBtn}>
              <Text style={styles.deleteIcon}>🗑</Text>
            </TouchableOpacity>
          </View>
        )}
      />

      {/* FAB */}
      <TouchableOpacity style={styles.fab} onPress={openModal}>
        <Text style={styles.fabText}>+ Add Chore</Text>
      </TouchableOpacity>

      {/* Add Chore Modal */}
      <Modal visible={modal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>New Chore</Text>

            <TextInput style={styles.input} placeholder="Title *" placeholderTextColor={COLORS.subtext}
              value={title} onChangeText={setTitle} />
            <TextInput style={[styles.input, { height: 80 }]} placeholder="Description (optional)"
              placeholderTextColor={COLORS.subtext} value={description} onChangeText={setDescription} multiline />
            <TextInput style={styles.input} placeholder="Points" placeholderTextColor={COLORS.subtext}
              value={points} onChangeText={setPoints} keyboardType="numeric" />

            <Text style={styles.label}>Assign to</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: SIZES.md }}>
              {children.map((child) => (
                <TouchableOpacity
                  key={child.uid}
                  style={[styles.childChip, assignedTo === child.uid && styles.childChipActive]}
                  onPress={() => setAssignedTo(child.uid)}
                >
                  <Text style={[styles.childChipText, assignedTo === child.uid && styles.childChipTextActive]}>
                    {child.name}
                  </Text>
                </TouchableOpacity>
              ))}
              {children.length === 0 && (
                <Text style={styles.noChildren}>No children registered yet.</Text>
              )}
            </ScrollView>

            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setModal(false)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.saveBtn, saving && { opacity: 0.6 }]}
                onPress={createChore} disabled={saving}>
                <Text style={styles.saveBtnText}>{saving ? 'Saving…' : 'Create'}</Text>
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
  empty: { alignItems: 'center', marginTop: 80 },
  emptyIcon: { fontSize: 48, marginBottom: SIZES.sm },
  emptyText: { ...FONTS.body, color: COLORS.subtext },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 14,
    padding: SIZES.md,
    marginBottom: SIZES.sm,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  cardLeft: { flex: 1 },
  statusBadge: { alignSelf: 'flex-start', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2, marginBottom: 6 },
  statusText: { ...FONTS.small, fontWeight: '600', textTransform: 'capitalize' },
  choreTitle: { ...FONTS.body, color: COLORS.text, fontWeight: '600' },
  choreDesc: { ...FONTS.small, color: COLORS.subtext, marginTop: 2 },
  choreMeta: { ...FONTS.small, color: COLORS.subtext, marginTop: 6 },
  deleteBtn: { padding: 4 },
  deleteIcon: { fontSize: 18 },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    backgroundColor: COLORS.primary,
    borderRadius: 28,
    paddingHorizontal: SIZES.lg,
    paddingVertical: SIZES.md,
    elevation: 4,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  fabText: { color: '#fff', ...FONTS.body, fontWeight: '700' },
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  modalSheet: {
    backgroundColor: COLORS.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: SIZES.lg,
    paddingBottom: SIZES.xl,
  },
  modalTitle: { ...FONTS.h2, color: COLORS.text, marginBottom: SIZES.md },
  input: {
    backgroundColor: COLORS.background,
    borderRadius: 12,
    padding: SIZES.md,
    marginBottom: SIZES.md,
    ...FONTS.body,
    color: COLORS.text,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  label: { ...FONTS.small, color: COLORS.subtext, fontWeight: '600', marginBottom: SIZES.sm },
  childChip: {
    paddingHorizontal: SIZES.md,
    paddingVertical: SIZES.sm,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: COLORS.border,
    marginRight: SIZES.sm,
    backgroundColor: COLORS.background,
  },
  childChipActive: { borderColor: COLORS.primary, backgroundColor: '#EEF0FF' },
  childChipText: { ...FONTS.small, color: COLORS.subtext, fontWeight: '600' },
  childChipTextActive: { color: COLORS.primary },
  noChildren: { ...FONTS.small, color: COLORS.subtext, fontStyle: 'italic' },
  modalButtons: { flexDirection: 'row', gap: SIZES.sm },
  cancelBtn: {
    flex: 1, padding: SIZES.md, borderRadius: 12, alignItems: 'center',
    borderWidth: 1, borderColor: COLORS.border,
  },
  cancelBtnText: { ...FONTS.body, color: COLORS.subtext, fontWeight: '600' },
  saveBtn: { flex: 1, padding: SIZES.md, borderRadius: 12, alignItems: 'center', backgroundColor: COLORS.primary },
  saveBtnText: { ...FONTS.body, color: '#fff', fontWeight: '700' },
});
