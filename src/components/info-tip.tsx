import type { View as ViewType } from 'react-native';
import { useRef, useState } from 'react';
import { Modal, Pressable, Text, useWindowDimensions, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { Button } from './button';

// Where the bubble opens: above its button, in window coordinates.
type Anchor = Readonly<{ bottom: number; left: number; maxWidth: number }>;

type InfoTipProps = Readonly<{
  // What the button opens, for screen readers ("About the meal history").
  label: string;
  // The explanation shown in the bubble.
  message: string;
}>;

// The widest the bubble gets, in dp: a few short lines.
const MAX_BUBBLE_WIDTH = 320;

// An ⓘ button that explains what's next to it in a small bubble, above it. A tap anywhere closes it,
// Back too (a TV's remote, screen readers).
export function InfoTip({ label, message }: InfoTipProps) {
  const { theme } = useUnistyles();
  const { height: windowHeight, width: windowWidth } = useWindowDimensions();
  const [anchor, setAnchor] = useState<Anchor>();
  const buttonRef = useRef<ViewType>(null);
  const open = () => {
    buttonRef.current?.measureInWindow((x, y) => {
      const margin = theme.gap(4);
      // From the button's left, kept on screen.
      const left = Math.max(margin, Math.min(x, windowWidth - margin - MAX_BUBBLE_WIDTH));
      setAnchor({
        bottom: windowHeight - y + theme.gap(1),
        left,
        maxWidth: Math.min(MAX_BUBBLE_WIDTH, windowWidth - left - margin),
      });
    });
  };
  const close = () => setAnchor(undefined);

  return (
    <>
      <Button
        icon="information-outline"
        isIconOnly
        label={label}
        onPress={open}
        ref={buttonRef}
        variant="secondary"
      />
      {anchor && (
        <Modal animationType="fade" onRequestClose={close} statusBarTranslucent transparent visible>
          {/* A tap anywhere closes it, on the bubble too; screen readers use Back instead. */}
          <Pressable
            accessible={false}
            importantForAccessibility="no"
            onPress={close}
            style={styles.backdrop}
            testID="info-tip-backdrop"
          />
          <View accessibilityViewIsModal pointerEvents="none" style={[styles.bubble, anchor]}>
            <Text accessibilityLiveRegion="polite" style={styles.text}>
              {message}
            </Text>
          </View>
        </Modal>
      )}
    </>
  );
}

const styles = StyleSheet.create((theme) => ({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  bubble: {
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    borderWidth: theme.borderWidth,
    boxShadow: [
      {
        blurRadius: theme.gap(2),
        color: theme.colors.overlay,
        offsetX: 0,
        offsetY: theme.gap(0.5),
      },
    ],
    padding: theme.gap(3),
    position: 'absolute',
  },
  text: {
    ...theme.typography.body,
    color: theme.colors.text,
  },
}));
