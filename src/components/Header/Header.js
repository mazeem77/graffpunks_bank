import React, { useState } from 'react';
import { useTranslations } from 'i18n';
import { Link } from 'react-router-dom';
import { Button } from 'components';
import './Header.scss';

function Header () {
  const { t, changeLocale } = useTranslations();
  const [gkShow, changeGkShow] = useState(false);

  return (
    <header className='header'>
      <nav className='header__menu'>
        <div className='header__menu-item'>
          <Link to='/'>
            <Button icon='💰'>{t('menu.label.bank')}</Button>
          </Link>
        </div>
        <div className='header__menu-item'>
          <a href={`https://graffpunks.world/`} target='_blank' rel='noreferrer'>
            <Button icon=''>{t('menu.label.gk')}</Button>
          </a>
        </div>
        {gkShow === true ? (
          <div className='header__menu-item header__menu-item--lang'>
            <Button
              icon='🇬🇧'
              className='button-lang'
              onClick={() => {
                changeLocale('en');
                changeGkShow(false);
              }}
            />
          </div>
        ) : (
          <div className='header__menu-item header__menu-item--lang'>
            <Button
              icon='🇷🇺'
              className='button-lang'
              onClick={() => {
                changeLocale('ru');
                changeGkShow(true);
              }}
            />
          </div>
        )}
      </nav>
    </header>
  );
}

export default Header;
