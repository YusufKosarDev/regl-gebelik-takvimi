import type { SQLiteDatabase } from 'expo-sqlite';

import type { AvatarConfig } from '../../domain/avatar-config';
import { loadAvatarConfig, saveAvatarConfig } from '../avatar-repository';

type DatabaseSpy = {
  readonly db: SQLiteDatabase;
  readonly runAsync: jest.Mock;
  readonly getFirstAsync: jest.Mock;
  readonly getAllAsync: jest.Mock;
  readonly execAsync: jest.Mock;
  readonly withTransactionAsync: jest.Mock;
};

function createDatabaseSpy(row: unknown = null, runError?: Error): DatabaseSpy {
  const runAsync = runError
    ? jest.fn().mockRejectedValue(runError)
    : jest.fn().mockResolvedValue({ changes: 1, lastInsertRowId: 1 });
  const getFirstAsync = jest.fn().mockResolvedValue(row);
  const getAllAsync = jest.fn().mockResolvedValue([]);
  const execAsync = jest.fn().mockResolvedValue(undefined);
  const withTransactionAsync = jest.fn(async (task: () => Promise<void>) => {
    await task();
  });

  const db = {
    runAsync,
    getFirstAsync,
    getAllAsync,
    execAsync,
    withTransactionAsync,
  } as unknown as SQLiteDatabase;

  return { db, runAsync, getFirstAsync, getAllAsync, execAsync, withTransactionAsync };
}

/** Collapses whitespace so assertions do not depend on SQL formatting. */
function normalize(sql: unknown): string {
  return String(sql).replace(/\s+/g, ' ').trim();
}

function config(overrides: Partial<AvatarConfig> = {}): AvatarConfig {
  return {
    skinToneId: 'skin-tone-3',
    hairStyleId: 'wavy',
    hairColorId: 'dark-brown',
    outfitId: 'shirt',
    ...overrides,
  };
}

function row(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    skin_tone_id: 'skin-tone-3',
    hair_style_id: 'wavy',
    hair_color_id: 'dark-brown',
    outfit_id: 'shirt',
    accessory_id: null,
    ...overrides,
  };
}

describe('saveAvatarConfig writing an avatar', () => {
  it('writes one statement', async () => {
    const spy = createDatabaseSpy();

    await saveAvatarConfig(spy.db, config());

    expect(spy.runAsync).toHaveBeenCalledTimes(1);
  });

  it('upserts the pinned row', async () => {
    const spy = createDatabaseSpy();

    await saveAvatarConfig(spy.db, config());
    const [sql, ...params] = spy.runAsync.mock.calls[0];

    expect(normalize(sql)).toMatch(/^INSERT INTO avatar_config/i);
    expect(normalize(sql)).toMatch(/ON CONFLICT\(id\) DO UPDATE SET/i);
    expect(params[0]).toBe(1);
  });

  it('binds every id rather than interpolating it', async () => {
    const spy = createDatabaseSpy();

    await saveAvatarConfig(spy.db, config({ accessoryId: 'glasses' }));
    const [sql, ...params] = spy.runAsync.mock.calls[0];

    expect(String(sql)).not.toMatch(/skin-tone-3|wavy|dark-brown|shirt|glasses/);
    expect(params).toEqual([1, 'skin-tone-3', 'wavy', 'dark-brown', 'shirt', 'glasses']);
  });

  it('binds an absent accessory as NULL', async () => {
    const spy = createDatabaseSpy();

    await saveAvatarConfig(spy.db, config());

    expect(spy.runAsync.mock.calls[0][6]).toBeNull();
  });

  it('binds an explicitly undefined accessory as NULL too', async () => {
    const spy = createDatabaseSpy();

    await saveAvatarConfig(spy.db, config({ accessoryId: undefined }));

    expect(spy.runAsync.mock.calls[0][6]).toBeNull();
  });

  it('writes an id the catalogue does not have', async () => {
    // The repository stores choices; whether an id is still offered is the
    // catalogue's business.
    const spy = createDatabaseSpy();

    await saveAvatarConfig(spy.db, config({ hairStyleId: 'mohawk' }));

    expect(spy.runAsync.mock.calls[0][3]).toBe('mohawk');
  });

  it('touches nothing else', async () => {
    const spy = createDatabaseSpy();

    await saveAvatarConfig(spy.db, config());
    const sql = normalize(spy.runAsync.mock.calls[0][0]);

    expect(sql).not.toMatch(/cycle_settings|period_records|pregnancy_profile/i);
    expect(spy.execAsync).not.toHaveBeenCalled();
    expect(spy.getFirstAsync).not.toHaveBeenCalled();
  });

  it('rejects with the underlying error', async () => {
    const spy = createDatabaseSpy(null, new Error('disk is full'));

    await expect(saveAvatarConfig(spy.db, config())).rejects.toThrow('disk is full');
  });
});

describe('saveAvatarConfig refusing an avatar the domain would', () => {
  it.each(['skinToneId', 'hairStyleId', 'hairColorId', 'outfitId'] as const)(
    'refuses a blank %s',
    async (field) => {
      const spy = createDatabaseSpy();

      await expect(saveAvatarConfig(spy.db, config({ [field]: '  ' }))).rejects.toThrow(
        new RegExp(`blank ${field}`)
      );
    }
  );

  it('refuses a blank accessoryId', async () => {
    const spy = createDatabaseSpy();

    await expect(saveAvatarConfig(spy.db, config({ accessoryId: '' }))).rejects.toThrow(
      /blank accessoryId/
    );
  });

  it('writes nothing when it refuses', async () => {
    const spy = createDatabaseSpy();

    await expect(saveAvatarConfig(spy.db, config({ outfitId: '' }))).rejects.toThrow();

    expect(spy.runAsync).not.toHaveBeenCalled();
  });
});

describe('loadAvatarConfig reading an avatar', () => {
  it('returns null when no row is stored', async () => {
    const spy = createDatabaseSpy(null);

    await expect(loadAvatarConfig(spy.db)).resolves.toBeNull();
  });

  it('returns null for an undefined row', async () => {
    const spy = createDatabaseSpy(undefined);

    await expect(loadAvatarConfig(spy.db)).resolves.toBeNull();
  });

  it('reads the pinned row', async () => {
    const spy = createDatabaseSpy(row());

    await loadAvatarConfig(spy.db);
    const [sql, ...params] = spy.getFirstAsync.mock.calls[0];

    expect(normalize(sql)).toMatch(/^SELECT .* FROM avatar_config WHERE id = \?$/i);
    expect(params).toEqual([1]);
  });

  it('maps every column onto its field', async () => {
    const spy = createDatabaseSpy(row({ accessory_id: 'earrings' }));

    await expect(loadAvatarConfig(spy.db)).resolves.toEqual({
      skinToneId: 'skin-tone-3',
      hairStyleId: 'wavy',
      hairColorId: 'dark-brown',
      outfitId: 'shirt',
      accessoryId: 'earrings',
    });
  });

  it('reads a NULL accessory as no accessory at all', async () => {
    const spy = createDatabaseSpy(row({ accessory_id: null }));

    const loaded = await loadAvatarConfig(spy.db);

    expect(loaded?.accessoryId).toBeUndefined();
    expect(loaded !== null && 'accessoryId' in loaded).toBe(false);
  });

  it('reads an id the catalogue no longer has', async () => {
    const spy = createDatabaseSpy(row({ hair_style_id: 'mohawk' }));

    await expect(loadAvatarConfig(spy.db)).resolves.toMatchObject({ hairStyleId: 'mohawk' });
  });

  it('writes nothing while reading', async () => {
    const spy = createDatabaseSpy(row());

    await loadAvatarConfig(spy.db);

    expect(spy.runAsync).not.toHaveBeenCalled();
    expect(spy.execAsync).not.toHaveBeenCalled();
  });
});

describe('loadAvatarConfig with a corrupt row', () => {
  it.each([
    ['skin_tone_id', 'skin_tone_id'],
    ['hair_style_id', 'hair_style_id'],
    ['hair_color_id', 'hair_color_id'],
    ['outfit_id', 'outfit_id'],
  ])('refuses a numeric %s', async (column) => {
    const spy = createDatabaseSpy(row({ [column]: 7 }));

    await expect(loadAvatarConfig(spy.db)).rejects.toThrow(
      new RegExp(`non-text ${column}`)
    );
  });

  it.each(['skin_tone_id', 'hair_style_id', 'hair_color_id', 'outfit_id'])(
    'refuses a NULL %s',
    async (column) => {
      const spy = createDatabaseSpy(row({ [column]: null }));

      await expect(loadAvatarConfig(spy.db)).rejects.toThrow(
        new RegExp(`non-text ${column}`)
      );
    }
  );

  it.each(['skin_tone_id', 'hair_style_id', 'hair_color_id', 'outfit_id'])(
    'refuses a blank %s',
    async (column) => {
      const spy = createDatabaseSpy(row({ [column]: '   ' }));

      await expect(loadAvatarConfig(spy.db)).rejects.toThrow(/blank/);
    }
  );

  it('refuses a numeric accessory_id rather than reading it as none', async () => {
    const spy = createDatabaseSpy(row({ accessory_id: 7 }));

    await expect(loadAvatarConfig(spy.db)).rejects.toThrow(/non-text accessory_id/);
  });

  it('refuses a blank accessory_id, which NULL is the way to say', async () => {
    const spy = createDatabaseSpy(row({ accessory_id: '' }));

    await expect(loadAvatarConfig(spy.db)).rejects.toThrow(/blank accessoryId/);
  });

  it('repairs nothing', async () => {
    const spy = createDatabaseSpy(row({ outfit_id: null }));

    await expect(loadAvatarConfig(spy.db)).rejects.toThrow();

    expect(spy.runAsync).not.toHaveBeenCalled();
    expect(spy.execAsync).not.toHaveBeenCalled();
  });
});

describe('an avatar round trip', () => {
  /** Saves through the spy, then reads back the row it bound. */
  async function roundTrip(avatar: AvatarConfig): Promise<AvatarConfig | null> {
    const writer = createDatabaseSpy();

    await saveAvatarConfig(writer.db, avatar);
    const [, , skin, hair, color, outfit, accessory] = writer.runAsync.mock.calls[0];

    const reader = createDatabaseSpy({
      skin_tone_id: skin,
      hair_style_id: hair,
      hair_color_id: color,
      outfit_id: outfit,
      accessory_id: accessory,
    });

    return loadAvatarConfig(reader.db);
  }

  it('gives back an avatar with an accessory unchanged', async () => {
    const avatar = config({ accessoryId: 'hair-clip' });

    await expect(roundTrip(avatar)).resolves.toEqual(avatar);
  });

  it('gives back an avatar without one unchanged', async () => {
    const avatar = config();

    await expect(roundTrip(avatar)).resolves.toEqual(avatar);
  });

  it('keeps "no accessory" absent rather than explicit', async () => {
    const loaded = await roundTrip(config());

    expect(loaded !== null && 'accessoryId' in loaded).toBe(false);
  });

  it('keeps an id the catalogue does not have', async () => {
    const avatar = config({ skinToneId: 'skin-tone-99', accessoryId: 'monocle' });

    await expect(roundTrip(avatar)).resolves.toEqual(avatar);
  });

  it('keeps the surrounding whitespace it was given', async () => {
    const avatar = config({ outfitId: ' shirt ' });

    await expect(roundTrip(avatar)).resolves.toEqual(avatar);
  });
});

describe('avatar repository purity', () => {
  it('does not mutate the config it saves', async () => {
    const spy = createDatabaseSpy();
    const avatar = config({ accessoryId: 'glasses' });
    const before = JSON.stringify(avatar);

    await saveAvatarConfig(spy.db, avatar);

    expect(JSON.stringify(avatar)).toBe(before);
  });

  it('does not give the config it saves an accessory key', async () => {
    const spy = createDatabaseSpy();
    const avatar = config();

    await saveAvatarConfig(spy.db, avatar);

    expect('accessoryId' in avatar).toBe(false);
  });

  it('does not mutate the row it read', async () => {
    const stored = row({ accessory_id: 'glasses' });
    const before = JSON.stringify(stored);
    const spy = createDatabaseSpy(stored);

    await loadAvatarConfig(spy.db);

    expect(JSON.stringify(stored)).toBe(before);
  });

  it('hands back a config that is not the row', async () => {
    const stored = row();
    const spy = createDatabaseSpy(stored);

    const loaded = await loadAvatarConfig(spy.db);

    expect(loaded).not.toBe(stored);
    expect(Object.keys(loaded ?? {})).toEqual([
      'skinToneId',
      'hairStyleId',
      'hairColorId',
      'outfitId',
    ]);
  });
});
