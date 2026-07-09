import { useCameraPermission } from 'react-native-vision-camera';

export function useCameraPermissions() {
  const { hasPermission, requestPermission } = useCameraPermission();

  const request = async () => {
    await requestPermission();
  };

  return { granted: hasPermission, request };
}
