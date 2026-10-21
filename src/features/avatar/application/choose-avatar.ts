import type { SQLiteDatabase } from 'expo-sqlite';

import { saveAvatarConfig } from '../data/avatar-repository';
import type { AvatarConfig } from '../domain/avatar-config';

import { withLocalDbWriteLock } from '@/storage/local-db-write-lock';

/**
 * Saving the avatar somebody built.
 *
 * A use case for what is one repository call, and the reason is the queue
 * rather than the logic. Every path that writes this app's database takes
 * `withLocalDbWriteLock` exactly once, at the highest layer whose work is
 * nothing but local database work — and a repository cannot take it, because it
 * cannot know whether its caller already holds it. The avatar screen used to
 * call the repository directly, which left it as the one write in the app with
 * nowhere for that turn to be taken.
 *
 * So this is the layer that was missing, not a wrapper added for symmetry. It
 * is also where the next thing about saving an avatar belongs, instead of in a
 * screen.
 *
 * The widget copy is deliberately **not** here. It is a read plus a native
 * write, it must not hold the queue, and it must not fail the save — the screen
 * does it afterwards, best effort, and says so.
 */
export function chooseAvatar(db: SQLiteDatabase, config: AvatarConfig): Promise<void> {
  return withLocalDbWriteLock(() => saveAvatarConfig(db, config));
}
