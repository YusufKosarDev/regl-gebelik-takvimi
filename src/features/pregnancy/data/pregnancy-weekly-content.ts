import type { PregnancyContentSource, PregnancyWeeklyContent } from '../domain/types';

/**
 * Written content for the weeks of a pregnancy.
 *
 * Weeks 1 to 10 so far. A week is added when there is a source that supports
 * what it would say, not to fill the table: `getPregnancyWeeklyContent` answers
 * `null` for a week that is not here, which is the honest answer.
 *
 * Every entry cites where its claims come from, and the Turkish text is written
 * from the source rather than copied out of it. Nothing is stated that the cited
 * pages do not support.
 *
 * From week 4 on, the NHS week-by-week guide is the primary source: the sizes
 * and which week each development is attributed to follow it. Cleveland Clinic
 * is cited alongside as corroboration for the same stage. The two do not always
 * put a milestone in exactly the same week — week-by-week guides rarely do — so
 * where they differ, the week here is the NHS one.
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

/** The NHS page for one week, which is where that week's size and stage come from. */
function nhsWeek(week: number): PregnancyContentSource {
  return {
    name: `NHS — You and your baby at ${week} weeks pregnant`,
    url: `https://www.nhs.uk/pregnancy/week-by-week/1-to-12/${week}-weeks/`,
  };
}

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
  {
    week: 4,
    size: { label: 'yaklaşık 2 mm', comparison: 'haşhaş tohumu' },
    developmentSummary:
      'Embriyo, içi sıvı dolu amniyotik kesenin içinde gelişir ve beslenmesini yolk ' +
      'kesesinden sağlar. İç hücreler katmanlara ayrılır; her katman ilerideki farklı ' +
      'organ sistemlerine dönüşecektir.',
    developingFeatures: [
      'Embriyo amniyotik kesenin içinde gelişir',
      'Beslenme yolk kesesinden sağlanır',
      'İç hücreler üç katmana ayrılır',
    ],
    sources: [nhsWeek(4), CLEVELAND_CLINIC],
  },
  {
    week: 5,
    size: { label: 'yaklaşık 2 mm', comparison: 'susam tohumu' },
    developmentSummary:
      'Sinir sistemi gelişmeye başlar; beyin ve omurilik şekillenir. Küçük kalp ' +
      'oluşmaya başlar ve bu sıralarda ilk kez atar.',
    developingFeatures: [
      'Beyin ve omurilik şekillenmeye başlar',
      'Kalp oluşur ve ilk kez atar',
      'Göbek kordonunu oluşturacak kan damarları belirir',
    ],
    sources: [nhsWeek(5), CLEVELAND_CLINIC],
  },
  {
    week: 6,
    size: { label: 'yaklaşık 6 mm', comparison: 'bezelye tanesi' },
    developmentSummary:
      'Gelişim hızlanır: kol ve bacakların yerinde uzuv tomurcukları belirir, ' +
      'kulakların olacağı yerde küçük çukurlar oluşur. Karaciğer, beyin ve ' +
      'kas-iskelet sistemi gelişmeye devam eder.',
    developingFeatures: [
      'Kol ve bacak tomurcukları belirir',
      'Kulakların yerinde küçük çukurlar oluşur',
      'Karaciğer, beyin ve kas-iskelet sistemi gelişir',
    ],
    sources: [nhsWeek(6), CLEVELAND_CLINIC],
  },
  {
    week: 7,
    size: { label: 'yaklaşık 10 mm', comparison: 'üzüm tanesi' },
    developmentSummary:
      'Beyin vücudun geri kalanından daha hızlı büyür. Göz kapakları oluşmaya başlar, ' +
      'uzuv tomurcuklarında ise kolların ve bacakların kemiklerini oluşturacak kıkırdak ' +
      'belirir.',
    developingFeatures: [
      'Beyin vücuttan daha hızlı büyür',
      'Göz kapakları oluşmaya başlar',
      'Uzuv tomurcuklarında kıkırdak oluşur',
    ],
    sources: [nhsWeek(7), CLEVELAND_CLINIC],
  },
  {
    week: 8,
    size: { label: 'yaklaşık 16 mm', comparison: 'ahududu' },
    developmentSummary:
      'Bu sıralarda embriyo artık fetüs olarak adlandırılır. Üst gövde alt gövdeden ' +
      'daha hızlı büyüdüğü için kollar bacaklardan daha uzundur.',
    developingFeatures: [
      'Embriyo artık fetüs olarak adlandırılır',
      'Kollar bacaklardan daha hızlı uzar',
      'Plasenta rahim duvarına tutunacak dallar geliştirir',
    ],
    sources: [nhsWeek(8), CLEVELAND_CLINIC],
  },
  {
    week: 9,
    size: { label: 'yaklaşık 22 mm', comparison: 'çilek' },
    developmentSummary:
      'Yüz daha tanıdık hale gelir: göz kapaklarıyla korunan gözler, küçük bir ağız ve ' +
      'tat tomurcukları olan bir dil oluşur. Başlıca iç organlar gelişirken kemikler de ' +
      'oluşmaya başlar.',
    developingFeatures: [
      'Yüz hatları belirginleşir, ağızda tat tomurcukları oluşur',
      'El ve ayaklarda parmakların yerinde oluklar bulunur',
      'Başlıca iç organlar gelişir ve kemikler oluşmaya başlar',
    ],
    sources: [nhsWeek(9), CLEVELAND_CLINIC],
  },
  {
    week: 10,
    size: { label: 'yaklaşık 30 mm', comparison: 'küçük kayısı' },
    developmentSummary:
      'Baş hâlâ gövdeye göre büyüktür ama yüz daha orantılı görünür. Gözler yarı ' +
      'kapalıdır ve ışığa tepki verebilir; çene kemiği şekillenirken süt dişlerinin ' +
      'taslakları oluşur.',
    developingFeatures: [
      'Yüz hatları daha orantılı hale gelir',
      'Gözler ışığa tepki verir',
      'Çene kemiği ve süt dişlerinin taslakları oluşur',
    ],
    sources: [nhsWeek(10), CLEVELAND_CLINIC],
  },
] as const;
