import { useCallback, useEffect, useRef } from "react";
import { useFetcher, useLocation } from "react-router";

/**
 * Delegated hover/focus prefetching for a group of href-bearing elements
 * (s-link, s-button, ...). Shopify's Polaris web components don't expose
 * typed onPointerEnter/onFocus props of their own (confirmed via
 * validate_component_codeblocks), so the handlers this returns must be
 * spread onto a plain wrapping element — a `<div style={{ display:
 * "contents" }}>` around the group keeps it invisible to layout. The handler
 * walks up from the real event target (shadow-DOM events retarget to the
 * component host, so `event.target` is the <s-link>/<s-button> itself) to
 * find its href and warms that route's data.
 *
 * Shopify's App Bridge intercepts these clicks and hands off to React
 * Router's own navigate() (see @shopify/shopify-app-react-router's
 * AppProvider, which listens for "shopify:navigate" and calls
 * useNavigate(href)) — so this fetcher.load() populates the same route data
 * cache that click-triggered navigation reads from. The session token
 * exchange and DB query for the target route happen during the hover/focus
 * instead of starting cold on click.
 */
export function usePrefetchOnHover() {
  const fetcher = useFetcher();
  const location = useLocation();
  const firedRef = useRef(new Set<string>());

  const prefetch = useCallback(
    (event: { target: EventTarget | null }) => {
      const target = event.target as HTMLElement | null;
      const href = target?.closest?.("[href]")?.getAttribute("href");
      if (!href || !href.startsWith("/")) return;
      if (href === location.pathname || firedRef.current.has(href)) return;
      firedRef.current.add(href);
      fetcher.load(href);
    },
    [fetcher, location.pathname],
  );

  return { onPointerOver: prefetch, onFocus: prefetch };
}

/**
 * Eagerly warms one route's loader data as soon as this component mounts —
 * call once per route you want preloaded up front (e.g. the app shell's
 * persistent nav tabs), rather than waiting for a hover/focus signal. Each
 * call owns its own fetcher so several eagerly-preloaded routes load in
 * parallel instead of one fetcher's single in-flight slot replacing the
 * others. This is still bound by the same session-token exchange + DB query
 * every loader does — it starts that work immediately instead of on click,
 * it doesn't skip it.
 */
export function useEagerPreload(href: string) {
  const fetcher = useFetcher();
  const location = useLocation();
  const firedRef = useRef(false);

  useEffect(() => {
    if (firedRef.current || href === location.pathname) return;
    firedRef.current = true;
    fetcher.load(href);
    // Fire once per href; fetcher/location identity churn on re-render
    // shouldn't retrigger an already-fired preload.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [href]);
}
