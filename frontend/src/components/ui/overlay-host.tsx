/**
 * Where the app-wide overlays (confirm dialogs, toasts) render while a `Sheet` is open.
 *
 * A sheet is a `Modal`, i.e. its own native layer above the app:
 * - iOS presents a Modal from the view controller of the view that hosts it. A dialog hosted at the
 *   app root would be presented by the root view controller, which is already presenting the sheet,
 *   so UIKit refuses and React Native never retries: the dialog never appears and its `confirm()`
 *   never settles (blocking every later dialog).
 * - Android shows every Modal in its own window, so a toast drawn in the app window would sit under
 *   the sheet's backdrop, dimmed and out of reach (the web stacks Modal portals the same way).
 *
 * Every open sheet registers here, and the overlays render inside the top-most one (see
 * `OverlayOutlet` in sheet.tsx), or at the app root when no sheet is open.
 */
import { createContext, useCallback, useContext, useEffect, useId, useState, type ReactNode } from 'react';

interface OverlayHostRegistry {
  /** The top-most open host, `null` when the overlays belong at the app root. */
  top: string | null;
  register: (id: string) => () => void;
}

// Without a provider (isolated component tests) the overlays always render at the root.
const noHosts: OverlayHostRegistry = { top: null, register: () => () => undefined };

const OverlayHostContext = createContext<OverlayHostRegistry>(noHosts);

/** Tracks the open sheets. Mount once, outside the dialog and toast providers. */
export function OverlayHostProvider({ children }: { children: ReactNode }) {
  const [hosts, setHosts] = useState<readonly string[]>([]);

  const register = useCallback((id: string) => {
    setHosts((current) => [...current.filter((host) => host !== id), id]);
    return () => setHosts((current) => current.filter((host) => host !== id));
  }, []);

  return (
    <OverlayHostContext.Provider value={{ top: hosts[hosts.length - 1] ?? null, register }}>{children}</OverlayHostContext.Provider>
  );
}

/** Registers the caller (an open sheet) as an overlay host while `active`; `true` when it is the top-most one. */
export function useOverlayHost(active: boolean): boolean {
  const id = useId();
  const { top, register } = useContext(OverlayHostContext);
  useEffect(() => (active ? register(id) : undefined), [active, id, register]);
  return active && top === id;
}

/** `true` when no sheet is open, i.e. the providers render their overlays at the app root. */
export function useOverlaysAtRoot(): boolean {
  return useContext(OverlayHostContext).top === null;
}
