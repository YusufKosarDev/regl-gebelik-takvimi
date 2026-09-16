/**
 * Which route group the app belongs in once state has loaded.
 *
 * Kept as a pure function so the rule can be tested without a navigator, and so
 * it lives in exactly one place instead of being repeated per screen.
 *
 * The decision depends on onboarding only. `mode` selects what the app screens
 * show, not which group is mounted.
 */

export type AppRouteGroup = '(onboarding)' | '(app)';

export function resolveRouteGroup(onboardingCompleted: boolean): AppRouteGroup {
  return onboardingCompleted ? '(app)' : '(onboarding)';
}
