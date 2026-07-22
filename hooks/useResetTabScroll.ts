import { useFocusEffect } from 'expo-router';
import { useCallback, type RefObject } from 'react';

type ResettableScroll = {
  scrollTo?: (options: { animated: boolean; y: number }) => void;
  scrollToOffset?: (options: { animated: boolean; offset: number }) => void;
};

/** Resets a tab's root scrolling container whenever that tab regains focus. */
export function useResetTabScroll(
  scrollRef: RefObject<ResettableScroll | null>
) {
  useFocusEffect(
    useCallback(() => {
      if (scrollRef.current?.scrollToOffset) {
        scrollRef.current.scrollToOffset({ animated: false, offset: 0 });
        return;
      }

      scrollRef.current?.scrollTo?.({ animated: false, y: 0 });
    }, [scrollRef])
  );
}
