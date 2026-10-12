import { Stack } from 'expo-router';
import { Text, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

export function HomeScreen() {
  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'Dishes Cook' }} />
      <Text style={styles.title}>What should we eat today?</Text>
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  container: {
    alignItems: 'center',
    backgroundColor: theme.colors.background,
    flex: 1,
    justifyContent: 'center',
    padding: theme.gap(4),
  },
  title: {
    ...theme.typography.title,
    color: theme.colors.text,
  },
}));
