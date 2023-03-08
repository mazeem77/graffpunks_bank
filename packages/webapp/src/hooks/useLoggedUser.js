import { usePersistedState } from './usePersistedState';

export function useLoggedUser() {
  const [loggedUser, setLoggedUser] = usePersistedState('loggedUser', null);

  const login = user => {
    setLoggedUser(user);
  };

  const logout = () => {
    setLoggedUser(null);
  };

  return {
    loggedUser,
    login,
    logout
  };
}
