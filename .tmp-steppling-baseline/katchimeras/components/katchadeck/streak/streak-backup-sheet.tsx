import { useState } from 'react';
import * as WebBrowser from 'expo-web-browser';
import { Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { KatchaButton } from '@/components/katchadeck/ui/katcha-button';
import { KatchaSheet } from '@/components/katchadeck/ui/katcha-sheet';
import { ThemedText } from '@/components/themed-text';
import { supabase } from '@/utils/supabase';

export function StreakBackupSheet({ onClose }: { onClose: () => void }) {
  const [mode, setMode] = useState<'backup' | 'restore'>('backup');
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const linkProvider = async (provider: 'apple' | 'google') => {
    setBusy(true);
    setStatus(null);
    const redirectTo = 'katchimeras://auth/callback';
    const response = mode === 'backup'
      ? await supabase.auth.linkIdentity({ provider, options: { redirectTo, skipBrowserRedirect: true } })
      : await supabase.auth.signInWithOAuth({ provider, options: { redirectTo, skipBrowserRedirect: true } });
    if (response.data?.url) await WebBrowser.openAuthSessionAsync(response.data.url, redirectTo);
    setBusy(false);
    if (response.error) setStatus(response.error.message);
  };
  const linkEmail = async () => {
    const clean = email.trim();
    if (!/^\S+@\S+\.\S+$/.test(clean)) {
      setStatus('Enter a valid email address.');
      return;
    }
    setBusy(true);
    setStatus(null);
    const { error } = mode === 'backup'
      ? await supabase.auth.updateUser({ email: clean }, { emailRedirectTo: 'katchimeras://auth/callback' })
      : await supabase.auth.signInWithOtp({ email: clean, options: { emailRedirectTo: 'katchimeras://auth/callback' } });
    setBusy(false);
    setStatus(error ? error.message : 'Check your email to finish backing up your streak.');
  };

  return (
    <KatchaSheet
      header={{ eyebrow: 'Streak backup', title: 'Keep your story with you', subtitle: 'Link an account to restore your streak after reinstalling or on another device.' }}
      onRequestClose={onClose}
      surface="parchment">
      <View style={styles.content}>
        <View style={styles.modeRow}>
          <Pressable onPress={() => setMode('backup')} style={[styles.mode, mode === 'backup' && styles.modeSelected]}><ThemedText style={styles.modeLabel} lightColor={mode === 'backup' ? '#FFF9E9' : '#6F5A43'} darkColor={mode === 'backup' ? '#FFF9E9' : '#6F5A43'}>Back up</ThemedText></Pressable>
          <Pressable onPress={() => setMode('restore')} style={[styles.mode, mode === 'restore' && styles.modeSelected]}><ThemedText style={styles.modeLabel} lightColor={mode === 'restore' ? '#FFF9E9' : '#6F5A43'} darkColor={mode === 'restore' ? '#FFF9E9' : '#6F5A43'}>Restore</ThemedText></Pressable>
        </View>
        {Platform.OS === 'ios' ? <KatchaButton fullWidth label={`${mode === 'backup' ? 'Continue' : 'Restore'} with Apple`} loading={busy} onPress={() => void linkProvider('apple')} variant="secondary" /> : null}
        <KatchaButton fullWidth label={`${mode === 'backup' ? 'Continue' : 'Restore'} with Google`} loading={busy} onPress={() => void linkProvider('google')} variant="secondary" />
        <View style={styles.divider}><View style={styles.line} /><ThemedText style={styles.or} lightColor="#806B52" darkColor="#806B52">or use email</ThemedText><View style={styles.line} /></View>
        <View style={styles.field}>
          <ThemedText style={styles.label} lightColor="#4E3926" darkColor="#4E3926">Email address</ThemedText>
          <TextInput
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            onChangeText={setEmail}
            placeholder="you@example.com"
            placeholderTextColor="#9A856D"
            style={styles.input}
            value={email}
          />
          <ThemedText style={styles.helper} lightColor="#806B52" darkColor="#806B52">We’ll send a verification link. Your journal content is not uploaded.</ThemedText>
        </View>
        <KatchaButton fullWidth label={mode === 'backup' ? 'Send verification link' : 'Send restore link'} loading={busy} onPress={() => void linkEmail()} />
        {status ? <ThemedText accessibilityLiveRegion="polite" style={styles.status} lightColor="#7A4B28" darkColor="#7A4B28">{status}</ThemedText> : null}
      </View>
    </KatchaSheet>
  );
}

const styles = StyleSheet.create({
  content: { gap: 10, paddingTop: 4 },
  modeRow: { backgroundColor: 'rgba(91,67,42,0.08)', borderRadius: 999, flexDirection: 'row', padding: 3 },
  mode: { alignItems: 'center', borderRadius: 999, flex: 1, paddingVertical: 8 },
  modeSelected: { backgroundColor: '#75450A' },
  modeLabel: { fontFamily: 'Manrope', fontSize: 12, fontWeight: '900' },
  divider: { alignItems: 'center', flexDirection: 'row', gap: 8, paddingVertical: 2 },
  line: { backgroundColor: 'rgba(95,70,44,0.18)', flex: 1, height: 1 },
  or: { fontSize: 11, fontWeight: '800' },
  field: { gap: 6 },
  label: { fontSize: 12, fontWeight: '900' },
  input: { backgroundColor: 'rgba(255,255,255,0.72)', borderColor: 'rgba(95,70,44,0.23)', borderRadius: 14, borderWidth: 1, color: '#382719', fontFamily: 'Manrope', fontSize: 15, minHeight: 48, paddingHorizontal: 13 },
  helper: { fontSize: 11.5, fontWeight: '600', lineHeight: 16 },
  status: { fontSize: 12, fontWeight: '800', lineHeight: 17, textAlign: 'center' },
});
