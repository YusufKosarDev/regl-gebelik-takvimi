import { Spacing } from '@/constants/theme';

/**
 * How much air a calendar square keeps either side of its ring.
 *
 * ## Why it is not a constant
 *
 * The column is `14.2857%` of the grid, so a square is the same width at every
 * font setting - measured on a device, 142 points at 1.0 and at 2.0 alike. The
 * text inside it is not. At Android's largest setting "Today" needs about 131
 * points and the square offers 121: eleven short, out of a gap that is four
 * points of padding and four of ring border.
 *
 * Height was given to the text by letting the square grow. Width cannot be,
 * because the grid is seven columns and must stay seven columns to be a month.
 * So the air is what is spent, and the person who loses it is the one who
 * turned the setting up to read the grid - who gets the word whole in exchange.
 *
 * ## Why it tapers
 *
 * Switching the padding off past a threshold would make adjacent rings touch
 * suddenly, at one setting, for no reason a person could see. Falling away as
 * the text grows keeps some air for as long as there is room for it, and
 * reaches nothing only at the top of the range.
 *
 * Linear from the full gap at 1.0 to none at 2.0, and clamped at both ends: a
 * device reporting a scale above 2 gets no padding rather than a negative one,
 * which React Native would draw as an overlap.
 */
export function calendarCellSidePadding(fontScale: number): number {
  return Spacing.half * Math.min(1, Math.max(0, 2 - fontScale));
}
