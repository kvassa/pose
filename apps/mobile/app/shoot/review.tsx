import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  deleteCloudCapture,
  saveCaptureToLibrary,
  syncCaptureToCloud,
  type CloudCaptureResult,
} from '../../src/capture/saveCapture';

/**
 * After a shot: show your photo next to the reference.
 * Save = keep it (Photos + cloud). Retake = throw it away.
 */
export default function CaptureReviewScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    uri: string;
    score: string;
    referenceId: string;
    referenceUrl?: string;
  }>();

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const uri = params.uri ? decodeURIComponent(params.uri) : '';
  const referenceId = params.referenceId;
  const score = Number(params.score ?? 0);
  const referenceUrl = params.referenceUrl
    ? decodeURIComponent(params.referenceUrl)
    : null;

  const handleSave = async () => {
    if (!uri || !referenceId || busy) return;
    setBusy(true);
    setError(null);
    let cloud: CloudCaptureResult | null = null;
    try {
      // 1) Save into the phone's Photos app
      await saveCaptureToLibrary(uri);
      // 2) Optional cloud backup (default on)
      cloud = await syncCaptureToCloud({
        uri,
        referenceId,
        matchScore: score,
      });
      console.log('capture saved', { score, cloud });
      router.back();
    } catch (e) {
      if (cloud) {
        try {
          await deleteCloudCapture(cloud);
        } catch {
          // ignore cleanup failure
        }
      }
      const message = e instanceof Error ? e.message : 'Save failed';
      console.log('capture save failed:', message);
      setError(message);
      setBusy(false);
    }
  };

  const handleRetake = () => {
    if (busy) return;
    router.back();
  };

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'Review', presentation: 'modal' }} />
      <Text style={styles.title}>Nice shot</Text>
      <Text style={styles.score}>Match {Math.round(score)}</Text>

      <View style={styles.row}>
        <View style={styles.half}>
          <Text style={styles.label}>Yours</Text>
          {uri ? (
            <Image source={{ uri }} style={styles.image} resizeMode="cover" />
          ) : (
            <View style={[styles.image, styles.placeholder]} />
          )}
        </View>
        <View style={styles.half}>
          <Text style={styles.label}>Reference</Text>
          {referenceUrl ? (
            <Image source={{ uri: referenceUrl }} style={styles.image} resizeMode="cover" />
          ) : (
            <View style={[styles.image, styles.placeholder]} />
          )}
        </View>
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <View style={styles.actions}>
        <Pressable
          style={[styles.button, styles.secondary]}
          onPress={handleRetake}
          disabled={busy}
        >
          <Text style={styles.secondaryText}>Retake</Text>
        </Pressable>
        <Pressable
          style={[styles.button, styles.primary]}
          onPress={() => void handleSave()}
          disabled={busy}
        >
          {busy ? (
            <ActivityIndicator color="#000" />
          ) : (
            <Text style={styles.primaryText}>Save</Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
    paddingTop: 56,
    paddingHorizontal: 20,
    paddingBottom: 32,
  },
  title: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '800',
  },
  score: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 16,
    marginTop: 4,
    marginBottom: 24,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
    flex: 1,
  },
  half: {
    flex: 1,
  },
  label: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 8,
  },
  image: {
    flex: 1,
    borderRadius: 12,
    backgroundColor: '#1a1a1a',
  },
  placeholder: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  error: {
    color: '#f87171',
    marginTop: 16,
    textAlign: 'center',
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
  },
  button: {
    flex: 1,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primary: {
    backgroundColor: '#fff',
  },
  secondary: {
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  primaryText: {
    color: '#000',
    fontSize: 16,
    fontWeight: '700',
  },
  secondaryText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});
