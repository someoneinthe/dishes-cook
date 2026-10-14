import { ActivityIndicator } from 'react-native';
import { withUnistyles } from 'react-native-unistyles';
import { useMessages } from '@/i18n/i18n-provider';

const ThemedActivityIndicator = withUnistyles(ActivityIndicator, (theme) => ({
  color: theme.colors.actionPrimary,
}));

type PagedList = Readonly<{
  fetchNextPage: () => void;
  fetchPreviousPage: () => void;
  isFetchingNextPage: boolean;
}>;

// FlatList props for a list from usePagedQuery: load the next page near the bottom, reload the
// dropped earlier pages near the top, and keep the visible rows still while pages come and go.
export function getPagingProps(pagedList: PagedList) {
  return {
    ListFooterComponent: pagedList.isFetchingNextPage ? <LoadingMore /> : null,
    // At the very top, stay there: a row added at the top of the list (e.g. a new ingredient
    // sorted first) must show up, not be kept just above the screen.
    maintainVisibleContentPosition: { autoscrollToTopThreshold: 10, minIndexForVisible: 0 },
    onEndReached: pagedList.fetchNextPage,
    onEndReachedThreshold: 0.5,
    onStartReached: pagedList.fetchPreviousPage,
    onStartReachedThreshold: 0.5,
  };
}

function LoadingMore() {
  const t = useMessages();
  return (
    <ThemedActivityIndicator
      accessibilityHint={t.common.loadingMoreHint}
      accessibilityLabel={t.common.loadingMore}
    />
  );
}
