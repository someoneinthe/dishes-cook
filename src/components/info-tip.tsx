import type { ViewInstance } from 'react-native';
import { useRef, useState } from 'react';
import { Modal, Pressable, Text, useWindowDimensions, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { useMessages } from '@/i18n/i18n-provider';
import { Icon } from './icon';
import { useFocusRing } from './use-focus-ring';
import { useIconSize } from './use-icon-size';

// Where the bubble opens: above its button, in window coordinates.
type Anchor = Readonly<{ bottom: number; left: number; maxWidth: number }>;

type InfoTipProps = Readonly<{
  // What the button opens, for screen readers ("About the meal history").
  label: string;
  // The explanation shown in the bubble.
  message: string;
}>;

// An ⓘ that explains what's next to it in a small bubble, above it. A tap anywhere closes it, Back
// too (a TV's remote, screen readers). A bare icon, not a Button (the maintainer's choice: a
// discreet hint, not an action), still a 48 dp touch target with the TV's focus ring.
export function InfoTip({ label, message }: InfoTipProps) {
  const t = useMessages();
  const { theme } = useUnistyles();
  const iconSize = useIconSize('md');
  const { focusProps, focusStyle } = useFocusRing();
  const { height: windowHeight, width: windowWidth } = useWindowDimensions();
  const [anchor, setAnchor] = useState<Anchor>();
  const buttonRef = useRef<ViewInstance>(null);
  const open = () => {
    buttonRef.current?.measureInWindow((x, y) => {
      const margin = theme.gap(4);
      // From the button's left, kept on screen.
      const left = Math.max(margin, Math.min(x, windowWidth - margin - theme.size.bubbleMaxWidth));
      setAnchor({
        bottom: windowHeight - y + theme.gap(1),
        left,
        maxWidth: Math.min(theme.size.bubbleMaxWidth, windowWidth - left - margin),
      });
    });
  };
  const close = () => setAnchor(undefined);

  return (
    <>
      <Pressable
        accessibilityHint={t.common.infoHint}
        accessibilityLabel={label}
        accessibilityRole="button"
        onPress={open}
        ref={buttonRef}
        // A 48 dp touch target around the small icon (hitSlop can't reach past a short parent),
        // pulled in by its extra width so the icon stays close to its text.
        style={({ pressed }) => [
          styles.target,
          { marginHorizontal: Math.min(0, (iconSize - theme.size.touchTarget) / 2) },
          pressed && styles.pressed,
          focusStyle,
        ]}
        {...focusProps}
      >
        <Icon color={theme.colors.textMuted} name="information-outline" size={iconSize} />
      </Pressable>
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
  pressed: {
    opacity: theme.opacity.pressed,
  },
  target: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: theme.size.touchTarget,
    minWidth: theme.size.touchTarget,
  },
  text: {
    ...theme.typography.body,
    color: theme.colors.text,
  },
}));
