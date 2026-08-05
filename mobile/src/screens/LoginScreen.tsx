import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Image,
} from 'react-native';
import { useAuth } from '@/lib/auth';
import { ApiError } from '@/lib/api';
import { colors } from '@/lib/theme';

export default function LoginScreen() {
  const { login, isLoading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function handleLogin() {
    setError(null);
    if (!email || !password) {
      setError('Please enter your Login ID / phone / email and password.');
      return;
    }
    try {
      await login(email.trim(), password);
    } catch (err) {
      setError(err instanceof ApiError ? err.body?.message ?? err.message : 'Login failed');
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.header}>
        <Image source={require('../../assets/icon.png')} style={styles.logo} resizeMode="contain" />
        <Text style={styles.schoolName}>School Management System</Text>
        <Text style={styles.tagline}>Connect</Text>
      </View>

      <View style={styles.form}>
        <Text style={styles.label}>Login ID / Phone / Email</Text>
        <TextInput
          style={styles.input}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          placeholder="e.g. 020101060001"
          placeholderTextColor="#9AA8A1"
        />

        <Text style={styles.label}>Password</Text>
        <TextInput
          style={styles.input}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          placeholder="••••••••"
          placeholderTextColor="#9AA8A1"
        />

        {error && <Text style={styles.error}>{error}</Text>}

        <TouchableOpacity style={styles.button} onPress={handleLogin} disabled={isLoading}>
          {isLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Log In</Text>}
        </TouchableOpacity>

        <Text style={styles.hint}>
          Use the Login ID (or phone/email) and password given to you by the school office.
        </Text>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.green, justifyContent: 'center' },
  header: { alignItems: 'center', marginBottom: 32 },
  logo: { width: 84, height: 100, marginBottom: 14 },
  schoolName: { color: '#fff', fontSize: 22, fontWeight: '700' },
  tagline: { color: colors.gold, fontSize: 14, marginTop: 4, fontWeight: '600', letterSpacing: 1 },
  form: {
    backgroundColor: colors.card,
    marginHorizontal: 24,
    borderRadius: 16,
    padding: 24,
  },
  label: { fontSize: 13, color: colors.textMuted, marginBottom: 6, marginTop: 14, fontWeight: '600' },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: colors.text,
  },
  error: { color: colors.danger, marginTop: 14, fontSize: 13 },
  button: {
    backgroundColor: colors.green,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 22,
  },
  buttonText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  hint: { color: colors.textMuted, fontSize: 12, marginTop: 16, textAlign: 'center', lineHeight: 18 },
});
