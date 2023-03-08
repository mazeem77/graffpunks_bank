import React from 'react';
import TelegramLoginButton from 'react-telegram-login';
import { Link } from 'react-router-dom';
import { Button, TelegramUser } from 'components';
import { useAppState } from 'components/AppStateProvider';
import styles from './Wallet.module.scss';

function Wallet() {
  const { loggedUser, login, logout, waxUser, connectWax, disconnectWax } = useAppState();

  if (waxUser && loggedUser) {
    return (
      <div className={styles.message}>
        <div>
          <strong>{waxUser.account}</strong> is connected to the <TelegramUser loggedUser={loggedUser} />
        </div>

        <Link to="/bank">
          <Button className={styles.walletButton}>Bank</Button>
        </Link>

        <Button className={styles.walletButton} onClick={() => disconnectWax()}>
          Disconnect Wallet
        </Button>
      </div>
    );
  }

  if (!loggedUser) {
    return (
      <div className={styles.container}>
        <div className={styles.message}>Please, login with your Telegram account first</div>
        <TelegramLoginButton dataOnauth={login} botName={process.env.REACT_APP_BOT_NAME} />
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <img src={process.env.PUBLIC_URL + '/images/wax.svg'} alt="wax-logo" />
      <div className={styles.message}>
        <p>WAX wallet will be connected to the:</p>
        <TelegramUser loggedUser={loggedUser} logout={logout} />
      </div>

      <Button className={styles.walletButton} onClick={connectWax}>
        Connect WAX Wallet
      </Button>
    </div>
  );
}

export default Wallet;
