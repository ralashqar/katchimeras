// React Native Modal owns a separate native window on iOS. If a full-screen
// route is pushed in the same event that removes a Modal, that window can remain
// above the returning screen and intercept every touch. Give it one short exit
// window before navigating to another full-screen surface.
export const NATIVE_MODAL_DISMISS_DELAY_MS = 240;

export function runAfterNativeModalDismiss(action: () => void): ReturnType<typeof setTimeout> {
  return setTimeout(action, NATIVE_MODAL_DISMISS_DELAY_MS);
}
