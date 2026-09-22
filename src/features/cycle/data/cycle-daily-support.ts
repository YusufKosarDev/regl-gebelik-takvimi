import type { CycleDailySupport, CycleSupportSource } from '../domain/daily-support';

/**
 * Written content for the four cycle phases.
 *
 * Every phase cites where its text comes from, and the Turkish is written from
 * the sources rather than copied out of them. Nothing is stated that the cited
 * pages do not support.
 *
 * The sources describe the cycle in halves and in weeks, not in the four phases
 * this app names, so the mapping is stated here rather than left implicit: the
 * Office on Women's Health "first half (weeks 1 and 2)" covers the menstrual and
 * follicular phases, and its "second half" together with weeks 3 and 4 of the
 * physical activity page covers the luteal phase. Where a claim belongs to a
 * half rather than to one phase, it is only written for the phase the source
 * actually describes.
 *
 * The ovulatory phase carries no `moodLabels`, and that is the point rather than
 * an omission. Neither page isolates ovulation's effect on mood or energy: the
 * health page only ever refers to the second half "beginning with ovulation",
 * and the physical activity page places the tired, sluggish stretch in week 3,
 * after it. The popular "energetic, cheerful ovulation" label has nothing behind
 * it in these sources, so it is not written. The phase keeps its support
 * message, which says so plainly.
 *
 * The luteal text is hedged for the same reason the NHS hedges it: PMS symptoms
 * differ between people and between months, so they are offered as things some
 * people notice and never as a description of the reader.
 */

const OWH_CYCLE_HEALTH: CycleSupportSource = {
  name: "Office on Women's Health — Your menstrual cycle and your health",
  url: 'https://womenshealth.gov/menstrual-cycle/your-menstrual-cycle-and-your-health',
};

const OWH_PHYSICAL_ACTIVITY: CycleSupportSource = {
  name: "Office on Women's Health — Physical activity and your menstrual cycle",
  url: 'https://womenshealth.gov/getting-active/physical-activity-menstrual-cycle',
};

const NHS_PMS: CycleSupportSource = {
  name: 'NHS — Premenstrual syndrome (PMS)',
  url: 'https://www.nhs.uk/conditions/pre-menstrual-syndrome/',
};

export const CYCLE_DAILY_SUPPORT: readonly CycleDailySupport[] = [
  {
    phase: 'menstrual',
    // Both labels are the source's own hedges. The physical activity page puts
    // week 1 as possibly easier to move in than the weeks before it, which is a
    // comparison rather than a promise that the days feel good.
    moodLabels: [
      'Kramplar olabilir',
      'Harekete geçmek önceki haftalara göre kolaylaşabilir',
    ],
    supportMessage:
      'Bu günlerde hafif bir yürüyüş bazı kişilere iyi gelebilir. Nasıl hissettiğin ' +
      'kişiden kişiye değişir; kendine alan tanı.',
    sources: [OWH_PHYSICAL_ACTIVITY, OWH_CYCLE_HEALTH],
  },
  {
    phase: 'follicular',
    // The first half of the cycle is where the health page puts higher energy, a
    // sharper memory and a higher pain tolerance, all as "might" and "may".
    moodLabels: [
      'Enerji biraz daha yüksek olabilir',
      'Hafıza daha açık olabilir',
      'Ağrı eşiği daha yüksek olabilir',
    ],
    supportMessage:
      'Enerjin yerindeyse keyif aldığın şeylere zaman ayırmak için uygun bir aralık ' +
      'olabilir. Herkeste böyle olmayabilir.',
    sources: [OWH_CYCLE_HEALTH, OWH_PHYSICAL_ACTIVITY],
  },
  {
    phase: 'ovulatory',
    // No moodLabels on purpose: see the note at the top of the file.
    supportMessage:
      'Yumurtlama günlerinde ruh halinin nasıl olacağına dair kaynaklarda net bir bilgi ' +
      'yok. Kendini nasıl hissediyorsan o geçerli.',
    sources: [OWH_CYCLE_HEALTH, OWH_PHYSICAL_ACTIVITY],
  },
  {
    phase: 'luteal',
    // The health page's sluggish, forgetful second half and its serotonin-driven
    // cravings, plus the NHS list of common PMS symptoms. The NHS says symptoms
    // differ between people and between months, so each label stays an "olabilir".
    moodLabels: [
      'Yorgunluk veya ağırlık hissi olabilir',
      'Unutkanlık olabilir',
      'Ruh hali dalgalanmaları olabilir',
      'Tatlı ya da unlu yiyeceklere istek artabilir',
      'Uykuya dalmak zorlaşabilir',
    ],
    supportMessage:
      'Regl öncesi günlerde belirtiler herkeste aynı değildir, aydan aya da değişebilir. ' +
      'Hareket, uyku ve kendine nazik davranmak bazı kişilere iyi gelebilir.',
    sources: [NHS_PMS, OWH_CYCLE_HEALTH, OWH_PHYSICAL_ACTIVITY],
  },
] as const;
