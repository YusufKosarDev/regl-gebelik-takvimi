import { fireEvent, render } from '@testing-library/react-native';

import { DailyEntryCard } from '../components/daily-entry-card';
import type { DailyEntry } from '../domain/catalogues';
import { emptyDailyEntry } from '../domain/catalogues';
import {
  DAILY_CARD_ADD_LABEL,
  DAILY_CARD_EDIT_LABEL,
  DAILY_CARD_EMPTY_HINT,
  DAILY_CARD_EMPTY_TITLE,
  DAILY_CARD_FILLED_TITLE,
} from '../presentation/daily-log-messages';

import type { ISODate } from '@/types/iso-date';

const date = (value: string) => value as ISODate;

const TODAY = date('2026-10-14');

function entry(overrides: Partial<DailyEntry> = {}): DailyEntry {
  return { ...emptyDailyEntry(TODAY), ...overrides };
}

describe('before anything is recorded', () => {
  it('asks rather than reporting', async () => {
    const screen = await render(<DailyEntryCard entry={emptyDailyEntry(TODAY)} onOpen={jest.fn()} />);

    expect(screen.getByText(DAILY_CARD_EMPTY_TITLE)).toBeTruthy();
    expect(screen.getByText(DAILY_CARD_EMPTY_HINT)).toBeTruthy();
  });

  it('offers to add', async () => {
    const screen = await render(<DailyEntryCard entry={emptyDailyEntry(TODAY)} onOpen={jest.fn()} />);

    expect(screen.getByLabelText(DAILY_CARD_ADD_LABEL)).toBeTruthy();
    expect(screen.queryByLabelText(DAILY_CARD_EDIT_LABEL)).toBeNull();
  });
});

describe('once something is recorded', () => {
  it('names the flow', async () => {
    const screen = await render(
      <DailyEntryCard entry={entry({ flowId: 'medium' })} onOpen={jest.fn()} />
    );

    expect(screen.getByText(/Orta/)).toBeTruthy();
  });

  it('counts the symptoms rather than listing them', async () => {
    // Three names would not fit on one line, and the card is not the place to
    // read them.
    const screen = await render(
      <DailyEntryCard
        entry={entry({ symptomIds: ['cramps', 'fatigue', 'acne'] })}
        onOpen={jest.fn()}
      />
    );

    expect(screen.getByText(/3 belirti/)).toBeTruthy();
  });

  it('names the mood', async () => {
    const screen = await render(
      <DailyEntryCard entry={entry({ moodId: 'good' })} onOpen={jest.fn()} />
    );

    expect(screen.getByText(/İyi/)).toBeTruthy();
  });

  it('puts them in one line, flow then symptoms then mood', async () => {
    const screen = await render(
      <DailyEntryCard
        entry={entry({ flowId: 'medium', moodId: 'good', symptomIds: ['cramps'] })}
        onOpen={jest.fn()}
      />
    );

    expect(screen.getByText('Orta · 1 belirti · İyi')).toBeTruthy();
  });

  it('offers to edit rather than to add', async () => {
    const screen = await render(
      <DailyEntryCard entry={entry({ flowId: 'light' })} onOpen={jest.fn()} />
    );

    expect(screen.getByLabelText(DAILY_CARD_EDIT_LABEL)).toBeTruthy();
    expect(screen.queryByLabelText(DAILY_CARD_ADD_LABEL)).toBeNull();
  });

  it('changes its heading', async () => {
    const screen = await render(
      <DailyEntryCard entry={entry({ flowId: 'light' })} onOpen={jest.fn()} />
    );

    expect(screen.getByText(DAILY_CARD_FILLED_TITLE)).toBeTruthy();
  });

  it('skips a part whose id no catalogue knows', async () => {
    // A day written by a newer build. One fewer word is better than an id on
    // a card.
    const screen = await render(
      <DailyEntryCard
        entry={entry({ flowId: 'from-a-newer-build', moodId: 'good' })}
        onOpen={jest.fn()}
      />
    );

    expect(screen.getByText('İyi')).toBeTruthy();
    expect(screen.queryByText(/from-a-newer-build/)).toBeNull();
  });
});

describe('what the card never does', () => {
  it('says nothing about what the day means', async () => {
    // The scope rule, asserted rather than trusted: this iteration records and
    // shows. No interpretation, no comparison, nothing about what is usual.
    const screen = await render(
      <DailyEntryCard
        entry={entry({ flowId: 'heavy', moodId: 'very-bad', symptomIds: ['cramps'] })}
        onOpen={jest.fn()}
      />
    );

    for (const word of ['normal', 'olağan', 'beklenen', 'yüksek', 'düşük', 'doktor']) {
      expect(screen.queryByText(new RegExp(word, 'i'))).toBeNull();
    }
  });
});

describe('opening the day', () => {
  it('calls back when the button is pressed', async () => {
    const onOpen = jest.fn();
    const screen = await render(<DailyEntryCard entry={emptyDailyEntry(TODAY)} onOpen={onOpen} />);

    await fireEvent.press(screen.getByLabelText(DAILY_CARD_ADD_LABEL));

    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it('marks its heading as a heading', async () => {
    const screen = await render(<DailyEntryCard entry={emptyDailyEntry(TODAY)} onOpen={jest.fn()} />);

    expect(screen.getByRole('header', { name: DAILY_CARD_EMPTY_TITLE })).toBeTruthy();
  });
});
