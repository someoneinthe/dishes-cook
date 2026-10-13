import type { NativeStackHeaderProps } from 'expo-router';
import { getHeaderTitle, Header, HeaderBackButton } from 'expo-router/react-navigation';
import { headerTitleOptions } from './header-title';

// `header` option of the stack: the same header as the menu's screens, instead of Android's native
// toolbar, which draws the buttons over a long title instead of cutting it.
export function StackHeader({
  back,
  navigation,
  options,
  route,
}: Readonly<NativeStackHeaderProps>) {
  return (
    <Header
      {...options}
      {...headerTitleOptions}
      back={back}
      headerLeft={
        options.headerLeft ??
        (back ? (props) => <HeaderBackButton {...props} onPress={navigation.goBack} /> : undefined)
      }
      headerTitle={options.headerTitle ?? headerTitleOptions.headerTitle}
      title={getHeaderTitle(options, route.name)}
    />
  );
}
