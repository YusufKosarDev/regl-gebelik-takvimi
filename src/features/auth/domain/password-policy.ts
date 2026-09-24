/**
 * The one rule this app has about passwords.
 *
 * The server enforces it. The project's password policy is set to a minimum of
 * eight with `enforcementState: ENFORCE`, so Firebase itself refuses anything
 * shorter, whatever sends the request. This check is not what makes the rule
 * real.
 *
 * What it is for is the answer arriving at the keyboard. Without it the person
 * waits for a round trip and gets `auth/weak-password` back, which this app then
 * has to translate. With it they get a Turkish sentence immediately and the
 * request is never sent. The number lives here once and the message, the hint
 * and the mapped error are all built from it, so the two layers cannot come to
 * disagree about what it is.
 *
 * To confirm the server's side again later, without creating anything:
 *
 *     curl "https://identitytoolkit.googleapis.com/v2/passwordPolicy?key=$API_KEY"
 *
 * It applies to choosing a password and never to typing one that already
 * exists. Accounts made before the policy have shorter passwords, and their
 * owners still have to get in; the project leaves `forceUpgradeOnSignin` unset,
 * so Firebase does not block them either.
 *
 * Length only. No rule about capitals, digits or symbols: they push people
 * towards `Sifre1!` and away from something long, and the length is what makes
 * a password hard to guess.
 */

/** The shortest password somebody may choose. */
export const MINIMUM_PASSWORD_LENGTH = 8;

/**
 * Whether a password somebody is choosing is long enough.
 *
 * Counted in code units rather than graphemes. A password is compared byte for
 * byte by whatever stores it, so what matters here is that the same string
 * measures the same way every time, not that an emoji counts as one.
 */
export function isPasswordLongEnough(password: string): boolean {
  return password.length >= MINIMUM_PASSWORD_LENGTH;
}
