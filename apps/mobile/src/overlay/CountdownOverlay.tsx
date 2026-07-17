import { StyleSheet, Text, View } from 'react-native';

type CountdownOverlayProps = {
  value: number | null;
};

/** Big 3-2-1 number in the middle of the shoot screen. */
export function CountdownOverlay({ value }: CountdownOverlayProps) {
  if (value == null) return null;

  return (
    <View style={styles.wrap} pointerEvents="none">
      <Text style={styles.number}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 40,
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  number: {
    color: '#fff',
    fontSize: 120,
    fontWeight: '800',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 12,
  },
});
