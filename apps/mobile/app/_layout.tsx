import { Stack } from 'expo-router';
import { useEffect } from 'react';

import { useAuthStore } from '../src/state/authStore';
import { supabase } from '../src/supabase/client';

export default function RootLayout() {
  const setSession = useAuthStore((state) => state.setSession);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });
    return () => data.subscription.unsubscribe();
  }, [setSession]);

  return <Stack />;
}
