import { Image } from 'expo-image';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import { Animated, StyleSheet } from 'react-native';
import loadingImage from '@/assets/images/loading-screen.webp';
import { colors } from '@/theme/colors';

// How long the illustration stays fully visible once it's displayed.
export const MIN_DISPLAY_MS = 1500;
export const FADE_OUT_MS = 400;

type LoadingScreenProps = Readonly<{
  // Called once the loading screen has faded out and can be unmounted.
  onFinish: () => void;
}>;

// Full-screen illustration shown over the app at startup. The native splash screen (plate on a
// wood background) is kept until this image is rendered, then this screen fades out.
export function LoadingScreen({ onFinish }: LoadingScreenProps) {
  const [opacity] = useState(() => new Animated.Value(1));
  const [isImageDisplayed, setIsImageDisplayed] = useState(false);

  useEffect(() => {
    if (!isImageDisplayed) {
      return;
    }
    SplashScreen.hide();
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
      accessibilityLabel="Loading Dishes Cook"
      accessibilityRole="progressbar"
      accessible
      style={[styles.container, { opacity }]}
      testID="loading-screen"
    >
      <Image
        accessible={false}
        contentFit="cover"
        onDisplay={() => setIsImageDisplayed(true)}
        source={loadingImage}
        style={styles.image}
        testID="loading-screen-image"
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFill,
    backgroundColor: colors.wood,
    pointerEvents: 'none',
  },
  image: {
    flex: 1,
  },
});
