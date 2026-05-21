import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';

export default function LoginScreen() {
  const { login } = useAuth();
  const [apiKey, setApiKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [showKey, setShowKey] = useState(false);

  const handleLogin = async () => {
    if (!apiKey.trim()) {
      Alert.alert('Error', 'Ingresá tu API key');
      return;
    }
    setLoading(true);
    try {
      await login(apiKey.trim());
    } catch {
      Alert.alert('API key inválida', 'Verificá la clave con tu supervisor.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Logo */}
      <View style={styles.logoBox}>
        <View style={styles.logoIcon}>
          <Ionicons name="water" size={40} color="#fff" />
        </View>
        <Text style={styles.logoTitle}>PoolPay</Text>
        <Text style={styles.logoSub}>App de Pileteros</Text>
      </View>

      {/* Card */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Ingresar</Text>
        <Text style={styles.cardSub}>
          Pedile tu API key al supervisor y pegala acá.
        </Text>

        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            placeholder="API key (ej: xK9mP2q...)"
            placeholderTextColor="#64748b"
            value={apiKey}
            onChangeText={setApiKey}
            secureTextEntry={!showKey}
            autoCapitalize="none"
            autoCorrect={false}
            onSubmitEditing={handleLogin}
          />
          <TouchableOpacity
            onPress={() => setShowKey(!showKey)}
            style={styles.eyeBtn}
          >
            <Ionicons
              name={showKey ? 'eye-off-outline' : 'eye-outline'}
              size={20}
              color="#64748b"
            />
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={[styles.btn, loading && styles.btnDisabled]}
          onPress={handleLogin}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.btnText}>Entrar</Text>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
    justifyContent: 'center',
    padding: 24,
  },
  logoBox: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logoIcon: {
    width: 80,
    height: 80,
    borderRadius: 20,
    backgroundColor: '#3b82f6',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  logoTitle: {
    color: '#fff',
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  logoSub: {
    color: '#64748b',
    fontSize: 15,
    marginTop: 4,
  },
  card: {
    backgroundColor: '#1e293b',
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: '#334155',
  },
  cardTitle: {
    color: '#f1f5f9',
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 6,
  },
  cardSub: {
    color: '#64748b',
    fontSize: 13,
    marginBottom: 20,
    lineHeight: 18,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0f172a',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 16,
    paddingHorizontal: 14,
  },
  input: {
    flex: 1,
    color: '#f1f5f9',
    fontSize: 14,
    paddingVertical: 14,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  eyeBtn: {
    padding: 4,
  },
  btn: {
    backgroundColor: '#3b82f6',
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
  },
  btnDisabled: {
    opacity: 0.6,
  },
  btnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
});
