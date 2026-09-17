import { render, waitFor } from '@testing-library/react-native';

import HomeScreen from '@/app/(app)/index';
import type { CycleProfile } from '@/features/cycle/domain/types';
import type { ISODate } from '@/types/iso-date';
import { getTodayLocalISODate } from '@/utils/today';

// The database and the clock are faked. The use case, the repository contract
// and every domain rule stay real, so what the screen prints is what the domain
// actually computes rather than a hard-coded string.
jest.mock('@/storage/db', () => ({
  openAppDatabase: jest.fn(),
  DATABASE_NAME: 'regl-gebelik.db',
}));

jest.mock('@/features/cycle/data/cycle-repository', () => ({
  loadCycleProfile: jest.fn(),
  saveCycleProfile: jest.fn(),
}));

jest.mock('@/utils/today', () => ({
  getTodayLocalISODate: jest.fn(),
}));

const db = jest.requireMock('@/storage/db');
const repository = jest.requireMock('@/features/cycle/data/cycle-repository');
const getTodayMock = getTodayLocalISODate as unknown as jest.Mock;

const FERTILITY_DISCLAIMER =
  'Doğurganlık bilgileri tahminidir ve gebelikten korunma yöntemi olarak kullanılmamalıdır.';

/** Collects every visible string in a rendered tree, ignoring props and styles. */
function collectText(node: unknown): string[] {
  if (typeof node === 'string') {
    return [node];
  }

  if (Array.isArray(node)) {
    return node.flatMap(collectText);
  }

  if (node === null || typeof node !== 'object') {
    return [];
  }

  return collectText((node as { children?: unknown }).children);
}

/** Cycle 28, period 5 -> ovulation on day 14, fertile window days 9-15. */
function profile(startDates: string[] = ['2026-09-01']): CycleProfile {
  return {
    settings: { averageCycleLengthDays: 28, averagePeriodLengthDays: 5 },
    periodRecords: startDates.map((startDate, index) => ({
      id: `record-${index}`,
      startDate: startDate as ISODate,
    })),
  };
}

beforeEach(() => {
  db.openAppDatabase.mockReset();
  db.openAppDatabase.mockResolvedValue({});
  repository.loadCycleProfile.mockReset();
  repository.saveCycleProfile.mockReset();
  getTodayMock.mockReset();
  getTodayMock.mockReturnValue('2026-09-17' as ISODate);
});

async function renderScreen() {
  const screen = await render(<HomeScreen />);

  await waitFor(() => {
    expect(screen.queryByTestId('cycle-dashboard-loading')).toBeNull();
  });

  return screen;
}

describe('HomeScreen while loading', () => {
  it('shows a spinner and a message', async () => {
    // Never settles, so the screen stays in its loading state.
    db.openAppDatabase.mockReturnValue(new Promise(() => {}));

    const { getByTestId, getByText } = await render(<HomeScreen />);

    expect(getByTestId('cycle-dashboard-loading')).toBeTruthy();
    expect(getByText('Veriler yükleniyor')).toBeTruthy();
  });

  it('shows no summary yet', async () => {
    db.openAppDatabase.mockReturnValue(new Promise(() => {}));

    const { queryByText } = await render(<HomeScreen />);

    expect(queryByText('Bugün')).toBeNull();
    expect(queryByText('Döngü günü')).toBeNull();
  });
});

describe('HomeScreen with a saved profile', () => {
  beforeEach(() => {
    repository.loadCycleProfile.mockResolvedValue(profile());
  });

  it("shows today's date", async () => {
    const { getByText } = await renderScreen();

    expect(getByText('Bugün')).toBeTruthy();
    expect(getByText('17 Eylül 2026')).toBeTruthy();
  });

  it('shows the cycle day', async () => {
    const { getByText } = await renderScreen();

    expect(getByText('Döngü günü')).toBeTruthy();
    expect(getByText('17. gün')).toBeTruthy();
  });

  it('shows the phase in Turkish', async () => {
    const { getByText } = await renderScreen();

    expect(getByText('Döngü evresi')).toBeTruthy();
    expect(getByText('Luteal')).toBeTruthy();
  });

  it('shows the fertility estimate with its disclaimer', async () => {
    const { getByText } = await renderScreen();

    expect(getByText('Doğurganlık tahmini')).toBeTruthy();
    expect(getByText('Düşük')).toBeTruthy();
    expect(getByText(FERTILITY_DISCLAIMER)).toBeTruthy();
  });

  it('shows the next predicted period as a readable date', async () => {
    const { getByText } = await renderScreen();

    expect(getByText('Sonraki regl tahmini')).toBeTruthy();
    expect(getByText('29 Eylül 2026')).toBeTruthy();
  });

  it('exposes each row to assistive technology', async () => {
    const { getByLabelText } = await renderScreen();

    expect(getByLabelText('Döngü günü: 17. gün')).toBeTruthy();
    expect(getByLabelText('Döngü evresi: Luteal')).toBeTruthy();
    expect(getByLabelText('Doğurganlık tahmini: Düşük')).toBeTruthy();
    expect(getByLabelText('Sonraki regl tahmini: 29 Eylül 2026')).toBeTruthy();
  });

  it('opens the database once and reads the clock once', async () => {
    await renderScreen();

    expect(db.openAppDatabase).toHaveBeenCalledTimes(1);
    expect(repository.loadCycleProfile).toHaveBeenCalledTimes(1);
    expect(getTodayMock).toHaveBeenCalledTimes(1);
  });
});

describe('HomeScreen tracks the real cycle', () => {
  it('reports the menstrual phase on the first day', async () => {
    getTodayMock.mockReturnValue('2026-09-01' as ISODate);
    repository.loadCycleProfile.mockResolvedValue(profile());

    const { getByText } = await renderScreen();

    expect(getByText('1. gün')).toBeTruthy();
    expect(getByText('Regl')).toBeTruthy();
  });

  it('reports the follicular phase with a raised estimate', async () => {
    getTodayMock.mockReturnValue('2026-09-10' as ISODate);
    repository.loadCycleProfile.mockResolvedValue(profile());

    const { getByText } = await renderScreen();

    expect(getByText('10. gün')).toBeTruthy();
    expect(getByText('Foliküler')).toBeTruthy();
    expect(getByText('Yüksek')).toBeTruthy();
  });

  it('reports ovulation day at its peak', async () => {
    getTodayMock.mockReturnValue('2026-09-14' as ISODate);
    repository.loadCycleProfile.mockResolvedValue(profile());

    const { getByText } = await renderScreen();

    expect(getByText('14. gün')).toBeTruthy();
    expect(getByText('Yumurtlama')).toBeTruthy();
    expect(getByText('En yüksek')).toBeTruthy();
  });

  it('follows a different saved cycle length', async () => {
    repository.loadCycleProfile.mockResolvedValue({
      settings: { averageCycleLengthDays: 35, averagePeriodLengthDays: 7 },
      periodRecords: [{ id: 'a', startDate: '2026-09-01' as ISODate }],
    });

    const { getByText } = await renderScreen();

    expect(getByText('Foliküler')).toBeTruthy();
    expect(getByText('6 Ekim 2026')).toBeTruthy();
  });
});

describe('HomeScreen with an incomplete profile', () => {
  it('says the cycle has not started when nothing is on record yet', async () => {
    repository.loadCycleProfile.mockResolvedValue(profile([]));

    const { getByText } = await renderScreen();

    expect(getByText('Henüz başlamadı')).toBeTruthy();
    expect(getByText('Henüz hesaplanamıyor')).toBeTruthy();
  });

  it('labels an unknown phase and estimate', async () => {
    repository.loadCycleProfile.mockResolvedValue(profile([]));

    const { getAllByText } = await renderScreen();

    expect(getAllByText('Bilinmiyor')).toHaveLength(2);
  });
});

describe('HomeScreen without a saved profile', () => {
  it('says there is no cycle information', async () => {
    repository.loadCycleProfile.mockResolvedValue(null);

    const { getByText, queryByText } = await renderScreen();

    expect(getByText('Döngü bilgisi bulunamadı.')).toBeTruthy();
    expect(queryByText('Döngü günü')).toBeNull();
  });

  it('is not treated as an error', async () => {
    repository.loadCycleProfile.mockResolvedValue(null);

    const { queryByText } = await renderScreen();

    expect(queryByText('Bilgiler yüklenemedi.')).toBeNull();
  });
});

describe('HomeScreen when loading fails', () => {
  it('reports a failed database open', async () => {
    db.openAppDatabase.mockRejectedValue(new Error('disk is full'));

    const { getByText } = await renderScreen();

    expect(getByText('Bilgiler yüklenemedi.')).toBeTruthy();
  });

  it('reports a failed read', async () => {
    repository.loadCycleProfile.mockRejectedValue(new Error('corrupt row'));

    const { getByText } = await renderScreen();

    expect(getByText('Bilgiler yüklenemedi.')).toBeTruthy();
  });

  it('announces the failure to assistive technology', async () => {
    repository.loadCycleProfile.mockRejectedValue(new Error('corrupt row'));

    const { getByRole } = await renderScreen();

    expect(getByRole('alert')).toBeTruthy();
  });

  it('shows no summary and no empty-state message', async () => {
    repository.loadCycleProfile.mockRejectedValue(new Error('corrupt row'));

    const { queryByText } = await renderScreen();

    expect(queryByText('Döngü günü')).toBeNull();
    expect(queryByText('Döngü bilgisi bulunamadı.')).toBeNull();
  });
});

describe('HomeScreen scope', () => {
  it('never writes anything', async () => {
    repository.loadCycleProfile.mockResolvedValue(profile());

    await renderScreen();

    expect(repository.saveCycleProfile).not.toHaveBeenCalled();
  });

  it('makes no medical or probability claim', async () => {
    repository.loadCycleProfile.mockResolvedValue(profile());

    const { toJSON } = await renderScreen();
    const visibleText = collectText(toJSON()).join(' ');

    for (const forbidden of ['%', 'yüzde', 'olasılık', 'hamile kal', 'kesin', 'garanti']) {
      expect(visibleText).not.toContain(forbidden);
    }
  });

  it('shows the disclaimer next to the fertility estimate', async () => {
    repository.loadCycleProfile.mockResolvedValue(profile());

    const { toJSON } = await renderScreen();
    const visibleText = collectText(toJSON());

    expect(visibleText).toContain(FERTILITY_DISCLAIMER);
  });

  it('offers no actions to tap', async () => {
    repository.loadCycleProfile.mockResolvedValue(profile());

    const { queryAllByRole } = await renderScreen();

    expect(queryAllByRole('button')).toHaveLength(0);
  });
});
