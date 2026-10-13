import type { NativeStackHeaderProps } from 'expo-router';
import type { HeaderBackButtonProps } from 'expo-router/react-navigation';
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
      headerLeft={options.headerLeft ?? (back ? backButton(navigation.goBack) : undefined)}
      headerTitle={options.headerTitle ?? headerTitleOptions.headerTitle}
      title={getHeaderTitle(options, route.name)}
    />
  );
}

// `headerLeft` going back, read "Go back": its default label is the previous screen's title, which
// is the route group's name ("(drawer)") from a menu screen. Built outside the header, so it doesn't
// define a component while rendering (Sonar S6478).
function backButton(goBack: () => void) {
  return function BackButton(props: HeaderBackButtonProps) {
    return <HeaderBackButton {...props} label={undefined} onPress={goBack} />;
  };
}
