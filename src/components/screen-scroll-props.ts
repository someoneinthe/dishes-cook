import { isTv } from '@/lib/device';

// Room kept around the control a TV remote focuses, in dp: Android scrolls it into view leaving the
// scroll view's fading edge free, so the label above a field and the help text under it stay on
// screen. The fade also shows that there's more to scroll.
const TV_FADING_EDGE = 64;

// Props of a screen's scroll view (ScrollView, FlatList). Nothing changes on a phone.
export const screenScrollProps = { fadingEdgeLength: isTv ? TV_FADING_EDGE : 0 } as const;
