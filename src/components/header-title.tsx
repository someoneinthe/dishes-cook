import type { ColorValue } from 'react-native';
import { Alert, Text, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { useMessages } from '@/i18n/i18n-provider';
import { isTv } from '@/lib/device';
import type { IconName } from './icon';
import { Icon } from './icon';
import { useIconSize } from './use-icon-size';

type HeaderTitleProps = Readonly<{
  children: string;
  // The screen's menu icon, in its menu color.
  icon?: Readonly<{ color: string; name: IconName }>;
  tintColor?: ColorValue;
}>;

// A screen title on one line: cut with "…" when the header buttons need the room. Screen readers
// read it in full; a long press shows it in full.
export function HeaderTitle({ children, icon, tintColor }: HeaderTitleProps) {
  const iconSize = useIconSize('lg');
  const t = useMessages();

  return (
    <View style={styles.row}>
      {icon && (
        // Decoration: screen readers read the title only.
        <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <Icon color={icon.color} name={icon.name} size={iconSize} />
        </View>
      )}
      <Text
        accessibilityRole="header"
        numberOfLines={1}
        // Not on a TV: it would make the title a stop for the remote's focus, for a title that fits.
        onLongPress={isTv ? undefined : () => showFullTitle(children, t.common.ok)}
        style={[styles.title, tintColor === undefined ? undefined : { color: tintColor }]}
      >
        {children}
      </Text>
    </View>
  );
}

// `headerTitle` option: the title after the screen's menu icon. Built here, outside the screens,
// so screens don't define a component while rendering (Sonar S6478).
export function headerTitleWithIcon(name: IconName, color: string) {
  return function HeaderTitleWithIcon(props: Omit<HeaderTitleProps, 'icon'>) {
    return <HeaderTitle {...props} icon={{ color, name }} />;
  };
}

// Header options for every navigator: the title gives way to the buttons (`headerRight`) instead
// of the buttons being drawn over it.
export const headerTitleOptions = {
  headerRightContainerStyle: { flexBasis: 'auto', flexGrow: 0 },
  headerTitle: HeaderTitle,
  headerTitleContainerStyle: { flex: 1 },
} as const;

// A dialog, not a toast: Android cuts toasts to two lines. The title is the dialog's message, which
// scrolls when it's very long.
function showFullTitle(title: string, okLabel: string) {
  Alert.alert('', title, [{ text: okLabel }]);
}

const styles = StyleSheet.create((theme) => ({
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: theme.gap(3),
  },
  title: {
    ...theme.typography.headerTitle,
    color: theme.colors.text,
    flexShrink: 1,
  },
}));
