import * as Crypto from 'expo-crypto';
import * as ImagePicker from 'expo-image-picker';
import { Stack } from 'expo-router';
import { Button, FlatList, StyleSheet, Text, View } from 'react-native';

import { ReferenceListItem } from '../src/components/ReferenceListItem';
import { useAuthStore } from '../src/state/authStore';
import { supabase } from '../src/supabase/client';
import { useReferences } from '../src/supabase/queries';

export default function HomeScreen() {
  const { data: references } = useReferences();

  const handleAddReference = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
    });

    if (result.canceled) return;

    const userId = useAuthStore.getState().user?.id;
    if (!userId) {
      console.log('cannot upload: not signed in');
      return;
    }

    const { uri } = result.assets[0];
    // arrayBuffer is reliable in React Native; Blob bodies can upload as 0 bytes
    const arrayBuffer = await fetch(uri).then((r) => r.arrayBuffer());
    const path = `${userId}/${Crypto.randomUUID()}.jpg`;

    const { error: uploadError } = await supabase.storage
      .from('reference-images')
      .upload(path, arrayBuffer, { contentType: 'image/jpeg' });

    if (uploadError) {
      console.log('reference upload failed:', uploadError.message);
      return;
    }
    console.log('reference uploaded:', path);

    const { data: row, error: insertError } = await supabase
      .from('references')
      .insert({ user_id: userId, image_path: path })
      .select()
      .single();

    if (insertError) {
      console.log('reference row insert failed:', insertError.message);
      return;
    }
    console.log('reference row inserted:', row);
  };

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'Pose Match' }} />
      <Text style={styles.heading}>Pose Match</Text>
      <Button title="Add reference" onPress={handleAddReference} />
      <FlatList
        style={styles.list}
        data={references ?? []}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <ReferenceListItem reference={item} />}
        ListEmptyComponent={<Text style={styles.empty}>No references yet.</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 16,
    gap: 12,
  },
  heading: {
    fontSize: 24,
    fontWeight: '600',
  },
  list: {
    flex: 1,
  },
  empty: {
    color: '#666',
  },
});
