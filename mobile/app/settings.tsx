import { router } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { createRecommenderClient, RecommenderError } from '../src/api/client';
import { createOpenCodeClient, OpenCodeError } from '../src/opencode/client';
import { useConnectionConfig } from '../src/storage/connectionConfig';
import { deriveDefaultRecommenderUrl, useRecommenderConfig } from '../src/storage/recommenderConfig';
import { useColors } from '../src/theme/colors';

type TestResult = { ok: true } | { ok: false; message: string };

export default function SettingsScreen() {
  const colors = useColors();
  const { config, save } = useConnectionConfig();
  const { config: recommenderConfig, save: saveRecommender } = useRecommenderConfig();

  const [serverUrl, setServerUrl] = useState(config?.baseUrl ?? '');
  const [username, setUsername] = useState(config?.username ?? 'opencode');
  const [password, setPassword] = useState(config?.password ?? '');
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<TestResult | null>(null);

  const [recommenderUrl, setRecommenderUrl] = useState(
    recommenderConfig?.baseUrl ?? deriveDefaultRecommenderUrl(config?.baseUrl) ?? '',
  );
  const [isTestingRecommender, setIsTestingRecommender] = useState(false);
  const [recommenderTestResult, setRecommenderTestResult] = useState<TestResult | null>(null);

  const canSave = testResult?.ok === true;
  const canSaveRecommender = recommenderTestResult?.ok === true;

  async function handleTestConnection() {
    if (!serverUrl.trim()) {
      setTestResult({ ok: false, message: 'Enter a server URL.' });
      return;
    }
    setIsTesting(true);
    setTestResult(null);
    const client = createOpenCodeClient({ baseUrl: serverUrl.trim(), username: username.trim(), password });
    try {
      await client.checkHealth();
      setTestResult({ ok: true });
    } catch (err) {
      if (err instanceof OpenCodeError) {
        const message =
          err.kind === 'unauthorized'
            ? 'Wrong username or password.'
            : err.kind === 'network'
              ? 'Could not reach that address. Check the URL and that opencode serve is running.'
              : `Unexpected response from the server (${err.message}).`;
        setTestResult({ ok: false, message });
      } else {
        setTestResult({ ok: false, message: 'Something went wrong testing the connection.' });
      }
    } finally {
      setIsTesting(false);
    }
  }

  async function handleSave() {
    await save({ serverUrl: serverUrl.trim(), username: username.trim() || undefined, password: password || undefined });
    router.back();
  }

  async function handleTestRecommenderConnection() {
    if (!recommenderUrl.trim()) {
      setRecommenderTestResult({ ok: false, message: 'Enter a recommender API URL.' });
      return;
    }
    setIsTestingRecommender(true);
    setRecommenderTestResult(null);
    const client = createRecommenderClient({ baseUrl: recommenderUrl.trim() });
    try {
      await client.checkHealth();
      setRecommenderTestResult({ ok: true });
    } catch (err) {
      if (err instanceof RecommenderError) {
        const message =
          err.kind === 'network'
            ? 'Could not reach that address. Check the URL and that the FastAPI app is running.'
            : `Unexpected response from the server (${err.message}).`;
        setRecommenderTestResult({ ok: false, message });
      } else {
        setRecommenderTestResult({ ok: false, message: 'Something went wrong testing the connection.' });
      }
    } finally {
      setIsTestingRecommender(false);
    }
  }

  async function handleSaveRecommender() {
    await saveRecommender(recommenderUrl.trim());
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['bottom']}>
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.field}>
          <Text style={[styles.label, { color: colors.textMuted }]}>Server URL</Text>
          <TextInput
            style={[styles.input, { borderColor: colors.border, color: colors.text }]}
            placeholder="http://192.168.1.10:4096"
            placeholderTextColor={colors.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            value={serverUrl}
            onChangeText={(v) => {
              setServerUrl(v);
              setTestResult(null);
            }}
          />
        </View>

        <View style={styles.field}>
          <Text style={[styles.label, { color: colors.textMuted }]}>Username</Text>
          <TextInput
            style={[styles.input, { borderColor: colors.border, color: colors.text }]}
            placeholder="opencode"
            placeholderTextColor={colors.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
            value={username}
            onChangeText={(v) => {
              setUsername(v);
              setTestResult(null);
            }}
          />
        </View>

        <View style={styles.field}>
          <Text style={[styles.label, { color: colors.textMuted }]}>Password</Text>
          <View style={styles.passwordRow}>
            <TextInput
              style={[styles.input, styles.passwordInput, { borderColor: colors.border, color: colors.text }]}
              placeholder="Leave blank if the server has no password"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
              secureTextEntry={!isPasswordVisible}
              value={password}
              onChangeText={(v) => {
                setPassword(v);
                setTestResult(null);
              }}
            />
            <Pressable onPress={() => setIsPasswordVisible((v) => !v)} hitSlop={8} style={styles.toggle}>
              <Text style={{ color: colors.accent }}>{isPasswordVisible ? 'Hide' : 'Show'}</Text>
            </Pressable>
          </View>
        </View>

        {testResult && (
          <Text style={[styles.resultText, { color: testResult.ok ? colors.success : colors.danger }]}>
            {testResult.ok ? 'Connected successfully.' : testResult.message}
          </Text>
        )}

        <Pressable
          style={[styles.button, styles.secondaryButton, { borderColor: colors.accent }]}
          onPress={handleTestConnection}
          disabled={isTesting}
        >
          {isTesting ? (
            <ActivityIndicator color={colors.accent} />
          ) : (
            <Text style={[styles.buttonText, { color: colors.accent }]}>Test Connection</Text>
          )}
        </Pressable>

        <Pressable
          style={[
            styles.button,
            { backgroundColor: canSave ? colors.accent : colors.border },
          ]}
          onPress={handleSave}
          disabled={!canSave}
        >
          <Text style={[styles.buttonText, { color: canSave ? '#FFFFFF' : colors.textMuted }]}>Save</Text>
        </Pressable>

        <Text style={[styles.footnote, { color: colors.textMuted }]}>
          On a different network than your computer? Point this at a Tailscale Serve or Cloudflare Tunnel URL
          instead of a raw LAN address.
        </Text>

        <View style={[styles.divider, { backgroundColor: colors.border }]} />

        <Text style={[styles.sectionTitle, { color: colors.text }]}>Recommender API</Text>
        <Text style={[styles.sectionSubtitle, { color: colors.textMuted }]}>
          Powers the Browse Catalog screen. Defaults to the OpenCode server's address on port 8000 — override it if
          the FastAPI app runs elsewhere.
        </Text>

        <View style={styles.field}>
          <Text style={[styles.label, { color: colors.textMuted }]}>Recommender API URL</Text>
          <TextInput
            style={[styles.input, { borderColor: colors.border, color: colors.text }]}
            placeholder="http://192.168.1.10:8000"
            placeholderTextColor={colors.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            value={recommenderUrl}
            onChangeText={(v) => {
              setRecommenderUrl(v);
              setRecommenderTestResult(null);
            }}
          />
        </View>

        {recommenderTestResult && (
          <Text style={[styles.resultText, { color: recommenderTestResult.ok ? colors.success : colors.danger }]}>
            {recommenderTestResult.ok ? 'Connected successfully.' : recommenderTestResult.message}
          </Text>
        )}

        <Pressable
          style={[styles.button, styles.secondaryButton, { borderColor: colors.accent }]}
          onPress={handleTestRecommenderConnection}
          disabled={isTestingRecommender}
        >
          {isTestingRecommender ? (
            <ActivityIndicator color={colors.accent} />
          ) : (
            <Text style={[styles.buttonText, { color: colors.accent }]}>Test Connection</Text>
          )}
        </Pressable>

        <Pressable
          style={[styles.button, { backgroundColor: canSaveRecommender ? colors.accent : colors.border }]}
          onPress={handleSaveRecommender}
          disabled={!canSaveRecommender}
        >
          <Text style={[styles.buttonText, { color: canSaveRecommender ? '#FFFFFF' : colors.textMuted }]}>Save</Text>
        </Pressable>
        </ScrollView>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    gap: 4,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginVertical: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 12,
  },
  field: {
    marginBottom: 12,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  input: {
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
  },
  passwordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  passwordInput: {
    flex: 1,
  },
  toggle: {
    paddingHorizontal: 4,
  },
  resultText: {
    fontSize: 13,
    marginBottom: 12,
  },
  button: {
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    borderWidth: StyleSheet.hairlineWidth * 2,
  },
  buttonText: {
    fontSize: 15,
    fontWeight: '600',
  },
  footnote: {
    fontSize: 12,
    lineHeight: 17,
    marginTop: 8,
  },
});
