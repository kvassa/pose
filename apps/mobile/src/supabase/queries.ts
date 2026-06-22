import type { Reference } from '@pose-match/shared-types';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import { supabase } from './client';

export const referencesQueryKey = ['references'] as const;

export function useReferences() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const channel = supabase
      .channel('references-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'references' },
        () => {
          queryClient.invalidateQueries({ queryKey: referencesQueryKey });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  return useQuery({
    queryKey: referencesQueryKey,
    queryFn: async (): Promise<Reference[]> => {
      const { data, error } = await supabase
        .from('references')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as Reference[];
    },
  });
}

export function useReference(id: string) {
  return useQuery({
    queryKey: ['reference', id] as const,
    queryFn: async (): Promise<Reference> => {
      const { data, error } = await supabase
        .from('references')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      return data as Reference;
    },
  });
}
