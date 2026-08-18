import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";
import { migrateLocalStorageToVault } from "@/features/vault/migrate";
import { registerPwa } from "@/pwa";

void registerPwa();

function renderApp() {
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}

// Import legacy localStorage data into the Dexie vault once before the first
// render, so the live queries start from migrated data. Render regardless of
// outcome — a failed migration logs and leaves the app usable on an empty vault.
void migrateLocalStorageToVault().finally(renderApp);
