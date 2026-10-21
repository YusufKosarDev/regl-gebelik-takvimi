import type { SQLiteDatabase } from 'expo-sqlite';

import type { AvatarConfig } from '../../domain/avatar-config';
import { chooseAvatar } from '../choose-avatar';

import {
  resetLocalDbWriteLockForTests,
  withLocalDbWriteLock,
} from '@/storage/local-db-write-lock';

/**
 * Saving an avatar waits its turn.
 *
 * The use case is one repository call, so the only thing worth asserting about
 * it is the thing it exists for: the turn. The avatar screen used to call the
 * repository straight, which left this write as the one in the app with nowhere
 * for `withLocalDbWriteLock` to be taken — and a lone statement issued while
 * another writer's transaction is open on this app's single connection is
 * swallowed into it.
 *
 * So the test holds the lock and checks the repository has not been reached.
 * Delete the acquisition in `choose-avatar.ts` and this goes red.
 */

jest.mock('../../data/avatar-repository', () => ({
  saveAvatarConfig: jest.fn(),
}));

const repository = jest.requireMock('../../data/avatar-repository');
const saveAvatarConfig = repository.saveAvatarConfig as jest.Mock;

const db = {} as SQLiteDatabase;

const CONFIG: AvatarConfig = {
  skinToneId: 'skin-tone-3',
  hairStyleId: 'wavy',
  hairColorId: 'dark-brown',
  outfitId: 'shirt',
};

/** Several turns, so "not yet" means the queue rather than a race. */
async function settle(): Promise<void> {
  for (let turn = 0; turn < 8; turn += 1) {
    await Promise.resolve();
  }
}

beforeEach(() => {
  resetLocalDbWriteLockForTests();
  saveAvatarConfig.mockReset();
  saveAvatarConfig.mockResolvedValue(undefined);
});

describe('choosing an avatar', () => {
  it('writes it', async () => {
    await chooseAvatar(db, CONFIG);

    expect(saveAvatarConfig).toHaveBeenCalledWith(db, CONFIG);
  });

  it('waits for a write already in flight', async () => {
    let release!: () => void;
    const held = withLocalDbWriteLock(
      () =>
        new Promise<void>((resolve) => {
          release = resolve;
        })
    );

    const saving = chooseAvatar(db, CONFIG);

    await settle();

    expect(saveAvatarConfig).not.toHaveBeenCalled();

    release();
    await held;
    await saving;

    expect(saveAvatarConfig).toHaveBeenCalledWith(db, CONFIG);
  });

  it('passes a failure back rather than swallowing it', async () => {
    saveAvatarConfig.mockRejectedValue(new Error('the database said no'));

    await expect(chooseAvatar(db, CONFIG)).rejects.toThrow('the database said no');

    // And the queue is open again, which is what the screen's retry depends on.
    saveAvatarConfig.mockResolvedValue(undefined);

    await expect(chooseAvatar(db, CONFIG)).resolves.toBeUndefined();
  });
});
