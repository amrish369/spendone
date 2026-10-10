function isAppServiceWorker(registration: ServiceWorkerRegistration) {
  return [registration.active, registration.waiting, registration.installing].some((worker) =>
    worker?.scriptURL.endsWith("/sw.js"),
  );
}

export async function registerOfflineApp() {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
  const host = window.location.hostname;
  const shouldSkip =
    !import.meta.env.PROD ||
    window.top !== window.self ||
    host.startsWith("id-preview--") ||
    host.startsWith("preview--") ||
    host === "lovableproject.com" ||
    host.endsWith(".lovableproject.com") ||
    host === "lovableproject-dev.com" ||
    host.endsWith(".lovableproject-dev.com") ||
    host === "beta.lovable.dev" ||
    host.endsWith(".beta.lovable.dev") ||
    new URLSearchParams(window.location.search).get("sw") === "off";

  if (shouldSkip) {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(
      registrations.filter(isAppServiceWorker).map((registration) => registration.unregister()),
    );
    return;
  }

  const { registerSW } = await import("virtual:pwa-register");
  registerSW({ immediate: true });
}