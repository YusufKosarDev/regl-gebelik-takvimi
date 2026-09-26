import { Stack } from 'expo-router';

/**
 * The lock's own group.
 *
 * A group rather than a modal over the app: a modal is something the screen
 * behind it is still mounted under, and the whole point is that nothing behind
 * it is drawn, mounted or captured into the task switcher.
 */
export default function LockLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
