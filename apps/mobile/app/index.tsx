import { Stack } from 'expo-router';
import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { supabase } from '../src/supabase/client';

export default function HomeScreen() {
  // TEMP (task 5.3 test): verify supabase client — expect [] (RLS blocks anon)
  useEffect(() => {
    supabase
      .from('references')
      .select('id')
      .then(({ data, error }) => {
        console.log('supabase references select:', { data, error });
      });
  }, []);

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'Pose Match' }} />
      <Text style={styles.heading}>Pose Match</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  heading: {
    fontSize: 24,
    fontWeight: '600',
  },
});
