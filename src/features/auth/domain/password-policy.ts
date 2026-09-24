/**
 * The one rule this app has about passwords.
 *
 * Firebase's own minimum is six characters and raising it server-side needs the
 * paid Identity Platform tier, so this is enforced here instead. That means it
 * shapes what somebody chooses and nothing more: a password shorter than this
 * would still be accepted by Firebase if a request reached it from anywhere
 * other than this screen. It is a nudge at the point of choosing, not a
 * defence.
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
