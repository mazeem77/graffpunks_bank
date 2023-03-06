import { useState, useEffect, createContext, useContext } from 'react';
import { I18n, useTranslate } from 'react-polyglot';
import { getUserLocale, phrases } from 'i18n';
import api from 'lib/utils/api';
import storage from 'lib/utils/storage';

const I18nContext = createContext({});

export function I18nProvider({ children }) {
  const [isReady, setIsReady] = useState(false);
  const [locale, setLocale] = useState(getUserLocale());
  const [messages, setMessages] = useState({});
  const [translations, setTranslations] = useState(null);

  function setLocaleData() {
    const messages = {
      ...phrases[locale],
      ...translations[locale]
    };

    setMessages(messages);
    setIsReady(true);
  }

  function changeLocale(locale) {
    storage.set('storedLocale', locale);
    setLocale(locale);
  }

  async function loadTranslations() {
    const { data } = await api.get('/translations');

    setTranslations(data.common);
  }

  useEffect(() => {
    if (!translations) {
      loadTranslations();
    }
  }, [translations]);

  useEffect(() => {
    if (locale && translations) {
      setLocaleData();
    }
  }, [locale, translations]);

  if (!isReady) {
    return null;
  }

  return (
    <I18nContext.Provider value={{ locale, changeLocale }}>
      <I18n locale={locale} messages={messages}>
        {children}
      </I18n>
    </I18nContext.Provider>
  );
}

export function useTranslations() {
  const t = useTranslate();
  const ctx = useContext(I18nContext);

  if (!ctx) {
    throw Error('The `useTranslations` hook must be called from a descendent of the `I18nProvider`.');
  }

  return {
    t,
    locale: ctx.locale,
    changeLocale: ctx.changeLocale
  };
}
