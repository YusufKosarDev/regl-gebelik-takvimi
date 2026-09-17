import { fireEvent, render, waitFor } from '@testing-library/react-native';

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

/**
 * Cycle 28, period 5 -> ovulation on day 14, fertile window days 9-15.
 *
 * Records are finished unless asked for otherwise, so the screen offers the
 * start action. Neither `endDate` nor `isOngoing` plays any part in the cycle
 * day, phase, fertility or prediction.
 */
function profile(
  startDates: string[] = ['2026-09-01'],
  options: { open?: boolean } = {}
): CycleProfile {
  const isOngoing = options.open === true;

  return {
    settings: { averageCycleLengthDays: 28, averagePeriodLengthDays: 5 },
    periodRecords: startDates.map((startDate, index) => ({
      id: `record-${index}`,
      startDate: startDate as ISODate,
      ...(isOngoing ? {} : { endDate: startDate as ISODate }),
      isOngoing,
    })),
  };
}

/**
 * The shape onboarding leaves behind: a past period whose end was never asked
 * for. Not ongoing, and no end date invented for it.
 */
function onboardingProfile(startDate = '2026-09-02'): CycleProfile {
  return {
    settings: { averageCycleLengthDays: 30, averagePeriodLengthDays: 6 },
    periodRecords: [
      { id: 'onboarding-initial-period', startDate: startDate as ISODate, isOngoing: false },
    ],
  };
}

beforeEach(() => {
  db.openAppDatabase.mockReset();
  db.openAppDatabase.mockResolvedValue({});
  repository.loadCycleProfile.mockReset();
  repository.saveCycleProfile.mockReset();
  repository.saveCycleProfile.mockResolvedValue(undefined);
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
    const { getAllByText } = await renderScreen();

    // Twice on purpose: the summary header, and the label inside today's square.
    expect(getAllByText('Bugün')).toHaveLength(2);
    // Twice too: the summary date, and the selected day, which starts on today.
    expect(getAllByText('17 Eylül 2026')).toHaveLength(2);
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
      periodRecords: [{ id: 'a', startDate: '2026-09-01' as ISODate , isOngoing: false }],
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

  it('offers only the two month steps to tap', async () => {
    repository.loadCycleProfile.mockResolvedValue(profile());

    const { queryAllByRole } = await renderScreen();

    // The record action, the two month steps and one button per real day of the
    // month, and nothing else: no summary rows, no padding cells.
    const labels = queryAllByRole('button').map((node) => node.props.accessibilityLabel as string);

    expect(labels).toHaveLength(33);
    expect(
      labels.filter(
        (label) =>
          label === 'Regl başlangıcını kaydet' || label === 'Önceki ay' || label === 'Sonraki ay'
      )
    ).toEqual(['Regl başlangıcını kaydet', 'Önceki ay', 'Sonraki ay']);
    expect(labels.filter((label) => label.startsWith('1 Eylül 2026'))).toHaveLength(1);
  });
});

describe('HomeScreen calendar section', () => {
  beforeEach(() => {
    repository.loadCycleProfile.mockResolvedValue(profile());
  });

  it('shows the section heading', async () => {
    const { getByText } = await renderScreen();

    expect(getByText('Takvim')).toBeTruthy();
  });

  it('shows the month today falls in', async () => {
    const { getByText } = await renderScreen();

    expect(getByText('Eylül 2026')).toBeTruthy();
  });

  it('names the month for assistive technology', async () => {
    const { getByLabelText } = await renderScreen();

    expect(getByLabelText('Eylül 2026 takvimi')).toBeTruthy();
  });

  it('renders the weekday headers', async () => {
    const { getByText } = await renderScreen();

    for (const label of ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz']) {
      expect(getByText(label)).toBeTruthy();
    }
  });

  it('renders every day of the month', async () => {
    const { queryAllByTestId } = await renderScreen();

    expect(queryAllByTestId(/^calendar-day-/)).toHaveLength(30);
  });

  it('renders the first and last day of the month', async () => {
    const { getByTestId } = await renderScreen();

    expect(getByTestId('calendar-day-2026-09-01')).toBeTruthy();
    expect(getByTestId('calendar-day-2026-09-30')).toBeTruthy();
  });

  it('does not reach into a neighbouring month', async () => {
    const { queryByTestId } = await renderScreen();

    expect(queryByTestId('calendar-day-2026-08-31')).toBeNull();
    expect(queryByTestId('calendar-day-2026-10-01')).toBeNull();
  });

  it('follows today into another month', async () => {
    getTodayMock.mockReturnValue('2026-10-05' as ISODate);

    const { getByText, queryAllByTestId } = await renderScreen();

    expect(getByText('Ekim 2026')).toBeTruthy();
    expect(queryAllByTestId(/^calendar-day-/)).toHaveLength(31);
  });

  it('keeps the summary alongside the calendar', async () => {
    const { getByText, getAllByText } = await renderScreen();

    expect(getAllByText('17 Eylül 2026').length).toBeGreaterThan(0);
    expect(getAllByText('17. gün').length).toBeGreaterThan(0);
    expect(getByText('Takvim')).toBeTruthy();
  });

  it('reads the profile once for both halves', async () => {
    await renderScreen();

    expect(repository.loadCycleProfile).toHaveBeenCalledTimes(1);
    expect(db.openAppDatabase).toHaveBeenCalledTimes(1);
  });

  it('explains the calendar marks', async () => {
    const { getByText } = await renderScreen();

    for (const label of [
      'Regl günü',
      'Tahmini yumurtlama günü',
      'Doğurganlığın yüksek olduğu tahmini gün',
      'Sonraki regl başlangıcı tahmini',
    ]) {
      expect(getByText(label)).toBeTruthy();
    }
  });

  it('says the calendar information is an estimate', async () => {
    const { getByText } = await renderScreen();

    expect(
      getByText('Takvimdeki doğurganlık ve yumurtlama bilgileri tahminidir.')
    ).toBeTruthy();
  });

  it('keeps the contraception disclaimer alongside the legend', async () => {
    const { getByText } = await renderScreen();

    expect(getByText(FERTILITY_DISCLAIMER)).toBeTruthy();
    expect(getByText('Regl günü')).toBeTruthy();
  });

  it('explains no mark the calendar does not draw', async () => {
    const { queryByText } = await renderScreen();

    expect(queryByText('●')).toBeNull();
  });

  it('makes every real day pressable and no padding cell', async () => {
    const { queryAllByRole, getByTestId, queryAllByTestId } = await renderScreen();

    expect(getByTestId('calendar-day-2026-09-17').props.accessibilityRole).toBe('button');

    for (const empty of queryAllByTestId(/^calendar-empty-/)) {
      expect(empty.props.accessibilityRole).toBeUndefined();
      expect(empty.props.onClick).toBeUndefined();
    }

    // 30 days, the two month steps and the record action.
    expect(queryAllByRole('button')).toHaveLength(33);
  });
});

describe('HomeScreen calendar absence', () => {
  it('shows no calendar while loading', async () => {
    db.openAppDatabase.mockReturnValue(new Promise(() => {}));

    const { queryByText, queryAllByTestId } = await render(<HomeScreen />);

    expect(queryByText('Takvim')).toBeNull();
    expect(queryAllByTestId(/^calendar-day-/)).toHaveLength(0);
  });

  it('shows no calendar when there is no profile', async () => {
    repository.loadCycleProfile.mockResolvedValue(null);

    const { getByText, queryByText, queryAllByTestId } = await renderScreen();

    expect(getByText('Döngü bilgisi bulunamadı.')).toBeTruthy();
    expect(queryByText('Takvim')).toBeNull();
    expect(queryAllByTestId(/^calendar-day-/)).toHaveLength(0);
  });

  it('shows no calendar when loading fails', async () => {
    repository.loadCycleProfile.mockRejectedValue(new Error('corrupt row'));

    const { getByText, queryByText, queryAllByTestId } = await renderScreen();

    expect(getByText('Bilgiler yüklenemedi.')).toBeTruthy();
    expect(queryByText('Takvim')).toBeNull();
    expect(queryAllByTestId(/^calendar-day-/)).toHaveLength(0);
  });
});

describe('HomeScreen legend absence', () => {
  it('shows no legend while loading', async () => {
    db.openAppDatabase.mockReturnValue(new Promise(() => {}));

    const { queryByText } = await render(<HomeScreen />);

    expect(queryByText('Regl günü')).toBeNull();
    expect(queryByText('Takvimdeki doğurganlık ve yumurtlama bilgileri tahminidir.')).toBeNull();
  });

  it('shows no legend when there is no profile', async () => {
    repository.loadCycleProfile.mockResolvedValue(null);

    const { getByText, queryByText } = await renderScreen();

    expect(getByText('Döngü bilgisi bulunamadı.')).toBeTruthy();
    expect(queryByText('Regl günü')).toBeNull();
    expect(queryByText('Tahmini yumurtlama günü')).toBeNull();
  });

  it('shows no legend when loading fails', async () => {
    repository.loadCycleProfile.mockRejectedValue(new Error('corrupt row'));

    const { getByText, queryByText } = await renderScreen();

    expect(getByText('Bilgiler yüklenemedi.')).toBeTruthy();
    expect(queryByText('Regl günü')).toBeNull();
    expect(queryByText('Tahmini yumurtlama günü')).toBeNull();
  });
});

describe('HomeScreen today highlight', () => {
  beforeEach(() => {
    repository.loadCycleProfile.mockResolvedValue(profile());
  });

  it("marks today's square in the calendar", async () => {
    const { getByTestId } = await renderScreen();

    expect(getByTestId('calendar-today-2026-09-17')).toBeTruthy();
  });

  it('marks exactly one square', async () => {
    const { queryAllByTestId } = await renderScreen();

    expect(queryAllByTestId(/^calendar-today-/)).toHaveLength(1);
  });

  it('says so in the accessibility label', async () => {
    const { getByTestId } = await renderScreen();

    // Today starts out selected, so the label says both.
    expect(getByTestId('calendar-day-2026-09-17').props.accessibilityLabel).toBe(
      '17 Eylül 2026, bugün, seçili'
    );
  });

  it('follows the date the use case reported', async () => {
    getTodayMock.mockReturnValue('2026-09-14' as ISODate);

    const { getByTestId, queryByTestId } = await renderScreen();

    expect(getByTestId('calendar-today-2026-09-14')).toBeTruthy();
    expect(queryByTestId('calendar-today-2026-09-17')).toBeNull();
    // The cycle state survives the highlight.
    expect(getByTestId('calendar-day-2026-09-14').props.accessibilityLabel).toBe(
      '14 Eylül 2026, Yumurtlama, doğurganlık en yüksek, bugün, seçili'
    );
  });

  it('reads the clock once for both the summary and the highlight', async () => {
    await renderScreen();

    expect(getTodayMock).toHaveBeenCalledTimes(1);
  });

  it('leaves the legend alone', async () => {
    const { getByText, queryByText } = await renderScreen();

    expect(getByText('Regl günü')).toBeTruthy();
    expect(queryByText('Bugünün tarihi')).toBeNull();
  });
});

describe('HomeScreen month navigation', () => {
  beforeEach(() => {
    repository.loadCycleProfile.mockResolvedValue(profile());
  });

  async function renderWithNavigation() {
    const screen = await renderScreen();

    return {
      ...screen,
      previous: () => screen.getByLabelText('Önceki ay'),
      next: () => screen.getByLabelText('Sonraki ay'),
    };
  }

  it('opens on the month today falls in', async () => {
    const { getByText } = await renderWithNavigation();

    expect(getByText('Eylül 2026')).toBeTruthy();
  });

  it('offers a step in each direction', async () => {
    const { previous, next } = await renderWithNavigation();

    expect(previous()).toBeTruthy();
    expect(next()).toBeTruthy();
  });

  it('moves forward a month', async () => {
    const screen = await renderWithNavigation();

    await fireEvent.press(screen.next());

    expect(screen.getByText('Ekim 2026')).toBeTruthy();
    expect(screen.queryByText('Eylül 2026')).toBeNull();
  });

  it('shows the new month in the grid', async () => {
    const screen = await renderWithNavigation();

    await fireEvent.press(screen.next());

    expect(screen.queryAllByTestId(/^calendar-day-/)).toHaveLength(31);
    expect(screen.getByTestId('calendar-day-2026-10-01')).toBeTruthy();
    expect(screen.getByTestId('calendar-day-2026-10-31')).toBeTruthy();
    expect(screen.queryByTestId('calendar-day-2026-09-17')).toBeNull();
  });

  it('moves back to the current month', async () => {
    const screen = await renderWithNavigation();

    await fireEvent.press(screen.next());
    await fireEvent.press(screen.previous());

    expect(screen.getByText('Eylül 2026')).toBeTruthy();
    expect(screen.queryAllByTestId(/^calendar-day-/)).toHaveLength(30);
  });

  it('moves back past the current month', async () => {
    const screen = await renderWithNavigation();

    await fireEvent.press(screen.previous());

    expect(screen.getByText('Ağustos 2026')).toBeTruthy();
    expect(screen.getByTestId('calendar-day-2026-08-31')).toBeTruthy();
  });

  it('steps across a year boundary', async () => {
    getTodayMock.mockReturnValue('2026-12-15' as ISODate);

    const screen = await renderWithNavigation();

    expect(screen.getByText('Aralık 2026')).toBeTruthy();

    await fireEvent.press(screen.next());

    expect(screen.getByText('Ocak 2027')).toBeTruthy();
    expect(screen.getByTestId('calendar-day-2027-01-31')).toBeTruthy();
  });

  it('steps back across a year boundary', async () => {
    getTodayMock.mockReturnValue('2026-01-15' as ISODate);

    const screen = await renderWithNavigation();

    await fireEvent.press(screen.previous());

    expect(screen.getByText('Aralık 2025')).toBeTruthy();
  });

  it('keeps moving in the same direction', async () => {
    const screen = await renderWithNavigation();

    await fireEvent.press(screen.next());
    await fireEvent.press(screen.next());
    await fireEvent.press(screen.next());

    expect(screen.getByText('Aralık 2026')).toBeTruthy();
  });
});

describe('HomeScreen month navigation leaves the summary alone', () => {
  beforeEach(() => {
    repository.loadCycleProfile.mockResolvedValue(profile());
  });

  it('keeps the summary of today when the calendar moves', async () => {
    const screen = await renderScreen();

    await fireEvent.press(screen.getByLabelText('Sonraki ay'));

    expect(screen.getByText('Ekim 2026')).toBeTruthy();
    expect(screen.getByText('17 Eylül 2026')).toBeTruthy();
    expect(screen.getByText('17. gün')).toBeTruthy();
    expect(screen.getByText('Luteal')).toBeTruthy();
    expect(screen.getByText('29 Eylül 2026')).toBeTruthy();
  });

  it('keeps the legend on every month', async () => {
    const screen = await renderScreen();

    await fireEvent.press(screen.getByLabelText('Sonraki ay'));
    expect(screen.getByText('Regl günü')).toBeTruthy();

    await fireEvent.press(screen.getByLabelText('Önceki ay'));
    await fireEvent.press(screen.getByLabelText('Önceki ay'));
    expect(screen.getByText('Tahmini yumurtlama günü')).toBeTruthy();
  });
});

describe('HomeScreen month navigation and today', () => {
  beforeEach(() => {
    repository.loadCycleProfile.mockResolvedValue(profile());
  });

  it('marks today on the month it falls in', async () => {
    const { getByTestId } = await renderScreen();

    expect(getByTestId('calendar-today-2026-09-17')).toBeTruthy();
  });

  it('marks nothing on the next month', async () => {
    const screen = await renderScreen();

    await fireEvent.press(screen.getByLabelText('Sonraki ay'));

    expect(screen.queryAllByTestId(/^calendar-today-/)).toHaveLength(0);
  });

  it('marks nothing on the previous month', async () => {
    const screen = await renderScreen();

    await fireEvent.press(screen.getByLabelText('Önceki ay'));

    expect(screen.queryAllByTestId(/^calendar-today-/)).toHaveLength(0);
  });

  it('marks today again on the way back', async () => {
    const screen = await renderScreen();

    await fireEvent.press(screen.getByLabelText('Sonraki ay'));
    await fireEvent.press(screen.getByLabelText('Önceki ay'));

    expect(screen.getByTestId('calendar-today-2026-09-17')).toBeTruthy();
  });
});

describe('HomeScreen month navigation does not touch the database', () => {
  it('reads the profile once across several months', async () => {
    repository.loadCycleProfile.mockResolvedValue(profile());

    const screen = await renderScreen();

    await fireEvent.press(screen.getByLabelText('Sonraki ay'));
    await fireEvent.press(screen.getByLabelText('Önceki ay'));
    await fireEvent.press(screen.getByLabelText('Önceki ay'));

    expect(screen.getByText('Ağustos 2026')).toBeTruthy();
    expect(db.openAppDatabase).toHaveBeenCalledTimes(1);
    expect(repository.loadCycleProfile).toHaveBeenCalledTimes(1);
    expect(getTodayMock).toHaveBeenCalledTimes(1);
  });

  it('never shows the loading screen again', async () => {
    repository.loadCycleProfile.mockResolvedValue(profile());

    const screen = await renderScreen();

    await fireEvent.press(screen.getByLabelText('Sonraki ay'));

    expect(screen.queryByTestId('cycle-dashboard-loading')).toBeNull();
    expect(screen.queryByText('Veriler yükleniyor')).toBeNull();
  });
});

describe('HomeScreen month navigation boundaries', () => {
  it('disables stepping back before year 0', async () => {
    getTodayMock.mockReturnValue('0000-01-15' as ISODate);
    repository.loadCycleProfile.mockResolvedValue(profile(['0000-01-02']));

    const { getByLabelText } = await renderScreen();

    expect(getByLabelText('Önceki ay').props.accessibilityState.disabled).toBe(true);
    expect(getByLabelText('Sonraki ay').props.accessibilityState.disabled).toBe(false);
  });

  it('disables stepping past year 9999', async () => {
    getTodayMock.mockReturnValue('9999-12-15' as ISODate);
    repository.loadCycleProfile.mockResolvedValue(profile(['9999-12-02']));

    const { getByLabelText } = await renderScreen();

    expect(getByLabelText('Sonraki ay').props.accessibilityState.disabled).toBe(true);
    expect(getByLabelText('Önceki ay').props.accessibilityState.disabled).toBe(false);
  });

  it('enables both steps in an ordinary month', async () => {
    repository.loadCycleProfile.mockResolvedValue(profile());

    const { getByLabelText } = await renderScreen();

    expect(getByLabelText('Önceki ay').props.accessibilityState.disabled).toBe(false);
    expect(getByLabelText('Sonraki ay').props.accessibilityState.disabled).toBe(false);
  });
});

describe('HomeScreen month navigation absence', () => {
  it('offers no navigation when there is no profile', async () => {
    repository.loadCycleProfile.mockResolvedValue(null);

    const { queryByLabelText } = await renderScreen();

    expect(queryByLabelText('Önceki ay')).toBeNull();
    expect(queryByLabelText('Sonraki ay')).toBeNull();
  });

  it('offers no navigation when loading fails', async () => {
    repository.loadCycleProfile.mockRejectedValue(new Error('corrupt row'));

    const { queryByLabelText } = await renderScreen();

    expect(queryByLabelText('Önceki ay')).toBeNull();
  });
});

describe('HomeScreen selected day', () => {
  beforeEach(() => {
    repository.loadCycleProfile.mockResolvedValue(profile());
  });

  it('shows the section', async () => {
    const { getByText } = await renderScreen();

    expect(getByText('Seçilen gün')).toBeTruthy();
  });

  it('starts on today', async () => {
    const { getByTestId, getByText } = await renderScreen();

    expect(getByTestId('calendar-day-2026-09-17').props.accessibilityState.selected).toBe(true);
    expect(getByText('Döngü günü: 17. gün')).toBeTruthy();
    expect(getByText('Döngü evresi: Luteal')).toBeTruthy();
    expect(getByText('Doğurganlık tahmini: Düşük')).toBeTruthy();
  });

  it('follows a tap onto another day', async () => {
    const screen = await renderScreen();

    await fireEvent.press(screen.getByTestId('calendar-day-2026-09-11'));

    expect(screen.getByText('11 Eylül 2026')).toBeTruthy();
    expect(screen.getByText('Döngü günü: 11. gün')).toBeTruthy();
    expect(screen.getByText('Döngü evresi: Foliküler')).toBeTruthy();
    expect(screen.getByText('Doğurganlık tahmini: Yüksek')).toBeTruthy();
  });

  it('moves the selection mark with the tap', async () => {
    const screen = await renderScreen();

    await fireEvent.press(screen.getByTestId('calendar-day-2026-09-11'));

    expect(screen.getByTestId('calendar-day-2026-09-11').props.accessibilityState.selected).toBe(
      true
    );
    expect(screen.getByTestId('calendar-day-2026-09-17').props.accessibilityState.selected).toBe(
      false
    );
  });

  it('keeps the today mark when another day is picked', async () => {
    const screen = await renderScreen();

    await fireEvent.press(screen.getByTestId('calendar-day-2026-09-11'));

    expect(screen.getByTestId('calendar-today-2026-09-17')).toBeTruthy();
  });

  it('shows the predicted period note on the predicted day', async () => {
    const screen = await renderScreen();

    // The legend already carries this wording for the same mark, so the detail
    // note is the second occurrence rather than the only one.
    expect(screen.getAllByText('Sonraki regl başlangıcı tahmini')).toHaveLength(1);

    await fireEvent.press(screen.getByTestId('calendar-day-2026-09-29'));

    // Twice now: the summary's predicted date and the selected day's date.
    expect(screen.getAllByText('29 Eylül 2026')).toHaveLength(2);
    expect(screen.getAllByText('Sonraki regl başlangıcı tahmini')).toHaveLength(2);
  });

  it('shows no predicted note on an ordinary day', async () => {
    const screen = await renderScreen();

    await fireEvent.press(screen.getByTestId('calendar-day-2026-09-20'));

    // Only the legend's row remains.
    expect(screen.getAllByText('Sonraki regl başlangıcı tahmini')).toHaveLength(1);
  });
});

describe('HomeScreen selected day before the first record', () => {
  beforeEach(() => {
    repository.loadCycleProfile.mockResolvedValue(profile(['2026-09-10']));
  });

  it('reports an unknown day', async () => {
    const screen = await renderScreen();

    await fireEvent.press(screen.getByTestId('calendar-day-2026-09-01'));

    expect(screen.getByText('1 Eylül 2026')).toBeTruthy();
    expect(screen.getByText('Döngü günü: Henüz başlamadı')).toBeTruthy();
    expect(screen.getByText('Döngü evresi: Bilinmiyor')).toBeTruthy();
    expect(screen.getByText('Doğurganlık tahmini: Bilinmiyor')).toBeTruthy();
  });
});

describe('HomeScreen selection across months', () => {
  beforeEach(() => {
    repository.loadCycleProfile.mockResolvedValue(profile());
  });

  it('clears the selection when the month changes', async () => {
    const screen = await renderScreen();

    await fireEvent.press(screen.getByLabelText('Sonraki ay'));

    expect(screen.getByText('Bir gün seç.')).toBeTruthy();
  });

  it('leaves no stale date behind', async () => {
    const screen = await renderScreen();

    expect(screen.getAllByText('17 Eylül 2026')).toHaveLength(2);

    await fireEvent.press(screen.getByLabelText('Sonraki ay'));

    // Only the summary still names it; the selected card does not.
    expect(screen.getAllByText('17 Eylül 2026')).toHaveLength(1);
    expect(screen.queryByText('Döngü günü: 17. gün')).toBeNull();
  });

  it('marks nothing as selected in another month', async () => {
    const screen = await renderScreen();

    await fireEvent.press(screen.getByLabelText('Sonraki ay'));

    for (const cell of screen.queryAllByTestId(/^calendar-day-/)) {
      expect(cell.props.accessibilityState.selected).toBe(false);
    }
  });

  it('accepts a pick in the new month', async () => {
    const screen = await renderScreen();

    await fireEvent.press(screen.getByLabelText('Sonraki ay'));
    await fireEvent.press(screen.getByTestId('calendar-day-2026-10-02'));

    expect(screen.getByText('2 Ekim 2026')).toBeTruthy();
    expect(screen.getByTestId('calendar-day-2026-10-02').props.accessibilityState.selected).toBe(
      true
    );
  });

  it('selects today again on the way back', async () => {
    const screen = await renderScreen();

    await fireEvent.press(screen.getByLabelText('Sonraki ay'));
    await fireEvent.press(screen.getByTestId('calendar-day-2026-10-02'));
    await fireEvent.press(screen.getByLabelText('Önceki ay'));

    expect(screen.getByTestId('calendar-day-2026-09-17').props.accessibilityState.selected).toBe(
      true
    );
    expect(screen.getByText('Döngü günü: 17. gün')).toBeTruthy();
    expect(screen.queryByText('2 Ekim 2026')).toBeNull();
  });

  it('says to pick a day in a month without today', async () => {
    const screen = await renderScreen();

    await fireEvent.press(screen.getByLabelText('Önceki ay'));

    expect(screen.getByText('Bir gün seç.')).toBeTruthy();
  });
});

describe('HomeScreen selection leaves the rest alone', () => {
  beforeEach(() => {
    repository.loadCycleProfile.mockResolvedValue(profile());
  });

  it('does not change the summary', async () => {
    const screen = await renderScreen();

    await fireEvent.press(screen.getByTestId('calendar-day-2026-09-03'));

    expect(screen.getByText('Döngü günü')).toBeTruthy();
    expect(screen.getByText('17. gün')).toBeTruthy();
    expect(screen.getByText('Luteal')).toBeTruthy();
    expect(screen.getByText(FERTILITY_DISCLAIMER)).toBeTruthy();
  });

  it('keeps the legend', async () => {
    const screen = await renderScreen();

    await fireEvent.press(screen.getByTestId('calendar-day-2026-09-03'));

    expect(screen.getByText('Regl günü')).toBeTruthy();
    expect(
      screen.getByText('Takvimdeki doğurganlık ve yumurtlama bilgileri tahminidir.')
    ).toBeTruthy();
  });

  it('reads nothing from the database', async () => {
    const screen = await renderScreen();

    await fireEvent.press(screen.getByTestId('calendar-day-2026-09-03'));
    await fireEvent.press(screen.getByLabelText('Sonraki ay'));
    await fireEvent.press(screen.getByTestId('calendar-day-2026-10-02'));
    await fireEvent.press(screen.getByLabelText('Önceki ay'));

    expect(db.openAppDatabase).toHaveBeenCalledTimes(1);
    expect(repository.loadCycleProfile).toHaveBeenCalledTimes(1);
    expect(getTodayMock).toHaveBeenCalledTimes(1);
  });
});

describe('HomeScreen selected day absence', () => {
  it('shows no selected card while loading', async () => {
    db.openAppDatabase.mockReturnValue(new Promise(() => {}));

    const { queryByText } = await render(<HomeScreen />);

    expect(queryByText('Seçilen gün')).toBeNull();
  });

  it('shows no selected card when there is no profile', async () => {
    repository.loadCycleProfile.mockResolvedValue(null);

    const { queryByText } = await renderScreen();

    expect(queryByText('Seçilen gün')).toBeNull();
    expect(queryByText('Bir gün seç.')).toBeNull();
  });

  it('shows no selected card when loading fails', async () => {
    repository.loadCycleProfile.mockRejectedValue(new Error('corrupt row'));

    const { queryByText } = await renderScreen();

    expect(queryByText('Seçilen gün')).toBeNull();
  });
});

describe('HomeScreen period start action', () => {
  beforeEach(() => {
    repository.loadCycleProfile.mockResolvedValue(profile());
  });

  it('offers the action', async () => {
    const { getByLabelText, getByText } = await renderScreen();

    expect(getByLabelText('Regl başlangıcını kaydet')).toBeTruthy();
    expect(getByText('Regl başladı')).toBeTruthy();
  });

  it('shows no confirmation until asked', async () => {
    const { queryByText } = await renderScreen();

    expect(
      queryByText('Bugünü regl başlangıcı olarak kaydetmek istiyor musun?')
    ).toBeNull();
  });

  it('asks before saving', async () => {
    const screen = await renderScreen();

    await fireEvent.press(screen.getByLabelText('Regl başlangıcını kaydet'));

    expect(
      screen.getByText('Bugünü regl başlangıcı olarak kaydetmek istiyor musun?')
    ).toBeTruthy();
    expect(screen.getByLabelText('Vazgeç')).toBeTruthy();
    expect(screen.getByLabelText('Kaydet')).toBeTruthy();
  });

  it('names the date it would record', async () => {
    const screen = await renderScreen();

    await fireEvent.press(screen.getByLabelText('Regl başlangıcını kaydet'));

    // Three times now: the summary, the selected day and the confirmation.
    expect(screen.getAllByText('17 Eylül 2026')).toHaveLength(3);
  });

  it('writes nothing while only asking', async () => {
    const screen = await renderScreen();

    await fireEvent.press(screen.getByLabelText('Regl başlangıcını kaydet'));

    expect(repository.saveCycleProfile).not.toHaveBeenCalled();
  });
});

describe('HomeScreen period start cancel', () => {
  beforeEach(() => {
    repository.loadCycleProfile.mockResolvedValue(profile());
  });

  it('closes the confirmation', async () => {
    const screen = await renderScreen();

    await fireEvent.press(screen.getByLabelText('Regl başlangıcını kaydet'));
    await fireEvent.press(screen.getByLabelText('Vazgeç'));

    expect(
      screen.queryByText('Bugünü regl başlangıcı olarak kaydetmek istiyor musun?')
    ).toBeNull();
    expect(screen.getByText('Regl başladı')).toBeTruthy();
  });

  it('touches no storage', async () => {
    const screen = await renderScreen();

    await fireEvent.press(screen.getByLabelText('Regl başlangıcını kaydet'));
    await fireEvent.press(screen.getByLabelText('Vazgeç'));

    expect(repository.saveCycleProfile).not.toHaveBeenCalled();
    expect(repository.loadCycleProfile).toHaveBeenCalledTimes(1);
    expect(db.openAppDatabase).toHaveBeenCalledTimes(1);
  });
});

describe('HomeScreen period start save', () => {
  /** What the repository returns once today has been recorded. */
  function profileWithToday(): CycleProfile {
    return {
      settings: { averageCycleLengthDays: 28, averagePeriodLengthDays: 5 },
      periodRecords: [
        { id: 'record-0', startDate: '2026-09-01' as ISODate , isOngoing: false },
        { id: 'period-2026-09-17', startDate: '2026-09-17' as ISODate , isOngoing: false },
      ],
    };
  }

  async function saveToday() {
    const screen = await renderScreen();

    await fireEvent.press(screen.getByLabelText('Regl başlangıcını kaydet'));
    await fireEvent.press(screen.getByLabelText('Kaydet'));

    return screen;
  }

  it('stores the profile with today added', async () => {
    repository.loadCycleProfile.mockResolvedValue(profile());

    await saveToday();

    expect(repository.saveCycleProfile).toHaveBeenCalledTimes(1);

    const [, saved] = repository.saveCycleProfile.mock.calls[0] as [unknown, CycleProfile];

    expect(saved.periodRecords.map((record) => record.startDate)).toEqual([
      '2026-09-01',
      '2026-09-17',
    ]);
    expect(saved.periodRecords[1].id).toBe('period-2026-09-17');
    expect(saved.periodRecords[1].endDate).toBeUndefined();
  });

  it('closes the confirmation', async () => {
    repository.loadCycleProfile.mockResolvedValue(profile());

    const screen = await saveToday();

    expect(
      screen.queryByText('Bugünü regl başlangıcı olarak kaydetmek istiyor musun?')
    ).toBeNull();
  });

  it('reloads the data', async () => {
    repository.loadCycleProfile
      .mockResolvedValueOnce(profile())
      .mockResolvedValueOnce(profile())
      .mockResolvedValue(profileWithToday());

    await saveToday();

    // Once on mount, once inside the use case, once for the refresh.
    expect(repository.loadCycleProfile).toHaveBeenCalledTimes(3);
  });

  it('shows the new summary', async () => {
    repository.loadCycleProfile
      .mockResolvedValueOnce(profile())
      .mockResolvedValueOnce(profile())
      .mockResolvedValue(profileWithToday());

    const screen = await saveToday();

    expect(screen.getByText('1. gün')).toBeTruthy();
    expect(screen.getByText('Regl')).toBeTruthy();
    expect(screen.getByText('15 Ekim 2026')).toBeTruthy();
  });

  it('shows the new calendar', async () => {
    repository.loadCycleProfile
      .mockResolvedValueOnce(profile())
      .mockResolvedValueOnce(profile())
      .mockResolvedValue(profileWithToday());

    const screen = await saveToday();

    expect(screen.getByTestId('calendar-day-2026-09-17').props.accessibilityLabel).toBe(
      '17 Eylül 2026, Regl, bugün, seçili'
    );
  });

  it('keeps today marked and selected', async () => {
    repository.loadCycleProfile
      .mockResolvedValueOnce(profile())
      .mockResolvedValueOnce(profile())
      .mockResolvedValue(profileWithToday());

    const screen = await saveToday();

    expect(screen.getByTestId('calendar-today-2026-09-17')).toBeTruthy();
    expect(screen.getByTestId('calendar-day-2026-09-17').props.accessibilityState.selected).toBe(
      true
    );
  });

  it('keeps the calendar and legend working', async () => {
    repository.loadCycleProfile
      .mockResolvedValueOnce(profile())
      .mockResolvedValueOnce(profile())
      .mockResolvedValue(profileWithToday());

    const screen = await saveToday();

    expect(screen.getByText('Eylül 2026')).toBeTruthy();
    expect(screen.getByText('Regl günü')).toBeTruthy();
    expect(screen.queryAllByTestId(/^calendar-day-/)).toHaveLength(30);
  });

  it('leaves month navigation working', async () => {
    repository.loadCycleProfile
      .mockResolvedValueOnce(profile())
      .mockResolvedValueOnce(profile())
      .mockResolvedValue(profileWithToday());

    const screen = await saveToday();

    await fireEvent.press(screen.getByLabelText('Sonraki ay'));

    expect(screen.getByText('Ekim 2026')).toBeTruthy();
    expect(screen.getByText('Bir gün seç.')).toBeTruthy();
  });

  it('leaves day selection working', async () => {
    repository.loadCycleProfile
      .mockResolvedValueOnce(profile())
      .mockResolvedValueOnce(profile())
      .mockResolvedValue(profileWithToday());

    const screen = await saveToday();

    await fireEvent.press(screen.getByTestId('calendar-day-2026-09-20'));

    expect(screen.getByText('20 Eylül 2026')).toBeTruthy();
  });
});

describe('HomeScreen period start double submit', () => {
  it('saves once however many times Kaydet is pressed', async () => {
    repository.loadCycleProfile.mockResolvedValue(profile());

    const screen = await renderScreen();

    await fireEvent.press(screen.getByLabelText('Regl başlangıcını kaydet'));
    await fireEvent.press(screen.getByLabelText('Kaydet'));

    // The confirmation is gone after a successful save, so there is nothing
    // left to press a second time.
    expect(screen.queryByLabelText('Kaydet')).toBeNull();
    expect(repository.saveCycleProfile).toHaveBeenCalledTimes(1);
  });
});

describe('HomeScreen period start failure', () => {
  beforeEach(() => {
    repository.loadCycleProfile.mockResolvedValue(profile());
  });

  it('reports a rejected save', async () => {
    repository.saveCycleProfile.mockRejectedValue(new Error('disk is full'));

    const screen = await renderScreen();

    await fireEvent.press(screen.getByLabelText('Regl başlangıcını kaydet'));
    await fireEvent.press(screen.getByLabelText('Kaydet'));

    expect(screen.getByText('Regl başlangıcı kaydedilemedi.')).toBeTruthy();
  });

  it('announces the failure to assistive technology', async () => {
    repository.saveCycleProfile.mockRejectedValue(new Error('disk is full'));

    const screen = await renderScreen();

    await fireEvent.press(screen.getByLabelText('Regl başlangıcını kaydet'));
    await fireEvent.press(screen.getByLabelText('Kaydet'));

    expect(screen.getByRole('alert')).toBeTruthy();
  });

  it('keeps the confirmation open so the failure sits next to the action', async () => {
    repository.saveCycleProfile.mockRejectedValue(new Error('disk is full'));

    const screen = await renderScreen();

    await fireEvent.press(screen.getByLabelText('Regl başlangıcını kaydet'));
    await fireEvent.press(screen.getByLabelText('Kaydet'));

    expect(screen.getByLabelText('Kaydet')).toBeTruthy();
    expect(screen.getByLabelText('Vazgeç')).toBeTruthy();
  });

  it('leaves the shown data alone', async () => {
    repository.saveCycleProfile.mockRejectedValue(new Error('disk is full'));

    const screen = await renderScreen();

    await fireEvent.press(screen.getByLabelText('Regl başlangıcını kaydet'));
    await fireEvent.press(screen.getByLabelText('Kaydet'));

    expect(screen.getByText('17. gün')).toBeTruthy();
    expect(screen.getByText('Luteal')).toBeTruthy();
    expect(screen.getByText('Eylül 2026')).toBeTruthy();
    expect(screen.getByText('Regl günü')).toBeTruthy();
  });

  it('rejects a date already recorded without corrupting anything', async () => {
    // Today is already on file and closed, so the screen still offers the start
    // action and the use case is what refuses the duplicate date.
    repository.loadCycleProfile.mockResolvedValue({
      settings: { averageCycleLengthDays: 28, averagePeriodLengthDays: 5 },
      periodRecords: [
        {
          id: 'period-2026-09-17',
          startDate: '2026-09-17' as ISODate,
          endDate: '2026-09-17' as ISODate,
          isOngoing: false,
        },
      ],
    });

    const screen = await renderScreen();

    await fireEvent.press(screen.getByLabelText('Regl başlangıcını kaydet'));
    await fireEvent.press(screen.getByLabelText('Kaydet'));

    expect(screen.getByText('Regl başlangıcı kaydedilemedi.')).toBeTruthy();
    expect(repository.saveCycleProfile).not.toHaveBeenCalled();
    expect(screen.getByText('1. gün')).toBeTruthy();
  });

  it('clears the error when the confirmation is dismissed', async () => {
    repository.saveCycleProfile.mockRejectedValue(new Error('disk is full'));

    const screen = await renderScreen();

    await fireEvent.press(screen.getByLabelText('Regl başlangıcını kaydet'));
    await fireEvent.press(screen.getByLabelText('Kaydet'));
    await fireEvent.press(screen.getByLabelText('Vazgeç'));
    await fireEvent.press(screen.getByLabelText('Regl başlangıcını kaydet'));

    expect(screen.queryByText('Regl başlangıcı kaydedilemedi.')).toBeNull();
  });
});

describe('HomeScreen period start absence', () => {
  it('offers nothing to record while loading', async () => {
    db.openAppDatabase.mockReturnValue(new Promise(() => {}));

    const { queryByLabelText } = await render(<HomeScreen />);

    expect(queryByLabelText('Regl başlangıcını kaydet')).toBeNull();
  });

  it('offers nothing to record without a profile', async () => {
    repository.loadCycleProfile.mockResolvedValue(null);

    const { queryByLabelText } = await renderScreen();

    expect(queryByLabelText('Regl başlangıcını kaydet')).toBeNull();
  });

  it('offers nothing to record when loading failed', async () => {
    repository.loadCycleProfile.mockRejectedValue(new Error('corrupt row'));

    const { queryByLabelText } = await renderScreen();

    expect(queryByLabelText('Regl başlangıcını kaydet')).toBeNull();
  });
});

describe('HomeScreen period action choice', () => {
  it('offers the start action when nothing is open', async () => {
    repository.loadCycleProfile.mockResolvedValue(profile());

    const { getByLabelText, queryByLabelText, getByText, queryByText } = await renderScreen();

    expect(getByLabelText('Regl başlangıcını kaydet')).toBeTruthy();
    expect(getByText('Regl başladı')).toBeTruthy();
    expect(queryByLabelText('Regl bitişini kaydet')).toBeNull();
    expect(queryByText('Regl bitti')).toBeNull();
  });

  it('offers the end action when a period is open', async () => {
    repository.loadCycleProfile.mockResolvedValue(profile(['2026-09-17'], { open: true }));

    const { getByLabelText, queryByLabelText, getByText, queryByText } = await renderScreen();

    expect(getByLabelText('Regl bitişini kaydet')).toBeTruthy();
    expect(getByText('Regl bitti')).toBeTruthy();
    expect(queryByLabelText('Regl başlangıcını kaydet')).toBeNull();
    expect(queryByText('Regl başladı')).toBeNull();
  });

  it('never sees several ongoing periods, because validation rejects them first', async () => {
    repository.loadCycleProfile.mockResolvedValue({
      settings: { averageCycleLengthDays: 28, averagePeriodLengthDays: 5 },
      periodRecords: [
        { id: 'a', startDate: '2026-09-01' as ISODate, isOngoing: true },
        { id: 'b', startDate: '2026-09-17' as ISODate, isOngoing: true },
      ],
    });

    const { queryByLabelText, getByText } = await renderScreen();

    // The domain invariant fires before anything is rendered, so the screen
    // reports the failure rather than showing an action it cannot carry out.
    expect(getByText('Bilgiler yüklenemedi.')).toBeTruthy();
    expect(queryByLabelText('Regl başlangıcını kaydet')).toBeNull();
    expect(queryByLabelText('Regl bitişini kaydet')).toBeNull();
  });
});

describe('HomeScreen period end confirmation', () => {
  beforeEach(() => {
    repository.loadCycleProfile.mockResolvedValue(profile(['2026-09-17'], { open: true }));
  });

  it('asks before saving', async () => {
    const screen = await renderScreen();

    await fireEvent.press(screen.getByLabelText('Regl bitişini kaydet'));

    expect(screen.getByText('Bugünü regl bitişi olarak kaydetmek istiyor musun?')).toBeTruthy();
    expect(
      screen.queryByText('Bugünü regl başlangıcı olarak kaydetmek istiyor musun?')
    ).toBeNull();
  });

  it('names the date it would record', async () => {
    const screen = await renderScreen();

    await fireEvent.press(screen.getByLabelText('Regl bitişini kaydet'));

    // The summary, the selected day and the confirmation.
    expect(screen.getAllByText('17 Eylül 2026')).toHaveLength(3);
  });

  it('writes nothing while only asking', async () => {
    const screen = await renderScreen();

    await fireEvent.press(screen.getByLabelText('Regl bitişini kaydet'));

    expect(repository.saveCycleProfile).not.toHaveBeenCalled();
  });

  it('closes on Vazgeç without touching storage', async () => {
    const screen = await renderScreen();

    await fireEvent.press(screen.getByLabelText('Regl bitişini kaydet'));
    await fireEvent.press(screen.getByLabelText('Vazgeç'));

    expect(screen.queryByText('Bugünü regl bitişi olarak kaydetmek istiyor musun?')).toBeNull();
    expect(screen.getByText('Regl bitti')).toBeTruthy();
    expect(repository.saveCycleProfile).not.toHaveBeenCalled();
    expect(repository.loadCycleProfile).toHaveBeenCalledTimes(1);
  });
});

describe('HomeScreen period end save', () => {
  /** What the repository returns once the open period has been closed. */
  function closedProfile(): CycleProfile {
    return {
      settings: { averageCycleLengthDays: 28, averagePeriodLengthDays: 5 },
      periodRecords: [
        {
          id: 'record-0',
          startDate: '2026-09-17' as ISODate,
          endDate: '2026-09-17' as ISODate,
          isOngoing: false,
        },
      ],
    };
  }

  async function endToday() {
    const screen = await renderScreen();

    await fireEvent.press(screen.getByLabelText('Regl bitişini kaydet'));
    await fireEvent.press(screen.getByLabelText('Kaydet'));

    return screen;
  }

  it('stores the profile with the end date filled in', async () => {
    repository.loadCycleProfile.mockResolvedValue(profile(['2026-09-17'], { open: true }));

    await endToday();

    expect(repository.saveCycleProfile).toHaveBeenCalledTimes(1);

    const [, saved] = repository.saveCycleProfile.mock.calls[0] as [unknown, CycleProfile];

    expect(saved.periodRecords).toEqual([
      { id: 'record-0', startDate: '2026-09-17', endDate: '2026-09-17' , isOngoing: false },
    ]);
  });

  it('closes the confirmation', async () => {
    repository.loadCycleProfile.mockResolvedValue(profile(['2026-09-17'], { open: true }));

    const screen = await endToday();

    expect(screen.queryByText('Bugünü regl bitişi olarak kaydetmek istiyor musun?')).toBeNull();
  });

  it('reloads the data', async () => {
    repository.loadCycleProfile
      .mockResolvedValueOnce(profile(['2026-09-17'], { open: true }))
      .mockResolvedValueOnce(profile(['2026-09-17'], { open: true }))
      .mockResolvedValue(closedProfile());

    await endToday();

    // Once on mount, once inside the use case, once for the refresh.
    expect(repository.loadCycleProfile).toHaveBeenCalledTimes(3);
  });

  it('offers the start action again', async () => {
    repository.loadCycleProfile
      .mockResolvedValueOnce(profile(['2026-09-17'], { open: true }))
      .mockResolvedValueOnce(profile(['2026-09-17'], { open: true }))
      .mockResolvedValue(closedProfile());

    const screen = await endToday();

    expect(screen.getByText('Regl başladı')).toBeTruthy();
    expect(screen.queryByText('Regl bitti')).toBeNull();
  });

  it('leaves the summary reading the same cycle', async () => {
    repository.loadCycleProfile
      .mockResolvedValueOnce(profile(['2026-09-17'], { open: true }))
      .mockResolvedValueOnce(profile(['2026-09-17'], { open: true }))
      .mockResolvedValue(closedProfile());

    const screen = await endToday();

    // The recorded end date plays no part in the phase or the prediction.
    expect(screen.getByText('1. gün')).toBeTruthy();
    expect(screen.getByText('Regl')).toBeTruthy();
    expect(screen.getByText('15 Ekim 2026')).toBeTruthy();
  });

  it('keeps the calendar, legend and navigation working', async () => {
    repository.loadCycleProfile
      .mockResolvedValueOnce(profile(['2026-09-17'], { open: true }))
      .mockResolvedValueOnce(profile(['2026-09-17'], { open: true }))
      .mockResolvedValue(closedProfile());

    const screen = await endToday();

    expect(screen.getByText('Eylül 2026')).toBeTruthy();
    expect(screen.getByText('Regl günü')).toBeTruthy();
    expect(screen.getByTestId('calendar-today-2026-09-17')).toBeTruthy();

    await fireEvent.press(screen.getByTestId('calendar-day-2026-09-20'));
    expect(screen.getByText('20 Eylül 2026')).toBeTruthy();

    await fireEvent.press(screen.getByLabelText('Sonraki ay'));
    expect(screen.getByText('Ekim 2026')).toBeTruthy();
  });

  it('saves once however many times Kaydet is pressed', async () => {
    repository.loadCycleProfile.mockResolvedValue(profile(['2026-09-17'], { open: true }));

    const screen = await endToday();

    // The confirmation is gone after a successful save, so there is nothing
    // left to press a second time.
    expect(screen.queryByLabelText('Kaydet')).toBeNull();
    expect(repository.saveCycleProfile).toHaveBeenCalledTimes(1);
  });
});

describe('HomeScreen period end failure', () => {
  beforeEach(() => {
    repository.loadCycleProfile.mockResolvedValue(profile(['2026-09-17'], { open: true }));
  });

  async function failToEnd() {
    repository.saveCycleProfile.mockRejectedValue(new Error('disk is full'));

    const screen = await renderScreen();

    await fireEvent.press(screen.getByLabelText('Regl bitişini kaydet'));
    await fireEvent.press(screen.getByLabelText('Kaydet'));

    return screen;
  }

  it('reports the failure with its own message', async () => {
    const screen = await failToEnd();

    expect(screen.getByText('Regl bitişi kaydedilemedi.')).toBeTruthy();
    expect(screen.queryByText('Regl başlangıcı kaydedilemedi.')).toBeNull();
  });

  it('announces it to assistive technology', async () => {
    const screen = await failToEnd();

    expect(screen.getByRole('alert')).toBeTruthy();
  });

  it('keeps the confirmation open so a retry is possible', async () => {
    const screen = await failToEnd();

    expect(screen.getByLabelText('Kaydet')).toBeTruthy();
    expect(screen.getByLabelText('Vazgeç')).toBeTruthy();
  });

  it('retries on a second press', async () => {
    const screen = await failToEnd();

    await fireEvent.press(screen.getByLabelText('Kaydet'));

    expect(repository.saveCycleProfile).toHaveBeenCalledTimes(2);
  });

  it('leaves the shown data alone', async () => {
    const screen = await failToEnd();

    expect(screen.getByText('1. gün')).toBeTruthy();
    expect(screen.getByText('Eylül 2026')).toBeTruthy();
    expect(screen.getByText('Regl günü')).toBeTruthy();
  });

  it('clears the error when the confirmation is dismissed', async () => {
    const screen = await failToEnd();

    await fireEvent.press(screen.getByLabelText('Vazgeç'));
    await fireEvent.press(screen.getByLabelText('Regl bitişini kaydet'));

    expect(screen.queryByText('Regl bitişi kaydedilemedi.')).toBeNull();
  });
});

describe('HomeScreen period end absence', () => {
  it('offers nothing to record while loading', async () => {
    db.openAppDatabase.mockReturnValue(new Promise(() => {}));

    const { queryByLabelText } = await render(<HomeScreen />);

    expect(queryByLabelText('Regl bitişini kaydet')).toBeNull();
  });

  it('offers nothing to record without a profile', async () => {
    repository.loadCycleProfile.mockResolvedValue(null);

    const { queryByLabelText } = await renderScreen();

    expect(queryByLabelText('Regl bitişini kaydet')).toBeNull();
  });
});

describe('HomeScreen straight after onboarding', () => {
  beforeEach(() => {
    repository.loadCycleProfile.mockResolvedValue(onboardingProfile());
  });

  it('offers to record a period start', async () => {
    const { getByLabelText, getByText } = await renderScreen();

    expect(getByLabelText('Regl başlangıcını kaydet')).toBeTruthy();
    expect(getByText('Regl başladı')).toBeTruthy();
  });

  it('does not offer to end anything', async () => {
    const { queryByLabelText, queryByText } = await renderScreen();

    // The onboarding record has no end date, but it is not happening now.
    expect(queryByLabelText('Regl bitişini kaydet')).toBeNull();
    expect(queryByText('Regl bitti')).toBeNull();
  });

  it('still shows the summary and the calendar', async () => {
    const { getByText } = await renderScreen();

    expect(getByText('16. gün')).toBeTruthy();
    expect(getByText('Yumurtlama')).toBeTruthy();
    expect(getByText('Takvim')).toBeTruthy();
  });
});

describe('HomeScreen through a whole period', () => {
  /** Onboarding record plus today, still running. */
  function withOngoingToday(): CycleProfile {
    return {
      settings: { averageCycleLengthDays: 30, averagePeriodLengthDays: 6 },
      periodRecords: [
        { id: 'onboarding-initial-period', startDate: '2026-09-02' as ISODate, isOngoing: false },
        { id: 'period-2026-09-17', startDate: '2026-09-17' as ISODate, isOngoing: true },
      ],
    };
  }

  /** The same, once today has been closed. */
  function withClosedToday(): CycleProfile {
    return {
      settings: { averageCycleLengthDays: 30, averagePeriodLengthDays: 6 },
      periodRecords: [
        { id: 'onboarding-initial-period', startDate: '2026-09-02' as ISODate, isOngoing: false },
        {
          id: 'period-2026-09-17',
          startDate: '2026-09-17' as ISODate,
          endDate: '2026-09-17' as ISODate,
          isOngoing: false,
        },
      ],
    };
  }

  it('offers to end once a start has been recorded', async () => {
    repository.loadCycleProfile
      .mockResolvedValueOnce(onboardingProfile())
      .mockResolvedValueOnce(onboardingProfile())
      .mockResolvedValue(withOngoingToday());

    const screen = await renderScreen();

    await fireEvent.press(screen.getByLabelText('Regl başlangıcını kaydet'));
    await fireEvent.press(screen.getByLabelText('Kaydet'));

    expect(screen.getByText('Regl bitti')).toBeTruthy();
    expect(screen.queryByText('Regl başladı')).toBeNull();
  });

  it('stores the start as ongoing', async () => {
    repository.loadCycleProfile.mockResolvedValue(onboardingProfile());

    const screen = await renderScreen();

    await fireEvent.press(screen.getByLabelText('Regl başlangıcını kaydet'));
    await fireEvent.press(screen.getByLabelText('Kaydet'));

    const [, saved] = repository.saveCycleProfile.mock.calls[0] as [unknown, CycleProfile];

    expect(saved.periodRecords[1]).toEqual({
      id: 'period-2026-09-17',
      startDate: '2026-09-17',
      isOngoing: true,
    });
  });

  it('offers to start again once the period has ended', async () => {
    repository.loadCycleProfile
      .mockResolvedValueOnce(withOngoingToday())
      .mockResolvedValueOnce(withOngoingToday())
      .mockResolvedValue(withClosedToday());

    const screen = await renderScreen();

    await fireEvent.press(screen.getByLabelText('Regl bitişini kaydet'));
    await fireEvent.press(screen.getByLabelText('Kaydet'));

    expect(screen.getByText('Regl başladı')).toBeTruthy();
    expect(screen.queryByText('Regl bitti')).toBeNull();
  });

  it('stores the end with the flag cleared', async () => {
    repository.loadCycleProfile.mockResolvedValue(withOngoingToday());

    const screen = await renderScreen();

    await fireEvent.press(screen.getByLabelText('Regl bitişini kaydet'));
    await fireEvent.press(screen.getByLabelText('Kaydet'));

    const [, saved] = repository.saveCycleProfile.mock.calls[0] as [unknown, CycleProfile];

    expect(saved.periodRecords[1]).toEqual({
      id: 'period-2026-09-17',
      startDate: '2026-09-17',
      endDate: '2026-09-17',
      isOngoing: false,
    });
    // The onboarding record is untouched, end date still unknown.
    expect(saved.periodRecords[0]).toEqual({
      id: 'onboarding-initial-period',
      startDate: '2026-09-02',
      isOngoing: false,
    });
  });
});
