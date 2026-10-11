import { createContext, useContext } from 'react';

/**
 * Whether the thing being rendered is sitting on a sky field.
 *
 * ## Why a context, when `useMotionAllowed` deliberately is not one
 *
 * That one has a single reader and a provider would have been a second thing
 * to wire up for no gain. This one is the opposite: every block of content and
 * every word below the fold needs the answer, they are many levels down, and
 * the alternative is a prop threaded through `Surface`, `ThemedText` and
 * everything that composes them.
 *
 * It also makes the rule true by construction rather than by diligence.
 * Anything inside a field is on the field - a screen cannot forget to say so,
 * and a component added next year inherits it without knowing this file
 * exists.
 *
 * ## What it is deliberately not
 *
 * It does not carry the palette. `useSky()` already answers that from the
 * colour scheme, and a context that carried colours would be a second source
 * for them.
 */
const OnSkyContext = createContext(false);

export const OnSkyProvider = OnSkyContext.Provider;

export function useOnSky(): boolean {
  return useContext(OnSkyContext);
}
