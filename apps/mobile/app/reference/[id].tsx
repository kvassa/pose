import { Link, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  type LayoutChangeEvent,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { supabase } from '../../src/supabase/client';
import { useReference } from '../../src/supabase/queries';

export default function ReferenceDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: reference, isLoading } = useReference(id);

  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [aspectRatio, setAspectRatio] = useState(0.75);
  const [boxWidth, setBoxWidth] = useState(0);

  const imagePath = reference?.image_path;

  useEffect(() => {
    if (!imagePath) return;
    let active = true;
    supabase.storage
      .from('reference-images')
      .createSignedUrl(imagePath, 3600)
      .then(({ data }) => {
        if (!active || !data?.signedUrl) return;
        setSignedUrl(data.signedUrl);
        Image.getSize(data.signedUrl, (w, h) => {
          if (active && h > 0) setAspectRatio(w / h);
        });
      });
    return () => {
      active = false;
    };
  }, [imagePath]);

  if (isLoading || !reference) {
    return (
      <View style={styles.center}>
        <Stack.Screen options={{ title: 'Reference' }} />
        <ActivityIndicator />
      </View>
    );
  }

  if (reference.status !== 'ready') {
    return (
      <View style={styles.center}>
        <Stack.Screen options={{ title: 'Reference' }} />
        <ActivityIndicator />
        <Text style={styles.status}>{reference.status}</Text>
      </View>
    );
  }

  const boxHeight = boxWidth / aspectRatio;
  const keypoints = reference.keypoints ?? [];

  const onLayout = (e: LayoutChangeEvent) => setBoxWidth(e.nativeEvent.layout.width);

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'Reference' }} />
      <View style={styles.imageWrap} onLayout={onLayout}>
        {signedUrl ? (
          <Image
            source={{ uri: signedUrl }}
            style={{ width: boxWidth, height: boxHeight }}
          />
        ) : null}
        {boxWidth > 0
          ? keypoints.map((point, index) => (
              <View
                key={index}
                style={[
                  styles.dot,
                  { left: point.x * boxWidth - 4, top: point.y * boxHeight - 4 },
                ]}
              />
            ))
          : null}
      </View>
      <Link href={`/shoot/${reference.id}`} asChild>
        <Pressable style={styles.shootButton}>
          <Text style={styles.shootButtonText}>Open camera</Text>
        </Pressable>
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    gap: 8,
  },
  imageWrap: {
    width: '100%',
    position: 'relative',
  },
  dot: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#22c55e',
  },
  status: {
    color: '#666',
  },
  shootButton: {
    margin: 16,
    backgroundColor: '#111',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  shootButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
