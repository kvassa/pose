import type { Session, User } from '@supabase/supabase-js';
import { create } from 'zustand';

type AuthState = {
  user: User | null;
  session: Session | null;
  setSession: (session: Session | null) => void;
};

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  session: null,
  setSession: (session) => set({ session, user: session?.user ?? null }),
}));
