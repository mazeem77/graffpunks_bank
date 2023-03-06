import { useState, useEffect, createContext, useContext } from 'react';
import { useLoggedUser } from '../hooks';
import { wax } from '../lib/wax';
import api from '../lib/utils/api';

const AppStateContext = createContext({});

export function AppStateProvider({ children }) {
  const [isReady, setIsReady] = useState(false);
  const [waxUser, setWaxUser] = useState(null);
  const { loggedUser, login, logout } = useLoggedUser();

  useEffect(() => {
    async function autoLoginWax() {
      if (!loggedUser) {
        return setIsReady(true);
      }

      const isAutoLoginAvailable = await wax.isAutoLoginAvailable();
      const data = await api.post('/integrations/wax', { telegramUser: loggedUser });

      if (isAutoLoginAvailable && data.waxWallet) {
        await wax.login();

        setWaxUser(wax.user);
        setIsReady(true);
      } else {
        setIsReady(true);
      }
    }

    autoLoginWax();
  }, [wax]);

  const connectWax = async () => {
    try {
      await wax.login();
      await api.post('/integrations/connect-wax', { telegramUser: loggedUser, waxUser: wax.user });

      setWaxUser(wax.user);
    } catch (err) {
      console.error(err);
    }
  };

  const disconnectWax = async () => {
    await api.post('/integrations/disconnect-wax', { telegramUser: loggedUser });

    delete wax.userAccount;
    setWaxUser(null);
  };

  if (!isReady) {
    return null;
  }

  const waxTransaction = async quantity => {
    const result = await wax.api.transact(
      {
        actions: [
          {
            account: 'kingsofgraff',
            name: 'transfer',
            authorization: [
              {
                actor: wax.userAccount,
                permission: 'active'
              }
            ],
            data: {
              from: wax.userAccount,
              to: process.env.REACT_APP_TOKENS_WALLET,
              quantity: `${quantity}.0000 LFGK`,
              memo: `userId:${loggedUser.id}`
            }
          }
        ]
      },
      {
        blocksBehind: 3,
        expireSeconds: 30
      }
    );

    console.log(result);

    await api.post('/integrations/wax-transaction', {
      telegramUser: loggedUser,
      transactionId: result.transaction_id
    });

    return result;
  };

  return (
    <AppStateContext.Provider value={{ loggedUser, login, logout, waxUser, connectWax, disconnectWax, waxTransaction }}>
      {children}
    </AppStateContext.Provider>
  );
}

export function useAppState() {
  const ctx = useContext(AppStateContext);

  if (!ctx) {
    throw Error('The `useAppState` hook must be called from a descendent of the `AppStateProvider`.');
  }

  return {
    loggedUser: ctx.loggedUser,
    login: ctx.login,
    logout: ctx.logout,
    waxUser: ctx.waxUser,
    connectWax: ctx.connectWax,
    disconnectWax: ctx.disconnectWax,
    waxTransaction: ctx.waxTransaction
  };
}

export default AppStateProvider;
