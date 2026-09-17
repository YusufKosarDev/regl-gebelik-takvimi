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
    const { getAllByText, getByText } = await renderScreen();

    // Twice on purpose: the summary header, and the label inside today's square.
    expect(getAllByText('Bugün')).toHaveLength(2);
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

  it('offers only the two month steps to tap', async () => {
    repository.loadCycleProfile.mockResolvedValue(profile());

    const { queryAllByRole } = await renderScreen();

    // Nothing else on the screen is pressable: no day cells, no summary rows.
    expect(
      queryAllByRole('button').map((node) => node.props.accessibilityLabel as string)
    ).toEqual(['Önceki ay', 'Sonraki ay']);
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
    const { getByText } = await renderScreen();

    expect(getByText('17 Eylül 2026')).toBeTruthy();
    expect(getByText('17. gün')).toBeTruthy();
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

  it('offers no day selection', async () => {
    const { queryAllByRole, getByTestId } = await renderScreen();

    // The month steps are the only controls; a day cell is not pressable.
    expect(queryAllByRole('button')).toHaveLength(2);
    expect(getByTestId('calendar-day-2026-09-17').props.onClick).toBeUndefined();
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

    expect(getByTestId('calendar-day-2026-09-17').props.accessibilityLabel).toBe(
      '17 Eylül 2026, bugün'
    );
  });

  it('follows the date the use case reported', async () => {
    getTodayMock.mockReturnValue('2026-09-14' as ISODate);

    const { getByTestId, queryByTestId } = await renderScreen();

    expect(getByTestId('calendar-today-2026-09-14')).toBeTruthy();
    expect(queryByTestId('calendar-today-2026-09-17')).toBeNull();
    // The cycle state survives the highlight.
    expect(getByTestId('calendar-day-2026-09-14').props.accessibilityLabel).toBe(
      '14 Eylül 2026, Yumurtlama, doğurganlık en yüksek, bugün'
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
