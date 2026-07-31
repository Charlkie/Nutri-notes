const MAX_PORTRAIT_SAFE_BOTTOM = 34;
const MAX_STANDALONE_VIEWPORT_GAP = 140;

export function clampSafeBottom(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(MAX_PORTRAIT_SAFE_BOTTOM, Math.max(0, value));
}

export function standaloneViewportBottomGap(
  screenHeight: number,
  viewportHeight: number,
  viewportOffsetTop: number,
  standalone: boolean,
): number {
  if (!standalone || ![screenHeight, viewportHeight, viewportOffsetTop].every(Number.isFinite)) return 0;
  return Math.min(
    MAX_STANDALONE_VIEWPORT_GAP,
    Math.max(0, screenHeight - viewportHeight - viewportOffsetTop),
  );
}

function measureSafeBottom(): number {
  const probe = document.createElement("div");
  probe.setAttribute("aria-hidden", "true");
  probe.style.cssText = [
    "position:fixed",
    "visibility:hidden",
    "pointer-events:none",
    "inset:auto 0 0",
    "padding-bottom:env(safe-area-inset-bottom, 0px)",
  ].join(";");
  document.body.append(probe);
  const measured = Number.parseFloat(getComputedStyle(probe).paddingBottom);
  probe.remove();
  return clampSafeBottom(measured);
}

function measureStandaloneViewportBottomGap(): number {
  const navigatorWithStandalone = navigator as Navigator & { standalone?: boolean };
  const standalone = matchMedia("(display-mode: standalone)").matches || navigatorWithStandalone.standalone === true;
  const viewport = window.visualViewport;
  return standaloneViewportBottomGap(
    window.screen.height,
    viewport?.height ?? window.innerHeight,
    viewport?.offsetTop ?? 0,
    standalone,
  );
}

export function installSafeAreaMeasurement(): () => void {
  const root = document.documentElement;
  let frame = 0;
  const update = () => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      const inset = measureSafeBottom();
      const viewportBottomGap = measureStandaloneViewportBottomGap();
      root.style.setProperty("--safe-bottom", `${inset}px`);
      root.style.setProperty("--viewport-bottom-gap", `${viewportBottomGap}px`);
      root.dataset.safeBottom = String(inset);
      root.dataset.viewportBottomGap = String(viewportBottomGap);
    });
  };

  // Measure synchronously for the first rendered frame, then re-check after
  // standalone Safari has settled its visual viewport and status bars.
  const initialInset = measureSafeBottom();
  const initialViewportBottomGap = measureStandaloneViewportBottomGap();
  root.style.setProperty("--safe-bottom", `${initialInset}px`);
  root.style.setProperty("--viewport-bottom-gap", `${initialViewportBottomGap}px`);
  root.dataset.safeBottom = String(initialInset);
  root.dataset.viewportBottomGap = String(initialViewportBottomGap);

  const timers = [window.setTimeout(update, 250), window.setTimeout(update, 1_000)];
  window.addEventListener("pageshow", update);
  window.addEventListener("orientationchange", update);
  window.visualViewport?.addEventListener("resize", update);

  return () => {
    cancelAnimationFrame(frame);
    timers.forEach(window.clearTimeout);
    window.removeEventListener("pageshow", update);
    window.removeEventListener("orientationchange", update);
    window.visualViewport?.removeEventListener("resize", update);
  };
}
