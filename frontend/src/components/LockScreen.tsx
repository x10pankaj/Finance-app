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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as LocalAuthentication from 'expo-local-authentication';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getAuthStatus, setupPassword, login } from '../api';
import { useAppStore } from '../store';

const STORED_PASSWORD_KEY = 'budget_tracker_saved_pwd';

interface LockScreenProps {
  onUnlock: () => void;
}

export const LockScreen: React.FC<LockScreenProps> = ({ onUnlock }) => {
  const { biometricEnabled, setBiometricEnabled } = useAppStore();
  const [loading, setLoading] = useState(true);
  const [isSetup, setIsSetup] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricType, setBiometricType] = useState<string>('Biometrics');

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
      setIsSetup(!status.password_set);
      if (status.authenticated) {
        onUnlock();
        return;
      }
      // If password is set and biometric enabled, try biometric
      if (status.password_set) {
        setLoading(false);
        attemptBiometric();
      }
    } catch {
      setTimeout(checkStatus, 2000);
    } finally {
      setLoading(false);
    }
  };

  const attemptBiometric = useCallback(async () => {
    if (!biometricEnabled || !biometricAvailable) return;

    const savedPwd = await AsyncStorage.getItem(STORED_PASSWORD_KEY);
    if (!savedPwd) return;

    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Unlock Budget Tracker',
        cancelLabel: 'Use Password',
        disableDeviceFallback: true,
      });

      if (result.success) {
        setSubmitting(true);
        try {
          await login(savedPwd);
          onUnlock();
        } catch {
          setError('Biometric succeeded but login failed. Use password.');
        } finally {
          setSubmitting(false);
        }
      }
    } catch {
      // Biometric failed or cancelled, user falls back to password
    }
  }, [biometricEnabled, biometricAvailable, onUnlock]);

  useEffect(() => {
    if (!loading && !isSetup && biometricAvailable && biometricEnabled) {
      attemptBiometric();
    }
  }, [loading, isSetup, biometricAvailable, biometricEnabled, attemptBiometric]);

  const handleSetup = async () => {
    setError('');
    if (password.length < 4) {
      setError('Password must be at least 4 characters');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    setSubmitting(true);
    try {
      await setupPassword(password);
      // Save password for biometric unlock
      if (biometricAvailable) {
        await AsyncStorage.setItem(STORED_PASSWORD_KEY, password);
        setBiometricEnabled(true);
      }
      onUnlock();
    } catch (e: any) {
      setError(e.response?.data?.detail || 'Failed to set password');
    } finally {
      setSubmitting(false);
    }
  };

  const handleLogin = async () => {
    setError('');
    if (!password) {
      setError('Please enter your password');
      return;
    }
    setSubmitting(true);
    try {
      await login(password);
      // Save password for future biometric use
      if (biometricAvailable && biometricEnabled) {
        await AsyncStorage.setItem(STORED_PASSWORD_KEY, password);
      }
      onUnlock();
    } catch (e: any) {
      setError(e.response?.data?.detail || 'Incorrect password');
    } finally {
      setSubmitting(false);
    }
  };

  const handleBiometricToggle = async () => {
    if (!biometricEnabled) {
      // Enabling - save current password for biometric unlock
      if (password) {
        await AsyncStorage.setItem(STORED_PASSWORD_KEY, password);
      }
      setBiometricEnabled(true);
    } else {
      await AsyncStorage.removeItem(STORED_PASSWORD_KEY);
      setBiometricEnabled(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#4CAF50" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <View style={styles.content}>
        <View style={styles.iconWrapper}>
          <Ionicons name="lock-closed" size={48} color="#4CAF50" />
        </View>
        <Text style={styles.title}>
          {isSetup ? 'Create Password' : 'Welcome Back'}
        </Text>
        <Text style={styles.subtitle}>
          {isSetup
            ? 'Set a password to encrypt your budget data'
            : 'Enter your password to unlock'}
        </Text>

        <View style={styles.inputContainer}>
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
          <TouchableOpacity
            style={styles.eyeButton}
            onPress={() => setShowPassword(!showPassword)}
          >
            <Ionicons
              name={showPassword ? 'eye-off-outline' : 'eye-outline'}
              size={22}
              color="#888"
            />
          </TouchableOpacity>
        </View>

        {isSetup && (
          <View style={styles.inputContainer}>
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
        )}

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <TouchableOpacity
          testID="auth-submit-btn"
          style={[styles.button, submitting && styles.buttonDisabled]}
          onPress={isSetup ? handleSetup : handleLogin}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>
              {isSetup ? 'Create & Enter' : 'Unlock'}
            </Text>
          )}
        </TouchableOpacity>

        {/* Biometric button (login only) */}
        {!isSetup && biometricAvailable && biometricEnabled && (
          <TouchableOpacity
            testID="biometric-btn"
            style={styles.biometricButton}
            onPress={attemptBiometric}
          >
            <Ionicons
              name={biometricType === 'Face ID' ? 'scan-outline' : 'finger-print-outline'}
              size={32}
              color="#4CAF50"
            />
            <Text style={styles.biometricText}>Use {biometricType}</Text>
          </TouchableOpacity>
        )}

        {/* Biometric toggle for setup / login with bio available */}
        {biometricAvailable && !isSetup && (
          <TouchableOpacity
            testID="biometric-toggle"
            style={styles.biometricToggle}
            onPress={handleBiometricToggle}
          >
            <View style={styles.toggleRow}>
              <Ionicons name="finger-print-outline" size={20} color="#888" />
              <Text style={styles.toggleText}>
                {biometricType} Unlock
              </Text>
              <View style={[styles.toggle, biometricEnabled && styles.toggleActive]}>
                <View style={[styles.toggleKnob, biometricEnabled && styles.toggleKnobActive]} />
              </View>
            </View>
          </TouchableOpacity>
        )}

        <View style={styles.infoRow}>
          <Ionicons name="shield-checkmark-outline" size={16} color="#4CAF50" />
          <Text style={styles.infoText}>
            All data is AES-encrypted on disk
          </Text>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0c0c0c',
    justifyContent: 'center',
  },
  content: {
    paddingHorizontal: 32,
    alignItems: 'center',
  },
  iconWrapper: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#4CAF5015',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: '#888',
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 22,
  },
  inputContainer: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#333',
    marginBottom: 16,
  },
  input: {
    flex: 1,
    padding: 16,
    color: '#fff',
    fontSize: 16,
  },
  eyeButton: {
    padding: 16,
  },
  error: {
    color: '#f44336',
    fontSize: 14,
    marginBottom: 16,
    textAlign: 'center',
  },
  button: {
    width: '100%',
    backgroundColor: '#4CAF50',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 16,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  biometricButton: {
    alignItems: 'center',
    paddingVertical: 16,
    marginBottom: 16,
  },
  biometricText: {
    color: '#4CAF50',
    fontSize: 14,
    marginTop: 8,
  },
  biometricToggle: {
    width: '100%',
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  toggleText: {
    flex: 1,
    color: '#ccc',
    fontSize: 15,
  },
  toggle: {
    width: 48,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#333',
    padding: 2,
  },
  toggleActive: {
    backgroundColor: '#4CAF50',
  },
  toggleKnob: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#fff',
  },
  toggleKnobActive: {
    transform: [{ translateX: 22 }],
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  infoText: {
    color: '#666',
    fontSize: 13,
  },
});
