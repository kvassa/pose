import { Pressable, StyleSheet, View } from 'react-native';

type ShutterButtonProps = {
  onPress: () => void;
  disabled?: boolean;
};

/** Big white shutter circle at the bottom center. */
export function ShutterButton({ onPress, disabled }: ShutterButtonProps) {
  return (
    <View style={styles.wrap} pointerEvents="box-none">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Take photo"
        disabled={disabled}
        onPress={onPress}
        style={({ pressed }) => [
          styles.outer,
          pressed && styles.pressed,
          disabled && styles.disabled,
        ]}
      >
        <View style={styles.inner} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    bottom: 36,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 35,
  },
  outer: {
    width: 78,
    height: 78,
    borderRadius: 39,
    borderWidth: 4,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  inner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#fff',
  },
  pressed: {
    opacity: 0.75,
  },
  disabled: {
    opacity: 0.4,
  },
});
