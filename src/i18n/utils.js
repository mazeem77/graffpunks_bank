import storage from 'lib/utils/storage';

export const supportedLocales = ['ru', 'en'];

export const getUserLocale = () => {
  const defaultLocale = 'en';
  const storedLocale = storage.get('storedLocale');
  const browserLocale = window.navigator.language;
  const browserLocaleSimple = browserLocale && browserLocale.substring(0, 2);
  const browserLocaleFinal =
    browserLocaleSimple && supportedLocales.includes(browserLocaleSimple) ? browserLocaleSimple : false;

  return storedLocale || browserLocaleFinal || defaultLocale;
};
