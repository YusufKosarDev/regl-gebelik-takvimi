import { useEffect, useState } from 'react';
import { useColorScheme as useRNColorScheme } from 'react-native';

/**
 * To support static rendering, this value needs to be re-calculated on the client side for web
 */
export function useColorScheme() {
  const [hasHydrated, setHasHydrated] = useState(false);

  useEffect(() => {
    // The external system being synchronised here is the hydration itself:
    // "the client has taken over from the server-rendered markup" is a fact
    // this effect running is the only signal of, so it cannot be derived and
    // cannot be read during render without reintroducing the SSR mismatch the
    // hook exists to avoid. It runs once, on mount, and never cascades.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHasHydrated(true);
  }, []);

  const colorScheme = useRNColorScheme();

  if (hasHydrated) {
    return colorScheme;
  }

  return 'light';
}
