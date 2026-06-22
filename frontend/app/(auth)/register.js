import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, Alert, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { router } from 'expo-router';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../../src/config/firebase';
import { authAPI, saveToken } from '../../src/services/api';
import useStore from '../../src/store/useStore';
import { COLORS, SIZES, FONTS } from '../../src/constants/theme';

export default function RegisterScreen() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('parent');
  const [parentId, setParentId] = useState('');
  const [screenTime, setScreenTime] = useState('60');
  const [loading, setLoading] = useState(false);
  const { setUser, setToken } = useStore();

  const handleRegister = async () => {
    if (!name || !email || !password) return Alert.alert('Error', 'Please fill in all fields.');
    if (role === 'child' && !parentId.trim()) return Alert.alert('Error', 'Please enter your parent\'s ID.');
    setLoading(true);
    try {
      const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
      const idToken = await cred.user.getIdToken();

      const payload = {
        firebase_id_token: idToken,
        name: name.trim(),
        role,
        parent_id: role === 'child' ? parentId.trim() : null,
        screen_time_allowance: role === 'child' ? parseInt(screenTime, 10) || 60 : 60,
      };

      const res = await authAPI.register(payload);
      const { access_token, user } = res.data;
      await saveToken(access_token);
      setToken(access_token);
      setUser(user);
      // Expo Router's index.js will redirect based on user.role
      router.replace('/');
    } catch (e) {
      Alert.alert('Registration failed', e.response?.data?.detail || e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.inner} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Create Account</Text>
        <Text style={styles.subtitle}>Join your family on Family Monitor</Text>

        <TextInput style={styles.input} placeholder="Full Name" placeholderTextColor={COLORS.subtext}
          value={name} onChangeText={setName} />
        <TextInput style={styles.input} placeholder="Email" placeholderTextColor={COLORS.subtext}
          value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
        <TextInput style={styles.input} placeholder="Password" placeholderTextColor={COLORS.subtext}
          value={password} onChangeText={setPassword} secureTextEntry />

        <Text style={styles.label}>I am a…</Text>
        <View style={styles.roleRow}>
          {['parent', 'child'].map((r) => (
            <TouchableOpacity
              key={r}
              style={[styles.roleBtn, role === r && styles.roleBtnActive]}
              onPress={() => setRole(r)}
            >
              <Text style={[styles.roleBtnText, role === r && styles.roleBtnTextActive]}>
                {r === 'parent' ? '👨‍👩‍👧 Parent' : '👦 Child'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {role === 'child' && (
          <>
            <TextInput style={styles.input} placeholder="Parent's User ID" placeholderTextColor={COLORS.subtext}
              value={parentId} onChangeText={setParentId} autoCapitalize="none" />
            <TextInput style={styles.input} placeholder="Daily screen time allowance (minutes)"
              placeholderTextColor={COLORS.subtext} value={screenTime} onChangeText={setScreenTime}
              keyboardType="numeric" />
          </>
        )}

        <TouchableOpacity
          style={[styles.btn, loading && styles.btnDisabled]}
          onPress={handleRegister}
          disabled={loading}
        >
          <Text style={styles.btnText}>{loading ? 'Creating account…' : 'Create Account'}</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.link}>Already have an account? <Text style={styles.linkBold}>Sign In</Text></Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  inner: { padding: SIZES.lg, paddingTop: SIZES.xl * 2 },
  title: { ...FONTS.h1, color: COLORS.primary },
  subtitle: { ...FONTS.body, color: COLORS.subtext, marginBottom: SIZES.xl },
  input: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: SIZES.md,
    marginBottom: SIZES.md,
    ...FONTS.body,
    color: COLORS.text,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  label: { ...FONTS.small, color: COLORS.subtext, marginBottom: SIZES.sm, fontWeight: '600' },
  roleRow: { flexDirection: 'row', gap: SIZES.sm, marginBottom: SIZES.md },
  roleBtn: {
    flex: 1,
    padding: SIZES.md,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: COLORS.border,
    alignItems: 'center',
    backgroundColor: COLORS.card,
  },
  roleBtnActive: { borderColor: COLORS.primary, backgroundColor: '#EEF0FF' },
  roleBtnText: { ...FONTS.body, color: COLORS.subtext, fontWeight: '600' },
  roleBtnTextActive: { color: COLORS.primary },
  btn: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    padding: SIZES.md,
    alignItems: 'center',
    marginTop: SIZES.sm,
  },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: '#fff', ...FONTS.h3 },
  link: { ...FONTS.small, color: COLORS.subtext, textAlign: 'center', marginTop: SIZES.lg },
  linkBold: { color: COLORS.primary, fontWeight: '600' },
});
