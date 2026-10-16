import Constants from 'expo-constants';
import { ScrollView, Text, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import type { IconName } from '@/components/icon';
import type { Messages } from '@/i18n/en';
import { Icon } from '@/components/icon';
import { screenScrollProps } from '@/components/screen-scroll-props';
import { useIconSize } from '@/components/use-icon-size';
import { useMessages } from '@/i18n/i18n-provider';
import { isTv } from '@/lib/device';

type AboutSectionProps = Readonly<{
  icon: IconName;
  paragraphList: readonly string[];
  title: string;
}>;

// The app's version, from app.config.ts (package.json's, bumped by release-please).
const APP_VERSION = Constants.expoConfig?.version;

// How the app handles people's data. The text lives in the dictionaries (`about` in
// src/i18n/en.ts and fr.ts): the one place to update when what the app keeps or sends changes.
export function AboutScreen() {
  const t = useMessages();

  return (
    <ScrollView contentContainerStyle={styles.content} style={styles.screen} {...screenScrollProps}>
      <Text style={styles.intro}>{t.about.intro}</Text>
      {sectionList(t).map((section) => (
        <AboutSection key={section.title} {...section} />
      ))}
      {APP_VERSION === undefined ? undefined : (
        <Text style={styles.version}>{t.about.version(APP_VERSION)}</Text>
      )}
    </ScrollView>
  );
}

function AboutSection({ icon, paragraphList, title }: AboutSectionProps) {
  // Icon colors are props, not styles.
  const { theme } = useUnistyles();
  const iconSize = useIconSize('md');

  return (
    <View style={styles.section}>
      <View style={styles.heading}>
        {/* Decoration: screen readers read the title only. */}
        <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <Icon color={theme.colors.menuAbout} name={icon} size={iconSize} />
        </View>
        <Text accessibilityRole="header" style={styles.title}>
          {title}
        </Text>
      </View>
      {paragraphList.map((paragraph) => (
        <Text key={paragraph} style={styles.paragraph}>
          {paragraph}
        </Text>
      ))}
    </View>
  );
}

function sectionList(t: Messages): AboutSectionProps[] {
  return [
    {
      icon: isTv ? 'television' : 'cellphone',
      paragraphList: t.about.deviceList,
      title: t.about.deviceTitle,
    },
    { icon: 'server', paragraphList: t.about.serverList, title: t.about.serverTitle },
    {
      icon: 'shield-check-outline',
      paragraphList: t.about.othersList,
      title: t.about.othersTitle,
    },
  ];
}

const styles = StyleSheet.create((theme) => ({
  content: {
    // Centered on wide screens (TV).
    alignSelf: 'center',
    gap: theme.gap(6),
    maxWidth: theme.size.maxContent,
    padding: theme.gap(4),
    width: '100%',
  },
  heading: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: theme.gap(2),
  },
  intro: {
    ...theme.typography.body,
    color: theme.colors.text,
  },
  paragraph: {
    ...theme.typography.body,
    color: theme.colors.text,
  },
  screen: {
    backgroundColor: theme.colors.background,
    flex: 1,
  },
  section: {
    gap: theme.gap(2),
  },
  title: {
    ...theme.typography.subtitle,
    color: theme.colors.text,
    flexShrink: 1,
  },
  version: {
    ...theme.typography.caption,
    color: theme.colors.textMuted,
  },
}));
