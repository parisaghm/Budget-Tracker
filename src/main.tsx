import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { registerSW } from "virtual:pwa-register";

// Register the service worker but do NOT auto-reload the page when a new
// version is found. The new SW will install in the background and take effect
// the next time the app is fully relaunched, which prevents the page from
// refreshing every time the user returns to the tab.
registerSW({
  onNeedRefresh() {
    /* no-op: silent update */
  },
  onOfflineReady() {
    /* no-op */
  },
});

createRoot(document.getElementById("root")!).render(<App />);
