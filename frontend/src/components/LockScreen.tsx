import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  FlatList,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as LocalAuthentication from 'expo-local-authentication';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  getAuthStatus,
  createProfile,
  profileLogin,
  Profile,
} from '../api';
import { useAppStore } from '../store';

const STORED_PASSWORD_KEY = 'budget_tracker_saved_pwd';
const STORED_PROFILE_KEY = 'budget_tracker_last_profile';

type Screen = 'loading' | 'profiles' | 'create' | 'login';

interface LockScreenProps {
  onUnlock: () => void;
}

export const LockScreen: React.FC<LockScreenProps> = ({ onUnlock }) => {
  const { biometricEnabled, setBiometricEnabled } = useAppStore();
  const [screen, setScreen] = useState<Screen>('loading');
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [selectedProfile, setSelectedProfile] = useState<Profile | null>(null);

  // Form state
  const [profileName, setProfileName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricType, setBiometricType] = useState('Biometrics');

  useEffect(() => {
    checkStatus();
    checkBiometrics();
  }, []);

  const checkBiometrics = async () => {
    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();
      setBiometricAvailable(hasHardware && isEnrolled);
      if (hasHardware && isEnrolled) {
        const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
        if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
          setBiometricType('Face ID');
        } else if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
          setBiometricType('Fingerprint');
        }
      }
    } catch {
      setBiometricAvailable(false);
    }
  };

  const checkStatus = async () => {
    try {
      const status = await getAuthStatus();
      if (status.authenticated) {
        onUnlock();
        return;
      }
      setProfiles(status.profiles);
      if (status.profiles.length === 0) {
        setScreen('create');
      } else {
        setScreen('profiles');
      }
    } catch {
      setTimeout(checkStatus, 2000);
    }
  };

  const attemptBiometric = useCallback(async (profile: Profile) => {
    if (!biometricEnabled || !biometricAvailable) return;
    const savedPwd = await AsyncStorage.getItem(STORED_PASSWORD_KEY);
    const savedProfileId = await AsyncStorage.getItem(STORED_PROFILE_KEY);
    if (!savedPwd || savedProfileId !== profile.id) return;

    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: `Unlock ${profile.name}`,
        cancelLabel: 'Use Password',
        disableDeviceFallback: true,
      });
      if (result.success) {
        setSubmitting(true);
        try {
          await profileLogin(profile.id, savedPwd);
          onUnlock();
        } catch {
          setError('Biometric succeeded but login failed. Use password.');
        } finally {
          setSubmitting(false);
        }
      }
    } catch { /* user cancelled */ }
  }, [biometricEnabled, biometricAvailable, onUnlock]);

  const handleCreateProfile = async () => {
    setError('');
    if (!profileName.trim()) { setError('Profile name is required'); return; }
    if (password.length < 4) { setError('Password must be at least 4 characters'); return; }
    if (password !== confirmPassword) { setError('Passwords do not match'); return; }

    setSubmitting(true);
    try {
      const result = await createProfile(profileName.trim(), password);
      if (biometricAvailable) {
        await AsyncStorage.setItem(STORED_PASSWORD_KEY, password);
        await AsyncStorage.setItem(STORED_PROFILE_KEY, result.profile.id);
        setBiometricEnabled(true);
      }
      onUnlock();
    } catch (e: any) {
      setError(e.response?.data?.detail || 'Failed to create profile');
    } finally {
      setSubmitting(false);
    }
  };

  const handleLogin = async () => {
    setError('');
    if (!selectedProfile) return;
    if (!password) { setError('Enter your password'); return; }

    setSubmitting(true);
    try {
      await profileLogin(selectedProfile.id, password);
      if (biometricAvailable && biometricEnabled) {
        await AsyncStorage.setItem(STORED_PASSWORD_KEY, password);
        await AsyncStorage.setItem(STORED_PROFILE_KEY, selectedProfile.id);
      }
      onUnlock();
    } catch (e: any) {
      setError(e.response?.data?.detail || 'Incorrect password');
    } finally {
      setSubmitting(false);
    }
  };

  const selectProfile = (profile: Profile) => {
    setSelectedProfile(profile);
    setPassword('');
    setError('');
    setScreen('login');
    attemptBiometric(profile);
  };

  if (screen === 'loading') {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#4CAF50" />
      </View>
    );
  }

  // Profile list screen
  if (screen === 'profiles') {
    return (
      <View style={styles.container}>
        <View style={styles.content}>
          <View style={styles.iconWrapper}>
            <Ionicons name="people" size={48} color="#4CAF50" />
          </View>
          <Text style={styles.title}>Select Profile</Text>
          <Text style={styles.subtitle}>Choose a profile to access your budget data</Text>

          <View style={styles.profilesList}>
            {profiles.map((p) => (
              <TouchableOpacity
                key={p.id}
                testID={`profile-${p.id}`}
                style={styles.profileCard}
                onPress={() => selectProfile(p)}
              >
                <View style={styles.profileAvatar}>
                  <Text style={styles.profileAvatarText}>{p.name.charAt(0).toUpperCase()}</Text>
                </View>
                <Text style={styles.profileName}>{p.name}</Text>
                <Ionicons name="chevron-forward" size={20} color="#666" />
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity
            testID="create-profile-btn"
            style={styles.createButton}
            onPress={() => {
              setProfileName('');
              setPassword('');
              setConfirmPassword('');
              setError('');
              setScreen('create');
            }}
          >
            <Ionicons name="add-circle-outline" size={22} color="#4CAF50" />
            <Text style={styles.createButtonText}>Create New Profile</Text>
          </TouchableOpacity>

          <View style={styles.infoRow}>
            <Ionicons name="shield-checkmark-outline" size={16} color="#4CAF50" />
            <Text style={styles.infoText}>Each profile is independently encrypted</Text>
          </View>
        </View>
      </View>
    );
  }

  // Create profile screen
  if (screen === 'create') {
    return (
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <View style={styles.iconWrapper}>
            <Ionicons name="person-add" size={48} color="#4CAF50" />
          </View>
          <Text style={styles.title}>Create Profile</Text>
          <Text style={styles.subtitle}>Set up a new encrypted budget profile</Text>

          <View style={styles.inputContainer}>
            <Ionicons name="person-outline" size={20} color="#666" style={styles.inputIcon} />
            <TextInput
              testID="profile-name-input"
              style={styles.input}
              placeholder="Profile Name"
              placeholderTextColor="#666"
              value={profileName}
              onChangeText={(t) => { setProfileName(t); setError(''); }}
            />
          </View>

          <View style={styles.inputContainer}>
            <Ionicons name="lock-closed-outline" size={20} color="#666" style={styles.inputIcon} />
            <TextInput
              testID="password-input"
              style={styles.input}
              placeholder="Password"
              placeholderTextColor="#666"
              secureTextEntry={!showPassword}
              value={password}
              onChangeText={(t) => { setPassword(t); setError(''); }}
            />
            <TouchableOpacity style={styles.eyeButton} onPress={() => setShowPassword(!showPassword)}>
              <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={22} color="#888" />
            </TouchableOpacity>
          </View>

          <View style={styles.inputContainer}>
            <Ionicons name="lock-closed-outline" size={20} color="#666" style={styles.inputIcon} />
            <TextInput
              testID="confirm-password-input"
              style={styles.input}
              placeholder="Confirm Password"
              placeholderTextColor="#666"
              secureTextEntry={!showPassword}
              value={confirmPassword}
              onChangeText={(t) => { setConfirmPassword(t); setError(''); }}
            />
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <TouchableOpacity
            testID="auth-submit-btn"
            style={[styles.button, submitting && styles.buttonDisabled]}
            onPress={handleCreateProfile}
            disabled={submitting}
          >
            {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Create Profile</Text>}
          </TouchableOpacity>

          {profiles.length > 0 && (
            <TouchableOpacity style={styles.backButton} onPress={() => setScreen('profiles')}>
              <Ionicons name="arrow-back" size={18} color="#888" />
              <Text style={styles.backButtonText}>Back to Profiles</Text>
            </TouchableOpacity>
          )}

          <View style={styles.infoRow}>
            <Ionicons name="shield-checkmark-outline" size={16} color="#4CAF50" />
            <Text style={styles.infoText}>AES-encrypted on disk</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  // Login screen
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <View style={styles.content}>
        <View style={styles.iconWrapper}>
          <Text style={styles.avatarLarge}>{selectedProfile?.name.charAt(0).toUpperCase()}</Text>
        </View>
        <Text style={styles.title}>{selectedProfile?.name}</Text>
        <Text style={styles.subtitle}>Enter password to unlock</Text>

        <View style={styles.inputContainer}>
          <Ionicons name="lock-closed-outline" size={20} color="#666" style={styles.inputIcon} />
          <TextInput
            testID="password-input"
            style={styles.input}
            placeholder="Password"
            placeholderTextColor="#666"
            secureTextEntry={!showPassword}
            value={password}
            onChangeText={(t) => { setPassword(t); setError(''); }}
            autoFocus
          />
          <TouchableOpacity style={styles.eyeButton} onPress={() => setShowPassword(!showPassword)}>
            <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={22} color="#888" />
          </TouchableOpacity>
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <TouchableOpacity
          testID="auth-submit-btn"
          style={[styles.button, submitting && styles.buttonDisabled]}
          onPress={handleLogin}
          disabled={submitting}
        >
          {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Unlock</Text>}
        </TouchableOpacity>

        {biometricAvailable && biometricEnabled && (
          <TouchableOpacity testID="biometric-btn" style={styles.biometricButton} onPress={() => selectedProfile && attemptBiometric(selectedProfile)}>
            <Ionicons name={biometricType === 'Face ID' ? 'scan-outline' : 'finger-print-outline'} size={32} color="#4CAF50" />
            <Text style={styles.biometricText}>Use {biometricType}</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity style={styles.backButton} onPress={() => { setPassword(''); setError(''); setScreen('profiles'); }}>
          <Ionicons name="arrow-back" size={18} color="#888" />
          <Text style={styles.backButtonText}>Switch Profile</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0c0c0c', justifyContent: 'center' },
  content: { paddingHorizontal: 32, alignItems: 'center' },
  scrollContent: { paddingHorizontal: 32, alignItems: 'center', paddingVertical: 60 },
  iconWrapper: {
    width: 96, height: 96, borderRadius: 48,
    backgroundColor: '#4CAF5015', justifyContent: 'center', alignItems: 'center', marginBottom: 24,
  },
  avatarLarge: { fontSize: 40, fontWeight: 'bold', color: '#4CAF50' },
  title: { fontSize: 28, fontWeight: 'bold', color: '#fff', marginBottom: 8 },
  subtitle: { fontSize: 15, color: '#888', textAlign: 'center', marginBottom: 32, lineHeight: 22 },
  profilesList: { width: '100%', marginBottom: 16 },
  profileCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#1a1a1a', borderRadius: 12, padding: 16, marginBottom: 8,
  },
  profileAvatar: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: '#4CAF5020', justifyContent: 'center', alignItems: 'center', marginRight: 14,
  },
  profileAvatarText: { fontSize: 20, fontWeight: 'bold', color: '#4CAF50' },
  profileName: { flex: 1, fontSize: 17, fontWeight: '600', color: '#fff' },
  createButton: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingVertical: 14, paddingHorizontal: 20,
    borderWidth: 1, borderColor: '#4CAF50', borderRadius: 12, borderStyle: 'dashed',
    marginBottom: 24, width: '100%', justifyContent: 'center',
  },
  createButtonText: { color: '#4CAF50', fontSize: 16, fontWeight: '600' },
  inputContainer: {
    width: '100%', flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#1a1a1a', borderRadius: 12, borderWidth: 1, borderColor: '#333', marginBottom: 16,
  },
  inputIcon: { paddingLeft: 16 },
  input: { flex: 1, padding: 16, color: '#fff', fontSize: 16 },
  eyeButton: { padding: 16 },
  error: { color: '#f44336', fontSize: 14, marginBottom: 16, textAlign: 'center' },
  button: {
    width: '100%', backgroundColor: '#4CAF50', padding: 16,
    borderRadius: 12, alignItems: 'center', marginBottom: 16,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#fff', fontSize: 18, fontWeight: '600' },
  biometricButton: { alignItems: 'center', paddingVertical: 12, marginBottom: 8 },
  biometricText: { color: '#4CAF50', fontSize: 14, marginTop: 8 },
  backButton: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingVertical: 12, marginBottom: 16,
  },
  backButtonText: { color: '#888', fontSize: 15 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  infoText: { color: '#666', fontSize: 13 },
});
