import { Image } from 'expo-image';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import { Animated } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import loadingImage from '@/assets/images/loading-screen.webp';

// How long the illustration stays fully visible once it's displayed.
export const MIN_DISPLAY_MS = 1500;
export const FADE_OUT_MS = 400;

type LoadingScreenProps = Readonly<{
  // Called once the loading screen has faded out and can be unmounted.
  onFinish: () => void;
}>;

// Full-screen illustration shown over the app at startup: it replaces the native splash screen (the
// plate) as soon as it's laid out, stays MIN_DISPLAY_MS once the image is displayed, then fades out.
export function LoadingScreen({ onFinish }: LoadingScreenProps) {
  const [opacity] = useState(() => new Animated.Value(1));
  const [isImageDisplayed, setIsImageDisplayed] = useState(false);

  useEffect(() => {
    if (!isImageDisplayed) {
      return;
    }
    const timeout = setTimeout(() => {
      Animated.timing(opacity, {
        duration: FADE_OUT_MS,
        toValue: 0,
        useNativeDriver: true,
      }).start(() => onFinish());
    }, MIN_DISPLAY_MS);
    return () => clearTimeout(timeout);
  }, [isImageDisplayed, onFinish, opacity]);

  return (
    <Animated.View
      accessibilityHint="The app opens automatically once it has loaded"
      accessibilityLabel="Loading Dishes Cook"
      accessibilityRole="progressbar"
      accessible
      // Hide the native splash as soon as this screen is laid out, not when the image is
      // displayed: while the splash is kept, Android blocks the first draw, so the image would
      // never load (deadlock).
      onLayout={() => SplashScreen.hide()}
      style={[styles.container, { opacity }]}
      testID="loading-screen"
    >
      <Image
        accessible={false}
        contentFit="cover"
        onDisplay={() => setIsImageDisplayed(true)}
        // Never get stuck on the loading screen if the illustration fails to load.
        onError={() => setIsImageDisplayed(true)}
        source={loadingImage}
        style={styles.image}
        testID="loading-screen-image"
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    pointerEvents: 'none',
  },
  image: {
    flex: 1,
  },
});
