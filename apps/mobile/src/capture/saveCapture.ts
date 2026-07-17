import * as Crypto from 'expo-crypto';
import * as MediaLibrary from 'expo-media-library';

import { useAuthStore } from '../state/authStore';
import { supabase } from '../supabase/client';

export function toFileUri(path: string): string {
  return path.startsWith('file://') ? path : `file://${path}`;
}

/** Ask iOS/Android for permission to add photos to the camera roll. */
export async function ensureMediaLibraryPermission(): Promise<boolean> {
  const current = await MediaLibrary.getPermissionsAsync();
  if (current.granted) return true;
  const next = await MediaLibrary.requestPermissionsAsync();
  return next.granted;
}

/** Save a local photo file into the device Photos / Gallery app. */
export async function saveCaptureToLibrary(uri: string): Promise<void> {
  const ok = await ensureMediaLibraryPermission();
  if (!ok) {
    throw new Error('Photo library permission was denied');
  }
  await MediaLibrary.saveToLibraryAsync(toFileUri(uri));
}

export type CloudCaptureResult = {
  id: string;
  imagePath: string;
};

/**
 * Upload the photo to Supabase Storage and insert a captures row.
 * Returns null if the user is not signed in.
 */
export async function syncCaptureToCloud(options: {
  uri: string;
  referenceId: string;
  matchScore: number;
}): Promise<CloudCaptureResult | null> {
  const userId = useAuthStore.getState().user?.id;
  if (!userId) {
    console.log('cloud capture skipped: not signed in');
    return null;
  }

  const fileUri = toFileUri(options.uri);
  const arrayBuffer = await fetch(fileUri).then((r) => r.arrayBuffer());
  const imagePath = `${userId}/${Crypto.randomUUID()}.jpg`;

  const { error: uploadError } = await supabase.storage
    .from('captures')
    .upload(imagePath, arrayBuffer, { contentType: 'image/jpeg' });

  if (uploadError) {
    throw new Error(`capture upload failed: ${uploadError.message}`);
  }

  const { data, error: insertError } = await supabase
    .from('captures')
    .insert({
      user_id: userId,
      reference_id: options.referenceId,
      match_score: Math.round(options.matchScore),
      image_path: imagePath,
    })
    .select('id, image_path')
    .single();

  if (insertError) {
    await supabase.storage.from('captures').remove([imagePath]);
    throw new Error(`capture row insert failed: ${insertError.message}`);
  }

  return { id: data.id as string, imagePath: data.image_path as string };
}

/** Undo a cloud save (used when the user taps Retake). */
export async function deleteCloudCapture(capture: CloudCaptureResult): Promise<void> {
  await supabase.storage.from('captures').remove([capture.imagePath]);
  await supabase.from('captures').delete().eq('id', capture.id);
}
