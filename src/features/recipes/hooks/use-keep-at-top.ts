import type { RefObject } from 'react';
import type {
  ScrollViewInstance,
  TextInputInstance,
  TextInstance,
  ViewInstance,
} from 'react-native';
import { useEffect, useRef } from 'react';
import { Keyboard } from 'react-native';

// Keeping the recipe form's focused field near the top of the page (recipe-form-screen.tsx).

// Space kept above a field brought into view, so its label shows too.
const SCROLL_MARGIN = 48;

// Scrolls the page so the element sits near its top.
export function scrollToTop(
  element: TextInputInstance | TextInstance,
  scrollView: null | ScrollViewInstance,
  content: null | ViewInstance,
) {
  if (scrollView && content) {
    element.measureLayout(content, (_x, y) => {
      scrollView.scrollTo({ y: Math.max(0, y - SCROLL_MARGIN) });
    });
  }
}

// Keeps a focused field near the top of the page: the field's own content (an ingredient search's
// suggestions) shows under it, above the keyboard. Scrolled again once the keyboard is open: the
// page, shorter, can then scroll further.
export function useKeepAtTop(
  scrollViewRef: RefObject<null | ScrollViewInstance>,
  contentRef: RefObject<ViewInstance>,
) {
  const fieldRef = useRef<null | TextInputInstance>(null);
  useEffect(() => {
    const subscription = Keyboard.addListener('keyboardDidShow', () => {
      const field = fieldRef.current;
      if (field?.isFocused()) {
        scrollToTop(field, scrollViewRef.current, contentRef.current);
      }
    });
    return () => subscription.remove();
  }, [contentRef, scrollViewRef]);
  return (field: TextInputInstance) => {
    fieldRef.current = field;
    scrollToTop(field, scrollViewRef.current, contentRef.current);
  };
}
