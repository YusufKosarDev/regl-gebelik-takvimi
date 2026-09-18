import type {
  PregnancyContentSize,
  PregnancyContentSource,
  PregnancyWeeklyContent,
} from './types';

/**
 * The weeks a pregnancy is written about.
 *
 * Week 1 starts at the last menstrual period, and 40 is the week the due date
 * falls in — 280 days is exactly 40 weeks. Pregnancies do run past it, but a
 * week with nothing written for it is the lookup's `null` rather than a number
 * this range has to stretch to cover.
 */
export const MIN_PREGNANCY_WEEK = 1;
export const MAX_PREGNANCY_WEEK = 40;

function assertWeek(caller: string, week: number): void {
  if (!Number.isInteger(week)) {
    throw new Error(`${caller} expects a whole week number, received ${week}.`);
  }

  if (week < MIN_PREGNANCY_WEEK || week > MAX_PREGNANCY_WEEK) {
    throw new Error(
      `${caller} expects a week between ${MIN_PREGNANCY_WEEK} and ${MAX_PREGNANCY_WEEK}, ` +
        `received ${week}.`
    );
  }
}

function assertText(week: number, field: string, value: string): void {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(
      `PregnancyWeeklyContent for week ${week} has a blank ${field}: ${JSON.stringify(value)}.`
    );
  }
}

/**
 * Checks a week's size, when it has one.
 *
 * A week with no size is valid and skipped: the earliest weeks have nothing to
 * measure, and saying nothing is the honest answer there. A size that is present
 * has to be complete, because half a comparison reads as a mistake rather than
 * as restraint.
 */
function assertSize(week: number, size: PregnancyContentSize | undefined): void {
  if (size === undefined) {
    return;
  }

  if (typeof size !== 'object' || size === null || Array.isArray(size)) {
    throw new Error(
      `PregnancyWeeklyContent for week ${week} has a size that is not an object: ` +
        `${JSON.stringify(size)}.`
    );
  }

  assertText(week, 'size.label', size.label);
  assertText(week, 'size.comparison', size.comparison);
}

/**
 * A link someone could actually follow.
 *
 * Only the scheme is checked, and only for the two that can be opened: anything
 * stricter would start rejecting real URLs over punctuation. A scheme with
 * nothing after it names nothing, so it counts as blank rather than as a URL.
 */
function isFollowableUrl(value: string): boolean {
  return /^https?:\/\/.+/.test(value.trim());
}

/**
 * Checks where one week's content came from.
 *
 * At least one source, because this is text about someone's pregnancy and a
 * claim with nothing behind it should not be showable. The same URL twice is
 * refused too — it is one source listed twice, which reads as more corroboration
 * than there is.
 */
function assertSources(week: number, sources: readonly PregnancyContentSource[]): void {
  if (!Array.isArray(sources)) {
    throw new Error(
      `PregnancyWeeklyContent for week ${week} has a non-array sources: ` +
        `${JSON.stringify(sources)}.`
    );
  }

  if (sources.length === 0) {
    throw new Error(`PregnancyWeeklyContent for week ${week} cites no sources.`);
  }

  const seenUrls = new Set<string>();

  sources.forEach((source, index) => {
    assertText(week, `sources[${index}].name`, source?.name);
    assertText(week, `sources[${index}].url`, source?.url);

    if (!isFollowableUrl(source.url)) {
      throw new Error(
        `PregnancyWeeklyContent for week ${week} has a sources[${index}].url that is not ` +
          `an http or https address: ${JSON.stringify(source.url)}.`
      );
    }

    const url = source.url.trim();

    if (seenUrls.has(url)) {
      throw new Error(
        `PregnancyWeeklyContent for week ${week} cites ${JSON.stringify(url)} more than once.`
      );
    }

    seenUrls.add(url);
  });
}

/**
 * Checks one week's content, throwing on the first rule it breaks.
 *
 * Blank text is refused rather than tolerated: a field that renders as an empty
 * line is worse than one that was never there, and it is easier to catch here
 * than to notice on a screen.
 *
 * Pure: nothing is mutated and the content is read exactly as given.
 */
export function validatePregnancyWeeklyContent(content: PregnancyWeeklyContent): void {
  assertWeek('PregnancyWeeklyContent', content.week);

  assertSize(content.week, content.size);
  assertText(content.week, 'developmentSummary', content.developmentSummary);

  if (!Array.isArray(content.developingFeatures)) {
    throw new Error(
      `PregnancyWeeklyContent for week ${content.week} has a non-array developingFeatures: ` +
        `${JSON.stringify(content.developingFeatures)}.`
    );
  }

  // A week with nothing developing is not a week worth showing a list for.
  if (content.developingFeatures.length === 0) {
    throw new Error(
      `PregnancyWeeklyContent for week ${content.week} lists no developing features.`
    );
  }

  content.developingFeatures.forEach((feature, index) => {
    assertText(content.week, `developingFeatures[${index}]`, feature);
  });

  assertSources(content.week, content.sources);
}

/**
 * The content written for `week`, or `null` when none is.
 *
 * An exact match only: week 9 is not answered with week 8's text, because a
 * nearby week is a different week and saying otherwise would be inventing
 * medical content.
 *
 * Two entries for the same week is corruption rather than a choice to make —
 * picking one silently would show text nobody could account for — so it throws.
 * A week outside the range throws as well, since that is a caller asking the
 * wrong question rather than a week that happens to be unwritten.
 *
 * Pure: the list is read, never sorted or mutated.
 */
export function getPregnancyWeeklyContent(
  contents: readonly PregnancyWeeklyContent[],
  week: number
): PregnancyWeeklyContent | null {
  assertWeek('getPregnancyWeeklyContent', week);

  const matches = contents.filter((content) => content.week === week);

  if (matches.length > 1) {
    throw new Error(
      `getPregnancyWeeklyContent found ${matches.length} entries for week ${week}; ` +
        'at most 1 is valid.'
    );
  }

  return matches.length === 0 ? null : matches[0];
}
