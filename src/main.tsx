import ReactDOM from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import App from "./App";
import { installSafeAreaMeasurement } from "./viewport";
import "./styles.css";
import "./milestone.css";
import "./calendar.css";
import "./body.css";
import "./weightEditor.css";
import "./charts.css";
import "./weightAnalytics.css";
import "./settings.css";
import "./preferences.css";
import "./hardening.css";
import "./recipes.css";
import "./recipeImport.css";
import "./importFood.css";
import "./foodImport.css";
import "./foodDelete.css";
import "./restaurantFoods.css";
import "./foodImportActions.css";
import "./energy.css";
import "./energyInput.css";
import "./recipeList.css";
import "./recipeIngredientPicker.css";
import "./swipeNavigation.css";
import "./auxiliaryNavigation.css";
import "./schedules.css";
import "./accessibility.css";
import "./dropbox.css";
import "./viewportFix.css";

installSafeAreaMeasurement();
let controllerReloading = false;
navigator.serviceWorker?.addEventListener("controllerchange", () => {
  if (controllerReloading) return;
  controllerReloading = true;
  location.reload();
});
let applyServiceWorkerUpdate: ((reloadPage?: boolean) => Promise<void>) | undefined;
applyServiceWorkerUpdate = registerSW({
  immediate: true,
  onNeedRefresh() {
    void applyServiceWorkerUpdate?.(true);
  },
  onRegisteredSW(_url, registration) {
    void registration?.update();
    addEventListener("pageshow", () => void registration?.update());
  },
});
ReactDOM.createRoot(document.getElementById("root")!).render(<App />);
