import type { ColorValue } from 'react-native';
import { Platform, Text, ToastAndroid, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import type { IconName } from './icon';
import { Icon } from './icon';
import { useIconSize } from './use-icon-size';

type HeaderTitleProps = Readonly<{
  children: string;
  // The screen's menu icon, in its menu color.
  icon?: Readonly<{ color: ColorValue; name: IconName }>;
  tintColor?: ColorValue;
}>;

// A screen title on one line: cut with "…" when the header buttons need the room. Screen readers
// read it in full; a long press shows it in full.
export function HeaderTitle({ children, icon, tintColor }: HeaderTitleProps) {
  const iconSize = useIconSize('lg');

  return (
    <View style={styles.row}>
      {icon && <Icon color={icon.color} name={icon.name} size={iconSize} />}
      <Text
        accessibilityRole="header"
        numberOfLines={1}
        onLongPress={() => showFullTitle(children)}
        style={[styles.title, tintColor === undefined ? undefined : { color: tintColor }]}
      >
        {children}
      </Text>
    </View>
  );
}

// `headerTitle` option: the title after the screen's menu icon. Built here, outside the screens,
// so screens don't define a component while rendering (Sonar S6478).
export function headerTitleWithIcon(name: IconName, color: ColorValue) {
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

function showFullTitle(title: string) {
  // Android's equivalent of a tooltip. iOS will need its own.
  if (Platform.OS === 'android') {
    ToastAndroid.show(title, ToastAndroid.SHORT);
  }
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
