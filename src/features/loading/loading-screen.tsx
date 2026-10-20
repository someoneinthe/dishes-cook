import { Image } from 'expo-image';
import { hide as hideSplashScreen } from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import { Animated } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { useMessages } from '@/i18n/i18n-provider';
import { loadingScreenImage } from '@/lib/assets';

// The app icon's background (app.config.ts: adaptiveIcon and splash), over the whole screen.
export const ICON_BACKGROUND = '#C0CBCF';

// How long the icon stays fully visible once it's displayed.
export const MIN_DISPLAY_MS = 1500;
export const FADE_OUT_MS = 400;

type LoadingScreenProps = Readonly<{
  // Called once the loading screen has faded out and can be unmounted.
  onFinish: () => void;
}>;

// The app's icon (its plate and cutlery) on its background, over the whole screen at startup: it
// replaces the native splash screen (the same plate, on the same background) as soon as it's laid
// out, stays MIN_DISPLAY_MS once the image is displayed, then fades out.
export function LoadingScreen({ onFinish }: LoadingScreenProps) {
  const t = useMessages();
  const [opacity] = useState(() => new Animated.Value(1));
  const [isImageDisplayed, setIsImageDisplayed] = useState(false);

  useEffect(() => {
    // The fade-out is only scheduled once the icon is displayed.
    const timeout = isImageDisplayed
      ? setTimeout(() => {
          Animated.timing(opacity, {
            duration: FADE_OUT_MS,
            toValue: 0,
            useNativeDriver: true,
          }).start(() => onFinish());
        }, MIN_DISPLAY_MS)
      : undefined;
    return () => clearTimeout(timeout);
  }, [isImageDisplayed, onFinish, opacity]);

  return (
    <Animated.View
      accessibilityHint={t.loading.hint}
      accessibilityLabel={t.loading.label}
      accessibilityRole="progressbar"
      accessible
      // Hide the native splash as soon as this screen is laid out, not when the image is
      // displayed: while the splash is kept, Android blocks the first draw, so the image would
      // never load (deadlock).
      onLayout={() => hideSplashScreen()}
      style={[styles.container, { opacity }]}
      testID="loading-screen"
    >
      <Image
        accessible={false}
        contentFit="contain"
        onDisplay={() => setIsImageDisplayed(true)}
        // Never get stuck on the loading screen if the icon fails to load.
        onError={() => setIsImageDisplayed(true)}
        source={loadingScreenImage}
        style={styles.image}
        testID="loading-screen-image"
      />
    </Animated.View>
  );
}

// Width / height of assets/images/loading-icon.webp (the plate and cutlery, without margins).
const ICON_ASPECT_RATIO = 609 / 543;

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    backgroundColor: ICON_BACKGROUND,
    justifyContent: 'center',
    pointerEvents: 'none',
  },
  // Most of a phone's width; on a TV, a size that fits its height.
  image: {
    aspectRatio: ICON_ASPECT_RATIO,
    maxWidth: 480,
    width: '70%',
  },
});
