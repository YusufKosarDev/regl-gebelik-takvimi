import type { PregnancyContentSource, PregnancyWeeklyContent } from '../domain/types';

/**
 * Written content for the weeks of a pregnancy.
 *
 * All 40 weeks. A week was added when there was a source that supports what it
 * says, not to fill the table; `getPregnancyWeeklyContent` still answers `null`
 * beyond week 40, which is where the sources stop.
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
 * The NHS does not measure the same way throughout, and says so on the pages:
 * lengths are given "from head to bottom" up to week 19, "from head to toe" in
 * weeks 21 and 22, and "from head to heel" from week 23 on. Week 20 is given
 * with no qualifier at all. The figures here are recorded as each page states
 * them, which is why they jump between week 19 and week 21; no attempt is made
 * to convert them to a common basis or to explain a change the source does not.
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

/**
 * The NHS page for one week, which is where that week's size and stage come
 * from.
 *
 * The guide is split into three ranges, so the path depends on the week.
 */
function nhsWeek(week: number): PregnancyContentSource {
  const range = week <= 12 ? '1-to-12' : week <= 27 ? '13-to-27' : '28-to-40-plus';

  return {
    name: `NHS — You and your baby at ${week} weeks pregnant`,
    url: `https://www.nhs.uk/pregnancy/week-by-week/${range}/${week}-weeks/`,
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
      'Ovulasyon çoğunlukla döngünün ortasına yakın gerçekleşir',
    ],
    sources: [CLEVELAND_CLINIC],
  },
  {
    week: 3,
    developmentSummary:
      'Döllenme genellikle bu haftalarda gerçekleşir. Bir sperm ile yumurta birleşerek ' +
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
  {
    week: 11,
    size: { label: 'yaklaşık 41 mm', comparison: 'incir' },
    developmentSummary:
      'El ve ayak parmakları birbirinden ayrılır; küçük tırnaklar ve kulaklar belirir. ' +
      'Baş gövdeye göre hâlâ büyüktür ama gövde hızla büyür.',
    developingFeatures: [
      'El ve ayak parmakları birbirinden ayrılır',
      'Küçük tırnaklar ve kulaklar belirir',
      'Plasenta beslenmeyi yolk kesesinden devralmak üzeredir',
    ],
    sources: [nhsWeek(11), CLEVELAND_CLINIC],
  },
  {
    week: 12,
    size: { label: 'yaklaşık 5,4 cm', comparison: 'erik' },
    developmentSummary:
      'İç organlar ve kaslar gelişmiştir; kalp atışı ultrason taramasında duyulabilir. ' +
      'İskelet dokudan kemiğe dönüşerek sertleşir.',
    developingFeatures: [
      'İç organlar ve kaslar gelişir',
      'Kalp atışı ultrasonda duyulabilir',
      'İskelet sertleşerek kemikleşir',
    ],
    sources: [nhsWeek(12), CLEVELAND_CLINIC],
  },
  {
    week: 13,
    size: { label: 'yaklaşık 7,4 cm', comparison: 'şeftali' },
    developmentSummary:
      'Yumurtalıklar ya da testisler içeride tamamlanmıştır. Bebek hareket eder; ' +
      'başlangıçta rastgele olan hareketler giderek daha amaçlı görünür.',
    developingFeatures: [
      'Yumurtalıklar ya da testisler içeride tamamlanır',
      'Hareketler rastgeleyken giderek amaçlı hale gelir',
      'Bazı bebekler parmak emerek emme refleksini geliştirir',
    ],
    sources: [nhsWeek(13), CLEVELAND_CLINIC],
  },
  {
    week: 14,
    size: { label: 'yaklaşık 8,5 cm', comparison: 'kivi' },
    developmentSummary:
      'Baş yuvarlaklaşır ve gövdeyle daha orantılı hale gelir. Yutulan az miktarda ' +
      'amniyon sıvısı böbreklerden geçerek idrar olarak geri verilir.',
    developingFeatures: [
      'Baş gövdeyle daha orantılı hale gelir',
      'Amniyon sıvısı yutulur ve böbrekler çalışmaya başlar',
      'Kalp atışı el tipi cihazla duyulabilir',
    ],
    sources: [nhsWeek(14), CLEVELAND_CLINIC],
  },
  {
    week: 15,
    size: { label: 'yaklaşık 10,1 cm', comparison: 'elma' },
    developmentSummary:
      'Vücut, lanugo adı verilen ince bir tüy tabakasıyla kaplanır. Kaşlar ve kirpikler ' +
      'oluşmaya başlar; gözler ışığa duyarlı hale gelir ve işitme başlar.',
    developingFeatures: [
      'Vücut lanugo adı verilen ince tüylerle kaplanır',
      'Kaşlar ve kirpikler oluşmaya başlar',
      'Gözler ışığa duyarlıdır ve işitme başlar',
    ],
    sources: [nhsWeek(15), CLEVELAND_CLINIC],
  },
  {
    week: 16,
    size: { label: 'yaklaşık 11,6 cm', comparison: 'avokado' },
    developmentSummary:
      'Yüz ifadeleri oluşmaya başlar, ancak henüz kas kontrolü olmadığı için tamamen ' +
      'rastgeledir. Gelişen sinir sistemi kol ve bacak hareketlerini mümkün kılar.',
    developingFeatures: [
      'Yüz ifadeleri oluşur, henüz kas kontrolü yoktur',
      'Sinir sistemi kol ve bacak hareketlerini mümkün kılar',
      'Eller yumruk yapabilir',
    ],
    sources: [nhsWeek(16), CLEVELAND_CLINIC],
  },
  {
    week: 17,
    size: { label: 'yaklaşık 12 cm', comparison: 'nar' },
    developmentSummary:
      'Gözler kapalı kalmakla birlikte hareket edebilir; yüksek seslere tepki verilir ve ' +
      'ağız açılıp kapanır. Tırnaklar uzar ve kendine özgü parmak izleri oluşur.',
    developingFeatures: [
      'Gözler kapalı olsa da hareket edebilir',
      'Yüksek seslere tepki verir',
      'Tırnaklar uzar ve parmak izleri oluşur',
    ],
    sources: [nhsWeek(17), CLEVELAND_CLINIC],
  },
  {
    week: 18,
    size: { label: 'yaklaşık 14,2 cm', comparison: 'dolmalık biber' },
    developmentSummary:
      'İşitme, hissetme, yutma ve emme refleksleri bu hafta gelişir. Bebek bolca ' +
      'kıpırdanır, kollarını ve bacaklarını hareket ettirir.',
    developingFeatures: [
      'İşitme ve hissetme gelişir',
      'Yutma ve emme refleksleri gelişir',
      'Kollarını ve bacaklarını hareket ettirir',
    ],
    sources: [nhsWeek(18), CLEVELAND_CLINIC],
  },
  {
    week: 19,
    size: { label: 'yaklaşık 15,3 cm', comparison: 'beefsteak domates' },
    developmentSummary:
      'Kalıcı dişler süt dişlerinin arkasında sıralanmaya başlar. Bebek doğuma ' +
      'hazırlanarak kilo almaya devam eder.',
    developingFeatures: [
      'Kalıcı dişler süt dişlerinin arkasında sıralanır',
      'Kilo almaya devam eder',
    ],
    sources: [nhsWeek(19), CLEVELAND_CLINIC],
  },
  {
    week: 20,
    // The NHS gives this length without the "head to bottom" qualifier it uses
    // for the earlier weeks, which is why it jumps from 15.3cm. Quoted as the
    // page states it rather than reconciled with the weeks before.
    size: { label: 'yaklaşık 25,6 cm', comparison: 'muz' },
    developmentSummary:
      'Hareketler her geçen gün artar: tekme atma, dönme ve parmak emme görülür. ' +
      'Vücut, vernix adı verilen beyaz ve yağlı bir tabakayla kaplanır.',
    developingFeatures: [
      'Tekme atma ve dönme gibi hareketler artar',
      'Parmak emerek emme refleksini geliştirir',
      'Vücut vernix adı verilen beyaz yağlı tabakayla kaplanır',
    ],
    sources: [nhsWeek(20), CLEVELAND_CLINIC],
  },
  {
    week: 21,
    size: { label: 'yaklaşık 26,7 cm', comparison: 'havuç' },
    developmentSummary:
      'Bebek artık rahim dışındaki sesleri ve konuşmaları duyabilir. Saç ve kaşlar ' +
      'gelişmeye devam eder; bebek plasentadan daha ağır hale gelir.',
    developingFeatures: [
      'Rahim dışındaki sesleri ve konuşmaları duyabilir',
      'Saç ve kaşlar gelişir',
      'Artık plasentadan daha ağırdır',
    ],
    sources: [nhsWeek(21), CLEVELAND_CLINIC],
  },
  {
    week: 22,
    size: { label: 'yaklaşık 27,8 cm', comparison: 'tatlı patates' },
    developmentSummary:
      'Akciğerler gelişir ve bebek rahim içinde nefes alma provası yapar. Az miktarda ' +
      'amniyon sıvısı yutulur; tat tomurcukları gelişmeye devam eder.',
    developingFeatures: [
      'Akciğerler gelişir ve nefes alma provası yapılır',
      'Az miktarda amniyon sıvısı yutulur',
      'Tat tomurcukları gelişir',
    ],
    sources: [nhsWeek(22), CLEVELAND_CLINIC],
  },
  {
    week: 23,
    size: { label: 'yaklaşık 28,9 cm', comparison: 'büyük mango' },
    developmentSummary:
      'Bebek nefes alma provasını sürdürür ve uyku-uyanıklık düzeni oluşmaya başlar. ' +
      'Kol ve bacaklar artık gövdeyle orantılıdır.',
    developingFeatures: [
      'Nefes alma provası sürer',
      'Uyku ve uyanıklık düzeni oluşur',
      'Kol ve bacaklar gövdeyle orantılı hale gelir',
    ],
    sources: [nhsWeek(23), CLEVELAND_CLINIC],
  },
  {
    week: 24,
    size: { label: 'yaklaşık 30 cm', comparison: 'mısır koçanı' },
    developmentSummary:
      'Bebek bu haftadan itibaren "yaşayabilir" kabul edilir: şimdi doğacak olsa uygun ' +
      'destekle rahim dışında yaşama şansı vardır.',
    developingFeatures: ['Şimdi doğarsa uygun destekle yaşama şansı vardır'],
    sources: [nhsWeek(24), CLEVELAND_CLINIC],
  },
  {
    week: 25,
    size: { label: 'yaklaşık 34,6 cm', comparison: 'sakız kabağı' },
    developmentSummary:
      'Hareketli bir dönemdir: yüksek bir ses bebeği sıçratıp tekme attırabilir, hatta ' +
      'zaman zaman hıçkırık hissedilebilir. Etraftaki sıvının çoğu artık bebeğin idrarıdır.',
    developingFeatures: [
      'Yüksek seslere sıçrayarak ve tekme atarak tepki verir',
      'Hıçkırık hissedilebilir',
      'Amniyon sıvısının çoğu artık bebeğin idrarıdır',
    ],
    sources: [nhsWeek(25), CLEVELAND_CLINIC],
  },
  {
    week: 26,
    size: { label: 'yaklaşık 35,6 cm', comparison: 'salatalık' },
    developmentSummary:
      'Gözler bu sıralarda ilk kez açılır; sıradaki adım göz kırpmayı öğrenmektir. ' +
      'Rahim içinde hareketlilik yoğundur.',
    developingFeatures: [
      'Gözler ilk kez açılır',
      'Göz kırpmayı öğrenmeye başlar',
      'Hareketler yoğundur',
    ],
    sources: [nhsWeek(26), CLEVELAND_CLINIC],
  },
  {
    week: 27,
    size: { label: 'yaklaşık 36,6 cm', comparison: 'karnabahar' },
    developmentSummary:
      'Akciğerler artık nefes alabilecek düzeydedir. Deri kıvrımları yağla dolarken tüm ' +
      'organlar rahim dışındaki yaşama hazırlanarak olgunlaşır.',
    developingFeatures: [
      'Akciğerler nefes alabilecek düzeye gelir',
      'Deri altı yağ dokusu artar',
      'Organlar olgunlaşmayı sürdürür',
    ],
    sources: [nhsWeek(27), CLEVELAND_CLINIC],
  },
  {
    week: 28,
    size: { label: 'yaklaşık 37,6 cm', comparison: 'patlıcan' },
    developmentSummary:
      'Kalp atış hızı gebelik boyunca değişir: ilk haftalardaki yüksek hızdan sonra bu ' +
      'sıralarda dakikada yaklaşık 140 atıma iner ve doğumda yaklaşık 130 olacaktır.',
    developingFeatures: [
      'Kalp atış hızı dakikada yaklaşık 140 atıma iner',
      'Doğumda yaklaşık 130 atım/dakika olması beklenir',
    ],
    sources: [nhsWeek(28), CLEVELAND_CLINIC],
  },
  {
    week: 29,
    size: { label: 'yaklaşık 38,6 cm', comparison: 'butternut kabağı' },
    developmentSummary:
      'Bebek artık tam olarak şekillenmiştir; önündeki haftalarda organlarını olgunlaştırıp ' +
      'yağ depolayacaktır. Deriyi kaplayan vernix tabakası azalmaya başlar.',
    developingFeatures: [
      'Organlar olgunlaşmaya devam eder',
      'Yağ depolanması sürer',
      'Vernix tabakası azalmaya başlar',
    ],
    sources: [nhsWeek(29), CLEVELAND_CLINIC],
  },
  {
    week: 30,
    size: { label: 'yaklaşık 39,9 cm', comparison: 'lahana' },
    developmentSummary:
      'Gözler artık odaklanabilir. Görme yetisi hem rahim içinde hem de doğumdan sonra ' +
      'gelişmeye devam edecektir.',
    developingFeatures: ['Gözler odaklanabilir', 'Görme gelişmeye devam eder'],
    sources: [nhsWeek(30), CLEVELAND_CLINIC],
  },
  {
    week: 31,
    size: { label: 'yaklaşık 41,1 cm', comparison: 'hindistan cevizi' },
    developmentSummary:
      'Bebek her geçen gün yağlanır ve daha az kırışık görünür. Rahim dışındaki sesleri ' +
      'tanımaya başlar; parmaklarını emip takla atacak kadar hareketlidir. Hareketlerde ' +
      'azalma ya da değişiklik fark edersen doktoruna ya da ebene başvur.',
    developingFeatures: [
      'Yağlanarak daha az kırışık görünür',
      'Rahim dışındaki sesleri tanımaya başlar',
      'Parmaklarını emer ve takla atar',
    ],
    sources: [nhsWeek(31), CLEVELAND_CLINIC],
  },
  {
    week: 32,
    size: { label: 'yaklaşık 42,4 cm', comparison: 'bir demet kereviz sapı' },
    developmentSummary:
      'Bebek yağ depolayarak kilo alır; bu yağlanma doğumdan sonra vücut ısısını ' +
      'korumasına yardımcı olacaktır. Genellikle bu sıralarda doğum için baş aşağı ' +
      'pozisyona geçer.',
    developingFeatures: [
      'Yağ depolayarak kilo alır',
      'Genellikle baş aşağı pozisyona geçer',
      'Yağlanma doğum sonrası ısı dengesine yardım eder',
    ],
    sources: [nhsWeek(32), CLEVELAND_CLINIC],
  },
  {
    week: 33,
    size: { label: 'yaklaşık 43,7 cm', comparison: 'ananas' },
    developmentSummary:
      'Beyin ve sinir sistemi tamamen gelişmiştir. Kemikler sertleşir; kafatası kemikleri ' +
      'ise bebek yaklaşık 12–18 aylık olana kadar yumuşak ve birbirinden ayrık kalır.',
    developingFeatures: [
      'Beyin ve sinir sistemi tamamlanır',
      'Kemikler sertleşir',
      'Kafatası kemikleri yumuşak ve ayrık kalır',
    ],
    sources: [nhsWeek(33), CLEVELAND_CLINIC],
  },
  {
    week: 34,
    size: { label: 'yaklaşık 45 cm', comparison: 'kantalup kavunu' },
    developmentSummary:
      'Erkek bebeklerde testisler karın boşluğundan skrotuma inmeye başlar.',
    developingFeatures: ['Erkek bebeklerde testisler skrotuma iner'],
    sources: [nhsWeek(34), CLEVELAND_CLINIC],
  },
  {
    week: 35,
    size: { label: 'yaklaşık 46,2 cm', comparison: 'bal kavunu' },
    developmentSummary:
      'Bebek yağlanmayı sürdürür; bu sayede doğduğunda vücut ısısını daha kolay ' +
      'koruyabilecektir.',
    developingFeatures: [
      'Yağlanmaya devam eder',
      'Yağ dokusu doğum sonrası ısı dengesine yardım eder',
    ],
    sources: [nhsWeek(35), CLEVELAND_CLINIC],
  },
  {
    week: 36,
    size: { label: 'yaklaşık 47,4 cm', comparison: 'marul' },
    developmentSummary:
      'Akciğerler büyük olasılıkla rahim dışında desteksiz nefes alabilecek olgunluktadır. ' +
      'Bebek anne sütünü emip sindirebilir.',
    developingFeatures: [
      'Akciğerler desteksiz nefes alabilecek olgunluğa ulaşmış olabilir',
      'Anne sütünü emip sindirebilir',
    ],
    sources: [nhsWeek(36), CLEVELAND_CLINIC],
  },
  {
    week: 37,
    size: { label: 'yaklaşık 48,6 cm', comparison: 'pırasa' },
    developmentSummary:
      'Bebek kaş çatmak ve gülümsemek gibi farklı yüz ifadeleri dener. Bebeklerin çoğu bu ' +
      'haftalarda baş aşağı döner. Bebeğin konumunu doktorun değerlendirir.',
    developingFeatures: [
      'Farklı yüz ifadeleri dener',
      'Bebeklerin çoğu doğum için baş aşağı pozisyondadır',
    ],
    sources: [nhsWeek(37), CLEVELAND_CLINIC],
  },
  {
    week: 38,
    size: { label: 'yaklaşık 49,8 cm', comparison: 'ravent sapı' },
    developmentSummary:
      'Vücudu kaplayan ince lanugo tüylerinin çoğu dökülmüştür. Bağırsaklarda, doğumdan ' +
      'sonra ilk dışkı olarak çıkacak olan mekonyum birikir.',
    developingFeatures: [
      'Lanugo tüylerinin çoğu dökülür',
      'Bağırsaklarda mekonyum birikir',
    ],
    sources: [nhsWeek(38), CLEVELAND_CLINIC],
  },
  {
    week: 39,
    size: { label: 'yaklaşık 50,7 cm', comparison: 'karpuz' },
    developmentSummary:
      'Neredeyse saydam olan deri, organları daha iyi koruyan ve ısı dengesine yardımcı ' +
      'olan daha kalın bir katman kazanır. Deri, vernix adı verilen beyaz mumsu tabakayla ' +
      'kaplıdır.',
    developingFeatures: [
      'Deri kalınlaşarak organları daha iyi korur',
      'Vernix tabakası deriyi korur ve doğumu kolaylaştırır',
    ],
    sources: [nhsWeek(39), CLEVELAND_CLINIC],
  },
  {
    week: 40,
    size: { label: 'yaklaşık 51,2 cm', comparison: 'balkabağı' },
    developmentSummary:
      'Rahimde yer iyice daralmıştır ve bebek sıkışık durumdadır. Bebeğinin hareketlerinin ' +
      'nasıl olduğunu takip et. Hareketlerde azalma ya da her zamankinden farklı bir ' +
      'değişiklik fark edersen beklemeden doktoruna ya da ebene başvur.',
    developingFeatures: [
      'Rahimde yer daraldığı için sıkışıktır',
      'Hareketlerin takibi önemlidir',
    ],
    sources: [nhsWeek(40), CLEVELAND_CLINIC],
  },
] as const;
