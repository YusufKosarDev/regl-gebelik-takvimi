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
 *
 * ## It is not enough for Turkish at 2.0, and that is where it stops
 *
 * Measured on a device at 1080x2400, with the padding already at zero:
 *
 *   available   131.5 points   142 cell, no padding, less the 2 point ring
 *   "Today"     131            65.5 per unit of scale - fits
 *   "Bugün"     140            69.5 per unit of scale - nine short
 *
 * So the Turkish label wraps at 2.0 and nowhere else, and the row it is in
 * sits a line taller than its neighbours because of it. It is contained -
 * inside the ring, above the band - which is the part that was a defect.
 *
 * The nine points were not found, and the two places left to look were both
 * refused:
 *
 * Thinning the ring at large settings buys five of the nine - a one point
 * border leaves 136.75 - so it does not even solve it, and it spends the only
 * visual weight separating today from the day somebody tapped. That weight is
 * what the word exists to support.
 *
 * Capping the label's own font scale would work. It is also the move this grid
 * refused on purpose, and the reason is in `tab-bar.tsx`: the grid is content
 * somebody turned the setting up to read. Doing it to one label rather than
 * the grid hits the same person on the same screen, more narrowly.
 *
 * A contained wrap in one language at the top setting is cheaper than either.
 * If this is reopened, those are the levers and those are the reasons they
 * were put down - the nine points are real and `maxFontSizeMultiplier` is the
 * obvious thing to reach for.
 */
export function calendarCellSidePadding(fontScale: number): number {
  return Spacing.half * Math.min(1, Math.max(0, 2 - fontScale));
}
