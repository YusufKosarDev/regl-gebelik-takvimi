import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import DailyEntryScreen from '@/app/(app)/daily-entry';
import { emptyDailyEntry } from '@/features/daily-log/domain/catalogues';
import {
  DAILY_CLEARED_MESSAGE,
  DAILY_CLEAR_LABEL,
  DAILY_EMPTY_SELECTION_MESSAGE,
  DAILY_SAVE_FAILED_MESSAGE,
  DAILY_SAVE_LABEL,
  DAILY_SCREEN_TITLE,
  FLOW_SECTION_TITLE,
  MOOD_SECTION_TITLE,
  SYMPTOMS_SECTION_TITLE,
  DAILY_UNSAVED_MESSAGE,
  choiceAccessibilityLabel,
} from '@/features/daily-log/presentation/daily-log-messages';
import type { ISODate } from '@/types/iso-date';

jest.mock('expo-router', () => ({
  useRouter: jest.fn(),
  useLocalSearchParams: jest.fn(),
}));

jest.mock('@/features/daily-log/data/daily-log-repository', () => ({
  loadDailyEntry: jest.fn(),
  saveDailyEntry: jest.fn(),
  clearDailyEntry: jest.fn(),
}));

jest.mock('@/storage/db', () => ({
  openAppDatabase: jest.fn(),
}));

jest.mock('@/shared/logging', () => ({
  logEvent: jest.fn(),
  describeValue: (value: unknown) => String(value),
}));

jest.mock('@/utils/today', () => ({
  getTodayLocalISODate: jest.fn(() => '2026-10-14'),
}));

const repository = jest.requireMock('@/features/daily-log/data/daily-log-repository');
const db = jest.requireMock('@/storage/db');
const routerMock = useRouter as unknown as jest.Mock;
const paramsMock = useLocalSearchParams as unknown as jest.Mock;

const date = (value: string) => value as ISODate;

const flow = (label: string) => choiceAccessibilityLabel(FLOW_SECTION_TITLE, label);
const symptom = (label: string) => choiceAccessibilityLabel(SYMPTOMS_SECTION_TITLE, label);
const mood = (label: string) => choiceAccessibilityLabel(MOOD_SECTION_TITLE, label);

let back: jest.Mock;

beforeEach(() => {
  back = jest.fn();
  routerMock.mockReset();
  routerMock.mockReturnValue({ back, push: jest.fn(), replace: jest.fn() });

  paramsMock.mockReset();
  paramsMock.mockReturnValue({ date: '2026-10-14' });

  db.openAppDatabase.mockReset();
  db.openAppDatabase.mockResolvedValue({});

  repository.loadDailyEntry.mockReset();
  repository.loadDailyEntry.mockResolvedValue(emptyDailyEntry(date('2026-10-14')));
  repository.saveDailyEntry.mockReset();
  repository.saveDailyEntry.mockResolvedValue(undefined);
  repository.clearDailyEntry.mockReset();
  repository.clearDailyEntry.mockResolvedValue(undefined);
});

/** Renders and waits for the first read to land. */
async function renderScreen() {
  const screen = await render(<DailyEntryScreen />);

  await waitFor(() => {
    expect(repository.loadDailyEntry).toHaveBeenCalled();
  });

  return screen;
}

describe('what the screen offers', () => {
  it('names itself and the day', async () => {
    const screen = await renderScreen();

    expect(screen.getByRole('header', { name: DAILY_SCREEN_TITLE })).toBeTruthy();
    expect(screen.getByText(/14 Ekim 2026/)).toBeTruthy();
  });

  it('offers all three sections under headings', async () => {
    const screen = await renderScreen();

    for (const title of [FLOW_SECTION_TITLE, SYMPTOMS_SECTION_TITLE, MOOD_SECTION_TITLE]) {
      expect(screen.getByRole('header', { name: title })).toBeTruthy();
    }
  });

  it('offers four flow levels, ten symptoms and five moods', async () => {
    const screen = await renderScreen();

    expect(screen.queryAllByRole('radio')).toHaveLength(9);
    expect(screen.queryAllByRole('checkbox')).toHaveLength(10);
  });

  it('marks a symptom as a checkbox and a mood as a radio', async () => {
    // What a screen reader announces, and what tells somebody whether a second
    // tap will undo the first.
    const screen = await renderScreen();

    expect(screen.getByLabelText(symptom('Kramp')).props.accessibilityRole).toBe('checkbox');
    expect(screen.getByLabelText(mood('İyi')).props.accessibilityRole).toBe('radio');
  });

  it('says nothing is chosen yet', async () => {
    const screen = await renderScreen();

    expect(screen.getByLabelText(flow('Orta')).props.accessibilityState.checked).toBe(false);
  });
});

describe('choosing', () => {
  it('marks a symptom as chosen', async () => {
    const screen = await renderScreen();

    await fireEvent.press(screen.getByLabelText(symptom('Kramp')));

    expect(screen.getByLabelText(symptom('Kramp')).props.accessibilityState.checked).toBe(true);
  });

  it('keeps several symptoms at once', async () => {
    const screen = await renderScreen();

    await fireEvent.press(screen.getByLabelText(symptom('Kramp')));
    await fireEvent.press(screen.getByLabelText(symptom('Yorgunluk')));

    expect(screen.getByLabelText(symptom('Kramp')).props.accessibilityState.checked).toBe(true);
    expect(screen.getByLabelText(symptom('Yorgunluk')).props.accessibilityState.checked).toBe(true);
  });

  it('replaces the flow rather than adding to it', async () => {
    const screen = await renderScreen();

    await fireEvent.press(screen.getByLabelText(flow('Hafif')));
    await fireEvent.press(screen.getByLabelText(flow('Yoğun')));

    expect(screen.getByLabelText(flow('Hafif')).props.accessibilityState.checked).toBe(false);
    expect(screen.getByLabelText(flow('Yoğun')).props.accessibilityState.checked).toBe(true);
  });

  it('lets a second tap undo a single choice', async () => {
    // Somebody who tapped the wrong mood needs a way back to none without
    // clearing the whole day.
    const screen = await renderScreen();

    await fireEvent.press(screen.getByLabelText(mood('İyi')));
    await fireEvent.press(screen.getByLabelText(mood('İyi')));

    expect(screen.getByLabelText(mood('İyi')).props.accessibilityState.checked).toBe(false);
  });

  it('lets a second tap remove a symptom', async () => {
    const screen = await renderScreen();

    await fireEvent.press(screen.getByLabelText(symptom('Akne')));
    await fireEvent.press(screen.getByLabelText(symptom('Akne')));

    expect(screen.getByLabelText(symptom('Akne')).props.accessibilityState.checked).toBe(false);
  });
});

describe('saving', () => {
  it('writes what was chosen', async () => {
    const screen = await renderScreen();

    await fireEvent.press(screen.getByLabelText(flow('Orta')));
    await fireEvent.press(screen.getByLabelText(symptom('Kramp')));
    await fireEvent.press(screen.getByLabelText(mood('İyi')));
    await fireEvent.press(screen.getByLabelText(DAILY_SAVE_LABEL));

    await waitFor(() => {
      expect(repository.saveDailyEntry).toHaveBeenCalledWith(
        {},
        {
          date: '2026-10-14',
          flowId: 'medium',
          moodId: 'good',
          symptomIds: ['cramps'],
        }
      );
    });
  });

  it('closes the screen once it is written', async () => {
    const screen = await renderScreen();

    await fireEvent.press(screen.getByLabelText(flow('Orta')));
    await fireEvent.press(screen.getByLabelText(DAILY_SAVE_LABEL));

    await waitFor(() => {
      expect(back).toHaveBeenCalledTimes(1);
    });
  });

  it('refuses a save with nothing chosen', async () => {
    // More likely a slip than a decision, and there is a button that says
    // "temizle" for the decision.
    const screen = await renderScreen();

    await fireEvent.press(screen.getByLabelText(DAILY_SAVE_LABEL));

    expect(screen.getByText(DAILY_EMPTY_SELECTION_MESSAGE)).toBeTruthy();
    expect(repository.saveDailyEntry).not.toHaveBeenCalled();
    expect(back).not.toHaveBeenCalled();
  });

  it('clears the refusal as soon as something is chosen', async () => {
    const screen = await renderScreen();

    await fireEvent.press(screen.getByLabelText(DAILY_SAVE_LABEL));
    await fireEvent.press(screen.getByLabelText(flow('Hafif')));

    expect(screen.queryByText(DAILY_EMPTY_SELECTION_MESSAGE)).toBeNull();
  });

  it('says so when the write fails, and stays open', async () => {
    repository.saveDailyEntry.mockRejectedValue(new Error('disk is full'));

    const screen = await renderScreen();

    await fireEvent.press(screen.getByLabelText(flow('Orta')));
    await fireEvent.press(screen.getByLabelText(DAILY_SAVE_LABEL));

    await waitFor(() => {
      expect(screen.getByText(DAILY_SAVE_FAILED_MESSAGE)).toBeTruthy();
    });

    expect(back).not.toHaveBeenCalled();
  });
});

describe('a day that already holds something', () => {
  beforeEach(() => {
    repository.loadDailyEntry.mockResolvedValue({
      date: '2026-10-14',
      flowId: 'heavy',
      moodId: 'bad',
      symptomIds: ['cramps'],
    });
  });

  it('shows what was recorded', async () => {
    const screen = await renderScreen();

    await waitFor(() => {
      expect(screen.getByLabelText(flow('Yoğun')).props.accessibilityState.checked).toBe(true);
    });

    expect(screen.getByLabelText(symptom('Kramp')).props.accessibilityState.checked).toBe(true);
    expect(screen.getByLabelText(mood('Kötü')).props.accessibilityState.checked).toBe(true);
  });

  it('offers to clear it', async () => {
    const screen = await renderScreen();

    await waitFor(() => {
      expect(screen.getByLabelText(DAILY_CLEAR_LABEL)).toBeTruthy();
    });
  });

  it('clears it and says so', async () => {
    const screen = await renderScreen();

    await waitFor(() => {
      expect(screen.getByLabelText(DAILY_CLEAR_LABEL)).toBeTruthy();
    });

    await fireEvent.press(screen.getByLabelText(DAILY_CLEAR_LABEL));

    await waitFor(() => {
      expect(repository.clearDailyEntry).toHaveBeenCalledWith({}, '2026-10-14');
    });

    expect(screen.getByText(DAILY_CLEARED_MESSAGE)).toBeTruthy();
  });
});

describe('a day with nothing in it', () => {
  it('offers nothing to clear', async () => {
    // A button that deletes nothing is a question nobody was asked.
    const screen = await renderScreen();

    expect(screen.queryByLabelText(DAILY_CLEAR_LABEL)).toBeNull();
  });
});

describe('which day is being edited', () => {
  it('follows the date it was given', async () => {
    paramsMock.mockReturnValue({ date: '2026-09-03' });

    await renderScreen();

    expect(repository.loadDailyEntry).toHaveBeenCalledWith({}, '2026-09-03');
  });

  it('falls back to today when the parameter is missing', async () => {
    paramsMock.mockReturnValue({});

    await renderScreen();

    expect(repository.loadDailyEntry).toHaveBeenCalledWith({}, '2026-10-14');
  });

  it('falls back to today when the parameter is not a date', async () => {
    // A malformed link is not a reason to crash or to edit a day that does
    // not exist.
    paramsMock.mockReturnValue({ date: 'yarın' });

    await renderScreen();

    expect(repository.loadDailyEntry).toHaveBeenCalledWith({}, '2026-10-14');
  });
});

describe('what the screen never says', () => {
  it('offers no interpretation of the day', async () => {
    // The scope rule for this iteration: it records and shows, and says
    // nothing back.
    repository.loadDailyEntry.mockResolvedValue({
      date: '2026-10-14',
      flowId: 'heavy',
      moodId: 'very-bad',
      symptomIds: ['cramps', 'headache'],
    });

    const screen = await renderScreen();

    for (const word of ['normal', 'olağan', 'beklenen', 'doktor', 'tavsiye', 'öneri']) {
      expect(screen.queryByText(new RegExp(word, 'i'))).toBeNull();
    }
  });
});

/**
 * The week along the top.
 *
 * Taken from Cycles, where the day being logged is chosen on the log itself
 * rather than in a picker reached from somewhere else. Logging a day late is
 * most of what this screen is for, and it used to mean going back to the
 * calendar to come in again.
 *
 * Today is mocked as Wednesday 14 October 2026, so the week runs Monday the
 * 12th to Sunday the 18th.
 */
describe('the week strip', () => {
  it('offers the days of the week the entry sits in', async () => {
    const screen = await renderScreen();

    expect(screen.getByLabelText('12 Ekim 2026')).toBeTruthy();
    expect(screen.getByLabelText('18 Ekim 2026')).toBeTruthy();
  });

  it('marks the day being edited', async () => {
    const screen = await renderScreen();

    expect(screen.getByLabelText('14 Ekim 2026').props.accessibilityState.selected).toBe(true);
    expect(screen.getByLabelText('12 Ekim 2026').props.accessibilityState.selected).toBe(false);
  });

  it('reads another day when one is pressed', async () => {
    const screen = await renderScreen();

    await fireEvent.press(screen.getByLabelText('12 Ekim 2026'));

    await waitFor(() => {
      expect(repository.loadDailyEntry).toHaveBeenCalledWith(expect.anything(), '2026-10-12');
    });
  });

  it('will not move away from work that is not saved, and says why', async () => {
    // The whole reason the comparison in `holdsSameAs` exists. Moving replaces
    // everything on screen, and doing that to somebody who has just ticked a
    // symptom is losing their work without telling them.
    const screen = await renderScreen();

    await fireEvent.press(screen.getByLabelText(symptom('Kramp')));
    await fireEvent.press(screen.getByLabelText('12 Ekim 2026'));

    expect(screen.getByText(DAILY_UNSAVED_MESSAGE)).toBeTruthy();
    expect(repository.loadDailyEntry).not.toHaveBeenCalledWith(expect.anything(), '2026-10-12');
    expect(screen.getByLabelText('14 Ekim 2026').props.accessibilityState.selected).toBe(true);
  });

  it('moves once the work is put back the way it was read', async () => {
    // Ticking and unticking is not unsaved work. Without this the strip locks
    // for the rest of the visit after any stray tap.
    const screen = await renderScreen();

    await fireEvent.press(screen.getByLabelText(symptom('Kramp')));
    await fireEvent.press(screen.getByLabelText(symptom('Kramp')));
    await fireEvent.press(screen.getByLabelText('12 Ekim 2026'));

    await waitFor(() => {
      expect(repository.loadDailyEntry).toHaveBeenCalledWith(expect.anything(), '2026-10-12');
    });
  });
});

describe('what each section is for', () => {
  const FLOW_EXPLANATION = 'Kanamanın o günkü yoğunluğu. Tek seçim yapabilirsin.';
  const SYMPTOMS_EXPLANATION = 'O gün fark ettiklerin. Birden fazla seçebilirsin.';

  it('says nothing until it is asked', async () => {
    const screen = await renderScreen();

    expect(screen.queryByText(FLOW_EXPLANATION)).toBeNull();
  });

  it('explains the section when its chevron is pressed', async () => {
    // What this sentence is carrying is that the section takes one answer.
    // The app says that to a screen reader and to nobody else.
    const screen = await renderScreen();

    await fireEvent.press(screen.getByLabelText(`${FLOW_SECTION_TITLE} hakkında`));

    expect(screen.getByText(FLOW_EXPLANATION)).toBeTruthy();
  });

  it('folds the first one when a second is opened', async () => {
    const screen = await renderScreen();

    await fireEvent.press(screen.getByLabelText(`${FLOW_SECTION_TITLE} hakkında`));
    await fireEvent.press(screen.getByLabelText(`${SYMPTOMS_SECTION_TITLE} hakkında`));

    expect(screen.queryByText(FLOW_EXPLANATION)).toBeNull();
    expect(screen.getByText(SYMPTOMS_EXPLANATION)).toBeTruthy();
  });

  it('folds again when its own chevron is pressed twice', async () => {
    const screen = await renderScreen();

    await fireEvent.press(screen.getByLabelText(`${FLOW_SECTION_TITLE} hakkında`));
    await fireEvent.press(screen.getByLabelText(`${FLOW_SECTION_TITLE} hakkında`));

    expect(screen.queryByText(FLOW_EXPLANATION)).toBeNull();
  });
});

describe('where the strip says no', () => {
  it('puts the reason beside the strip, not at the foot of the form', async () => {
    // Found on a device: the refusal was rendered above the save button, two
    // screens below the strip that caused it. The strip did not move, nothing
    // appeared to happen, and the explanation was off-screen.
    const screen = await renderScreen();

    await fireEvent.press(screen.getByLabelText(symptom('Kramp')));
    await fireEvent.press(screen.getByLabelText('12 Ekim 2026'));

    expect(screen.getByTestId('strip-notice')).toHaveTextContent(DAILY_UNSAVED_MESSAGE);
  });

  it('leaves the foot of the form for what happens down there', async () => {
    // The save and clear outcomes stay where the buttons are. Only the
    // refusal moves, because only it is answering a press at the top.
    const screen = await renderScreen();

    await fireEvent.press(screen.getByLabelText(symptom('Kramp')));
    await fireEvent.press(screen.getByLabelText('12 Ekim 2026'));

    expect(screen.queryAllByText(DAILY_UNSAVED_MESSAGE)).toHaveLength(1);
  });
});
