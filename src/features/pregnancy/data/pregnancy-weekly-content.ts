import type { PregnancyWeeklyContent } from '../domain/types';

/**
 * Written content for the weeks of a pregnancy.
 *
 * Only weeks 1 to 3 so far. A week is added when there is a source that
 * supports what it would say, not to fill the table: `getPregnancyWeeklyContent`
 * answers `null` for a week that is not here, which is the honest answer.
 *
 * Every entry cites where its claims come from, and the Turkish text is written
 * from the source rather than copied out of it. Nothing is stated that the cited
 * page does not support.
 *
 * Weeks 1 to 3 carry no `size` on purpose. Gestational age is counted from the
 * last menstrual period, so week 1 precedes conception entirely and week 3 is
 * where a zygote first exists — there is nothing yet whose size is worth
 * stating, and inventing a figure would be worse than leaving it out.
 */

const CLEVELAND_CLINIC = {
  name: 'Cleveland Clinic — Fetal Development: Week-by-Week Stages of Pregnancy',
  url: 'https://my.clevelandclinic.org/health/articles/7247-fetal-development-stages-of-growth',
} as const;

export const PREGNANCY_WEEKLY_CONTENT: readonly PregnancyWeeklyContent[] = [
  {
    week: 1,
    developmentSummary:
      'Gebelik yaşı, son regl döneminin ilk gününden itibaren sayılır. Bu nedenle ilk ' +
      'haftada henüz döllenme gerçekleşmemiştir; vücut olası bir gebeliğe hazırlanmaya ' +
      'başlar.',
    developingFeatures: [
      'Gebelik yaşı son regl döneminin ilk gününden sayılır',
      'Hormon düzeyleri kademeli olarak yükselir',
      'Rahim olası bir gebeliğe hazırlanır',
    ],
    sources: [CLEVELAND_CLINIC],
  },
  {
    week: 2,
    developmentSummary:
      'Vücudun hazırlığı sürer. Döngünün ortasına doğru olgunlaşan folikül açılarak ' +
      'yumurtayı yumurtalıktan salar; bu ovulasyondur.',
    developingFeatures: [
      'Rahmin hazırlanması sürer',
      'Olgunlaşan folikül yumurtayı salar',
      'Döngünün ortasında ovulasyon gerçekleşir',
    ],
    sources: [CLEVELAND_CLINIC],
  },
  {
    week: 3,
    developmentSummary:
      'Döllenme bu hafta gerçekleşir. Bir sperm ile yumurta birleşerek zigotu oluşturur; ' +
      'zigot bölünerek rahme doğru ilerler.',
    developingFeatures: [
      'Sperm ve yumurta birleşerek zigotu oluşturur',
      'Zigot bölünmeye başlar',
      'Zigot rahme doğru ilerler',
    ],
    sources: [CLEVELAND_CLINIC],
  },
] as const;
