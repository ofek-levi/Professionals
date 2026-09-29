/**
 * Scroll lock: lets a descendant that handles its own drags (the map) hold the enclosing
 * ScrollView still while a finger is on it.
 *
 * iOS needs it: a pan that starts inside a WebView also drives an ancestor UIScrollView, whatever
 * the page does with the touch. (Android WebViews keep their parent from intercepting through
 * `nestedScrollEnabled`, and the web iframe captures its own touches.) `Screen` and `Sheet` provide
 * a lock for their ScrollView; another ScrollView around a map can do the same:
 *
 *   const scrollLock = useScrollLockHost();
 *   <ScrollView scrollEnabled={!scrollLock.locked}>
 *     <ScrollLockProvider value={scrollLock.lock}>{children}</ScrollLockProvider>
 *   </ScrollView>
 */
import { createContext, useContext, useMemo, useRef, useState } from 'react';

export interface ScrollLock {
  /** Holds (or releases) the scroll for `owner`; it stays locked while any owner holds it. */
  set: (owner: object, locked: boolean) => void;
}

const ScrollLockContext = createContext<ScrollLock | null>(null);

export const ScrollLockProvider = ScrollLockContext.Provider;

/** For ScrollView owners: whether to disable scrolling, and the lock to provide to the content. */
export function useScrollLockHost(): { locked: boolean; lock: ScrollLock } {
  const parent = useContext(ScrollLockContext);
  const [locked, setLocked] = useState(false);
  const owners = useRef(new Set<object>());
  const lock = useMemo<ScrollLock>(
    () => ({
      set: (owner, value) => {
        if (value) owners.current.add(owner);
        else owners.current.delete(owner);
        setLocked(owners.current.size > 0);
        // Nested scroll views (a sheet's content inside a screen) all hold still.
        parent?.set(owner, value);
      },
    }),
    [parent],
  );
  return { locked, lock };
}

/** The lock of the nearest enclosing ScrollView that provides one (`null` outside of any). */
export function useScrollLock(): ScrollLock | null {
  return useContext(ScrollLockContext);
}
