import { useState } from 'react';
import useDidMount from './useDidMount';
import storage from 'lib/utils/storage';

export function usePersistedState(storageKey, defaultState) {
  const persistedState = storage.get(storageKey);
  const initialState = persistedState || defaultState;
  const [state, setState] = useState(initialState);

  useDidMount(() => {
    if (!persistedState) {
      storage.set(storageKey, initialState);
    }
  });

  const onStateChange = newState => {
    storage.set(storageKey, newState);
    setState(newState);
  };

  return [state, onStateChange];
}
