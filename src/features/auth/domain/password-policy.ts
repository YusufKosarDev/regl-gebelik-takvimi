/**
 * The one rule this app has about passwords.
 *
 * Firebase's own default minimum is six. The project has a policy set to eight,
 * but its `enforcementState` reads `OFF`, so the server accepts six today and
 * this check is the only thing standing in the way. It shapes what somebody
 * chooses on this screen and stops nothing anywhere else.
 *
 * If that enforcement is ever switched on, this stays useful: it fails at the
 * keyboard with a sentence in Turkish instead of after a round trip with a
 * code. To check which it is, without creating anything, read the project's
 * live policy:
 *
 *     curl "https://identitytoolkit.googleapis.com/v2/passwordPolicy?key=$API_KEY"
 *
 * It therefore applies to choosing a password and never to typing one that
 * already exists. Accounts made before this rule have passwords shorter than
 * eight characters, and those people have to be able to sign in.
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
