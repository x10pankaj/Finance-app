import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAppStore } from '../../src/store';
import { getAuthStatus, deleteProfile, Profile } from '../../src/api';
import { Card } from '../../src/components/Card';

export default function SettingsScreen() {
  const { theme, themeMode, toggleTheme, autoLockMinutes, setAutoLockMinutes, currency, setCurrency } = useAppStore();
  const c = theme.colors;
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const router = useRouter();

  useEffect(() => {
    loadProfiles();
  }, []);

  const loadProfiles = async () => {
    try {
      const status = await getAuthStatus();
      setProfiles(status.profiles);
    } catch {}
  };

  const handleDeleteProfile = (profile: Profile) => {
    Alert.alert(
      'Delete Profile',
      `Delete "${profile.name}" and all its data? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteProfile(profile.id);
              loadProfiles();
              Alert.alert('Deleted', `Profile "${profile.name}" has been removed.`);
            } catch {
              Alert.alert('Error', 'Failed to delete profile');
            }
          },
        },
      ]
    );
  };

  const lockTimeOptions = [
    { label: '1 min', value: 1 },
    { label: '5 min', value: 5 },
    { label: '15 min', value: 15 },
    { label: '30 min', value: 30 },
    { label: 'Off', value: 0 },
  ];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: c.background }]} edges={['top']}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <Text style={[styles.sectionTitle, { color: c.textSecondary }]}>APPEARANCE</Text>
        <Card>
          <TouchableOpacity testID="theme-toggle-setting" style={styles.settingRow} onPress={toggleTheme}>
            <View style={[styles.settingIcon, { backgroundColor: themeMode === 'dark' ? '#FFB30020' : '#54545415' }]}>
              <Ionicons name={themeMode === 'dark' ? 'moon' : 'sunny'} size={20} color={themeMode === 'dark' ? '#FFB300' : '#545454'} />
            </View>
            <View style={styles.settingContent}>
              <Text style={[styles.settingLabel, { color: c.text }]}>Dark Mode</Text>
              <Text style={[styles.settingValue, { color: c.textSecondary }]}>
                {themeMode === 'dark' ? 'On' : 'Off'}
              </Text>
            </View>
            <View style={[styles.toggle, themeMode === 'dark' && styles.toggleActive, { backgroundColor: themeMode === 'dark' ? c.accent : c.toggleBg }]}>
              <View style={[styles.toggleKnob, themeMode === 'dark' && styles.toggleKnobActive]} />
            </View>
          </TouchableOpacity>
        </Card>

        {/* Currency */}
        <Text style={[styles.sectionTitle, { color: c.textSecondary }]}>CURRENCY</Text>
        <Card>
          <View style={styles.currencyRow}>
            {(['USD', 'INR'] as const).map((curr) => (
              <TouchableOpacity
                key={curr}
                style={[
                  styles.currencyOption,
                  { borderColor: currency === curr ? c.accent : c.border },
                  currency === curr && { backgroundColor: `${c.accent}15` },
                ]}
                onPress={() => setCurrency(curr)}
              >
                <Text style={[styles.currencySymbol, { color: currency === curr ? c.accent : c.textSecondary }]}>
                  {curr === 'USD' ? '$' : '₹'}
                </Text>
                <Text style={[styles.currencyLabel, { color: currency === curr ? c.text : c.textSecondary }]}>
                  {curr}
                </Text>
                {currency === curr && <Ionicons name="checkmark-circle" size={18} color={c.accent} />}
              </TouchableOpacity>
            ))}
          </View>
        </Card>

        {/* Security */}
        <Text style={[styles.sectionTitle, { color: c.textSecondary }]}>SECURITY</Text>
        <Card>
          <Text style={[styles.settingLabel, { color: c.text, marginBottom: 12 }]}>Auto-Lock Timer</Text>
          <View style={styles.lockOptions}>
            {lockTimeOptions.map((opt) => (
              <TouchableOpacity
                key={opt.value}
                style={[
                  styles.lockOption,
                  { borderColor: autoLockMinutes === opt.value ? c.accent : c.border },
                  autoLockMinutes === opt.value && { backgroundColor: `${c.accent}15` },
                ]}
                onPress={() => setAutoLockMinutes(opt.value)}
              >
                <Text style={[styles.lockOptionText, { color: autoLockMinutes === opt.value ? c.accent : c.textSecondary }]}>
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </Card>

        {/* Profiles */}
        <Text style={[styles.sectionTitle, { color: c.textSecondary }]}>PROFILES</Text>
        <Card>
          {profiles.map((profile) => (
            <View key={profile.id} style={[styles.profileRow, { borderBottomColor: c.surface }]}>
              <View style={[styles.profileAvatar, { backgroundColor: `${c.accent}15` }]}>
                <Text style={[styles.profileInitial, { color: c.accent }]}>
                  {profile.name.charAt(0).toUpperCase()}
                </Text>
              </View>
              <View style={styles.profileInfo}>
                <Text style={[styles.profileName, { color: c.text }]}>{profile.name}</Text>
                <Text style={[styles.profileId, { color: c.textMuted }]}>ID: {profile.id}</Text>
              </View>
              <TouchableOpacity
                testID={`delete-profile-${profile.id}`}
                style={styles.deleteButton}
                onPress={() => handleDeleteProfile(profile)}
              >
                <Ionicons name="trash-outline" size={20} color="#f44336" />
              </TouchableOpacity>
            </View>
          ))}
          {profiles.length === 0 && (
            <Text style={[styles.emptyText, { color: c.textMuted }]}>No profiles found</Text>
          )}
        </Card>

        {/* Data */}
        <Text style={[styles.sectionTitle, { color: c.textSecondary }]}>DATA</Text>
        <Card>
          <TouchableOpacity style={styles.settingRow} onPress={() => router.push('/import')}>
            <View style={[styles.settingIcon, { backgroundColor: `${c.investment}15` }]}>
              <Ionicons name="cloud-upload-outline" size={20} color={c.investment} />
            </View>
            <View style={styles.settingContent}>
              <Text style={[styles.settingLabel, { color: c.text }]}>Import Transactions</Text>
              <Text style={[styles.settingValue, { color: c.textSecondary }]}>Upload CSV or Excel</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={c.textMuted} />
          </TouchableOpacity>
        </Card>

        {/* Info */}
        <Card style={styles.infoCard}>
          <View style={styles.infoRow}>
            <Ionicons name="shield-checkmark-outline" size={18} color={c.accent} />
            <Text style={[styles.infoText, { color: c.textSecondary }]}>
              All data is AES-256 encrypted locally
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Ionicons name="server-outline" size={18} color={c.accent} />
            <Text style={[styles.infoText, { color: c.textSecondary }]}>
              No cloud storage — your data stays on device
            </Text>
          </View>
        </Card>

        <Text style={[styles.version, { color: c.textMuted }]}>Budget Tracker v2.0</Text>
        <View style={{ height: 30 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollView: { flex: 1, paddingHorizontal: 16 },
  title: { fontSize: 26, fontWeight: 'bold', marginTop: 16, marginBottom: 24 },
  sectionTitle: { fontSize: 13, fontWeight: '600', letterSpacing: 0.5, marginBottom: 8, marginTop: 8, marginLeft: 4 },
  settingRow: { flexDirection: 'row', alignItems: 'center' },
  settingIcon: { width: 40, height: 40, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginRight: 14 },
  settingContent: { flex: 1 },
  settingLabel: { fontSize: 16, fontWeight: '500' },
  settingValue: { fontSize: 13, marginTop: 2 },
  toggle: { width: 48, height: 26, borderRadius: 13, padding: 2 },
  toggleActive: {},
  toggleKnob: { width: 22, height: 22, borderRadius: 11, backgroundColor: '#fff' },
  toggleKnobActive: { transform: [{ translateX: 22 }] },
  currencyRow: { flexDirection: 'row', gap: 12 },
  currencyOption: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 14, borderRadius: 10, borderWidth: 1.5,
  },
  currencySymbol: { fontSize: 20, fontWeight: 'bold' },
  currencyLabel: { fontSize: 15, fontWeight: '600' },
  lockOptions: { flexDirection: 'row', gap: 8 },
  lockOption: { flex: 1, paddingVertical: 10, borderRadius: 8, borderWidth: 1.5, alignItems: 'center' },
  lockOptionText: { fontSize: 13, fontWeight: '600' },
  profileRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1 },
  profileAvatar: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  profileInitial: { fontSize: 18, fontWeight: 'bold' },
  profileInfo: { flex: 1 },
  profileName: { fontSize: 16, fontWeight: '600' },
  profileId: { fontSize: 12, marginTop: 2 },
  deleteButton: { padding: 8 },
  emptyText: { fontSize: 14, textAlign: 'center', paddingVertical: 16 },
  infoCard: { marginTop: 8 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  infoText: { fontSize: 14, flex: 1 },
  version: { textAlign: 'center', fontSize: 12, marginTop: 20 },
});
