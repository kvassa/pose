import type { Reference } from '@pose-match/shared-types';
import { Link } from 'expo-router';
import { useEffect, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { supabase } from '../supabase/client';

export function ReferenceListItem({ reference }: { reference: Reference }) {
  const [signedUrl, setSignedUrl] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    supabase.storage
      .from('reference-images')
      .createSignedUrl(reference.image_path, 3600)
      .then(({ data }) => {
        if (active) setSignedUrl(data?.signedUrl ?? null);
      });
    return () => {
      active = false;
    };
  }, [reference.image_path]);

  return (
    <Link href={`/reference/${reference.id}`} asChild>
      <Pressable style={styles.row}>
        {signedUrl ? (
          <Image source={{ uri: signedUrl }} style={styles.thumb} />
        ) : (
          <View style={[styles.thumb, styles.placeholder]} />
        )}
        <Text style={styles.status}>{reference.status}</Text>
      </Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
  },
  thumb: {
    width: 56,
    height: 56,
    borderRadius: 8,
    backgroundColor: '#eee',
  },
  placeholder: {
    backgroundColor: '#ddd',
  },
  status: {
    fontSize: 16,
  },
});
