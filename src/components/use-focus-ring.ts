import { useState } from 'react';
import { StyleSheet } from 'react-native-unistyles';

type FocusRingOptions = Readonly<{
  // Drawn inside the control, for controls whose container clips them (segmented options).
  isInset?: boolean;
  // With `isInset`, on a control filled with the action color (a selected option): the ring takes the
  // color of its content, the action color would vanish into it.
  isOnAction?: boolean;
}>;

// A ring around the control that has the focus when moving with a TV remote's D-pad (or a
// keyboard), so you can see what OK will press. Spread `focusProps` on the Pressable and add
// `focusStyle` to its styles.
export function useFocusRing({ isInset = false, isOnAction = false }: FocusRingOptions = {}) {
  const [isFocused, setIsFocused] = useState(false);
  const insetRingStyle = isOnAction ? styles.insetRingOnAction : styles.insetRing;
  const ringStyle = isInset ? insetRingStyle : styles.ring;

  return {
    focusProps: {
      onBlur: () => setIsFocused(false),
      onFocus: () => setIsFocused(true),
    },
    focusStyle: isFocused ? ringStyle : undefined,
  };
}

const styles = StyleSheet.create((theme) => {
  const inset = { outlineOffset: -theme.borderWidthFocus, outlineWidth: theme.borderWidthFocus };
  return {
    insetRing: { ...inset, outlineColor: theme.colors.focus, outlineStyle: 'solid' },
    insetRingOnAction: { ...inset, outlineColor: theme.colors.onAction, outlineStyle: 'solid' },
    ring: {
      outlineColor: theme.colors.focus,
      outlineOffset: theme.gap(0.5),
      outlineStyle: 'solid',
      outlineWidth: theme.borderWidthFocus,
    },
  };
});
