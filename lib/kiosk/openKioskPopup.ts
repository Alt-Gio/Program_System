/**
 * Opens the /attendance/kiosk page as a dedicated popup window (not a tab).
 *
 * The popup is designed to be dragged onto a TV or second monitor and then
 * made fullscreen with F11 — turning any browser-capable machine into a
 * kiosk display. A fixed `dict-kiosk` window name means clicking the button
 * again simply re-focuses the existing window instead of opening a second
 * one. If the browser blocks popups we fall back to a new tab.
 */
export function openKioskPopup(): void {
  if (typeof window === "undefined") return;

  const width  = 1024;
  const height = 768;
  const left   = Math.round((window.screen.width  - width)  / 2);
  const top    = Math.round((window.screen.height - height) / 2);

  const features = [
    `width=${width}`,
    `height=${height}`,
    `left=${left}`,
    `top=${top}`,
    "resizable=yes",
    "scrollbars=no",
    "toolbar=no",
    "menubar=no",
    "location=no",
    "status=no",
  ].join(",");

  const popup = window.open("/attendance/kiosk", "dict-kiosk", features);

  if (!popup || popup.closed || typeof popup.closed === "undefined") {
    // Popup blocked — fall back to a regular new tab.
    window.open("/attendance/kiosk", "_blank");
    return;
  }

  popup.focus();
}
