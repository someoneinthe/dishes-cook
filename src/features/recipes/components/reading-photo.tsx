import { ActivityIndicator, Modal, Text, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { useMessages } from '@/i18n/i18n-provider';

// While a photo's text is recognized (a few seconds): a spinner and a message over the screen, read
// by screen readers. Back can't stop the reading, so it waits too.
export function ReadingPhoto({ isReading }: Readonly<{ isReading: boolean }>) {
  const t = useMessages();
  // The spinner's color is a prop, not a style.
  const { theme } = useUnistyles();

  return (
    <Modal animationType="fade" onRequestClose={ignoreBack} transparent visible={isReading}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <ActivityIndicator color={theme.colors.actionPrimary} size="large" />
          <Text accessibilityLiveRegion="polite" style={styles.message}>
            {t.recipeScan.reading}
          </Text>
        </View>
      </View>
    </Modal>
  );
}

function ignoreBack() {
  // The reading ends on its own.
}

const styles = StyleSheet.create((theme) => ({
  backdrop: {
    alignItems: 'center',
    backgroundColor: theme.colors.overlay,
    flex: 1,
    justifyContent: 'center',
    padding: theme.gap(6),
  },
  card: {
    alignItems: 'center',
    backgroundColor: theme.colors.background,
    borderRadius: theme.radius.lg,
    gap: theme.gap(4),
    padding: theme.gap(6),
  },
  message: {
    ...theme.typography.body,
    color: theme.colors.text,
    textAlign: 'center',
  },
}));
