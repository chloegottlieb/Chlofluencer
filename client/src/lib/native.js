import { Capacitor } from '@capacitor/core';

export const isNative = () => Capacitor.isNativePlatform();

/** Android hardware back button: go back in the app, or exit from the home screen. */
export async function registerBackButton(navigate) {
  if (!isNative()) return () => {};
  const { App } = await import('@capacitor/app');
  const handle = await App.addListener('backButton', ({ canGoBack }) => {
    if (canGoBack && window.location.pathname !== '/') navigate(-1);
    else App.exitApp();
  });
  return () => handle.remove();
}
