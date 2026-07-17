import { useIsFocused } from '@react-navigation/native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  AppState,
  type AppStateStatus,
  Button,
  Image,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { type CameraPosition, useCameraDevice } from 'react-native-vision-camera';

import { CameraView, type CapturedPhoto } from '../../src/camera/CameraView';
import { useCameraPermissions } from '../../src/camera/useCameraPermissions';
import { supabase } from '../../src/supabase/client';
import { useReference } from '../../src/supabase/queries';

function useAppIsActive() {
  const [active, setActive] = useState(AppState.currentState === 'active');

  useEffect(() => {
    const onChange = (state: AppStateStatus) => {
      setActive(state === 'active');
    };
    const sub = AppState.addEventListener('change', onChange);
    return () => sub.remove();
  }, []);

  return active;
}

export default function ShootScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { data: reference, isLoading } = useReference(id);
  const { granted, request } = useCameraPermissions();
  const [facing, setFacing] = useState<CameraPosition>('back');
  const device = useCameraDevice(facing);
  const isFocused = useIsFocused();
  const appIsActive = useAppIsActive();
  const isActive = isFocused && appIsActive;

  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!reference?.image_path) return;
    let alive = true;
    supabase.storage
      .from('reference-images')
      .createSignedUrl(reference.image_path, 3600)
      .then(({ data }) => {
        if (alive) setThumbnailUrl(data?.signedUrl ?? null);
      });
    return () => {
      alive = false;
    };
  }, [reference?.image_path]);

  const handleCaptured = useCallback(
    (photo: CapturedPhoto) => {
      if (!id) return;
      router.push({
        pathname: '/shoot/review',
        params: {
          uri: encodeURIComponent(photo.uri),
          score: String(photo.score),
          referenceId: id,
          referenceUrl: encodeURIComponent(thumbnailUrl ?? ''),
        },
      });
    },
    [id, router, thumbnailUrl],
  );

  if (isLoading || !reference) {
    return (
      <View style={styles.center}>
        <Stack.Screen options={{ title: 'Shoot', headerShown: false }} />
        <ActivityIndicator color="#fff" />
      </View>
    );
  }

  if (!granted) {
    return (
      <View style={styles.center}>
        <Stack.Screen options={{ title: 'Shoot', headerShown: false }} />
        <Text style={styles.message}>Camera access is needed to match poses.</Text>
        <Button title="Grant access" onPress={request} />
      </View>
    );
  }

  if (!device) {
    return (
      <View style={styles.center}>
        <Stack.Screen options={{ title: 'Shoot', headerShown: false }} />
        <Text style={styles.message}>No {facing} camera found on this device.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'Shoot', headerShown: false }} />
      <CameraView
        device={device}
        isActive={isActive}
        targetKeypoints={reference.keypoints}
        targetBbox={reference.bounding_box}
        targetImageUrl={thumbnailUrl}
        onFlipCamera={() => setFacing((current) => (current === 'back' ? 'front' : 'back'))}
        onCaptured={handleCaptured}
      />
      {thumbnailUrl ? (
        <Image source={{ uri: thumbnailUrl }} style={styles.thumbnail} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#000',
    padding: 24,
    gap: 16,
  },
  message: {
    color: '#fff',
    fontSize: 16,
    textAlign: 'center',
  },
  thumbnail: {
    position: 'absolute',
    top: 56,
    right: 16,
    width: 72,
    height: 72,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#fff',
  },
});
