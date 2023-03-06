import React from 'react';
import { useTranslations } from 'i18n';
import './Loader.scss';

const Loader = () => {
  const { t } = useTranslations();

  return <div className="loader">{t('label.loading')}</div>;
};

export default Loader;
