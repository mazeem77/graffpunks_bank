import { useEffect } from 'react';

export function useDidMount(callback) {
  useEffect(() => {
    if (typeof callback === 'function') {
      callback();
    }
  }, [callback]);
}

export default useDidMount;
