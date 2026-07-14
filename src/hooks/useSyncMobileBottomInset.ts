import { useLayoutEffect } from "react";

const NAV_SELECTOR = "[data-mobile-bottom-nav]";
const INSET_BUFFER_PX = 20;

/**
 * Publishes `--mobile-bottom-inset` from the measured fixed bottom nav height
 * so scrollable pages clear the bar on all mobile viewports (incl. wrapped labels).
 */
export function useSyncMobileBottomInset() {
  useLayoutEffect(() => {
    const mq = window.matchMedia("(max-width: 640px)");

    const sync = () => {
      const nav = document.querySelector<HTMLElement>(NAV_SELECTOR);
      if (!mq.matches || !nav) {
        document.documentElement.style.removeProperty("--mobile-bottom-inset");
        return false;
      }
      const height = nav.getBoundingClientRect().height;
      if (height < 40) {
        document.documentElement.style.removeProperty("--mobile-bottom-inset");
        return false;
      }
      document.documentElement.style.setProperty(
        "--mobile-bottom-inset",
        `${Math.ceil(height + INSET_BUFFER_PX)}px`,
      );
      return true;
    };

    let raf = 0;
    let attempts = 0;
    const syncUntilReady = () => {
      const ready = sync();
      attempts += 1;
      if (!ready && attempts < 12) {
        raf = requestAnimationFrame(syncUntilReady);
      }
    };
    syncUntilReady();

    const nav = document.querySelector<HTMLElement>(NAV_SELECTOR);
    const ro = nav ? new ResizeObserver(sync) : null;
    nav && ro?.observe(nav);

    mq.addEventListener("change", syncUntilReady);
    window.addEventListener("resize", sync);
    window.addEventListener("orientationchange", syncUntilReady);

    return () => {
      cancelAnimationFrame(raf);
      ro?.disconnect();
      mq.removeEventListener("change", syncUntilReady);
      window.removeEventListener("resize", sync);
      window.removeEventListener("orientationchange", syncUntilReady);
      document.documentElement.style.removeProperty("--mobile-bottom-inset");
    };
  }, []);
}
