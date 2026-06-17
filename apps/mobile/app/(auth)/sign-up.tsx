import { Stack } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Button,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { useAuthStore } from '../../src/state/authStore';
import { supabase } from '../../src/supabase/client';

export default function SignUpScreen() {
  const user = useAuthStore((state) => state.user);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    setErrorMessage(null);
    setInfoMessage(null);
    setIsSubmitting(true);

    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
    });

    setIsSubmitting(false);
    if (error) {
      setErrorMessage(error.message);
      return;
    }
    if (!data.session) {
      setInfoMessage('Account created. Check your email to confirm before signing in.');
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.container}
    >
      <Stack.Screen options={{ title: 'Sign up' }} />
      <View style={styles.form}>
        <Text style={styles.heading}>Sign up</Text>
        <TextInput
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          onChangeText={setEmail}
          placeholder="Email"
          style={styles.input}
          value={email}
        />
        <TextInput
          autoCapitalize="none"
          autoComplete="password-new"
          onChangeText={setPassword}
          placeholder="Password"
          secureTextEntry
          style={styles.input}
          value={password}
        />
        {errorMessage ? <Text style={styles.error}>{errorMessage}</Text> : null}
        {infoMessage ? <Text style={styles.info}>{infoMessage}</Text> : null}
        {user ? <Text style={styles.success}>Signed in as {user.email}</Text> : null}
        {isSubmitting ? (
          <ActivityIndicator />
        ) : (
          <Button title="Sign up" onPress={handleSubmit} />
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    backgroundColor: '#fff',
    padding: 24,
  },
  form: {
    gap: 12,
  },
  heading: {
    fontSize: 28,
    fontWeight: '600',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
  },
  error: {
    color: '#b00020',
  },
  info: {
    color: '#1d4ed8',
  },
  success: {
    color: '#166534',
  },
});
