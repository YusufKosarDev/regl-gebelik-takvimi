/**
 * What the app says about its own limits.
 *
 * Its own feature rather than a corner of onboarding, because the same few
 * facts are needed in three places that have nothing else in common: the
 * onboarding screen somebody sees once, the "Hakkında" screen they can go back
 * to, and the one-line footer under every piece of health content. Copy that
 * matters this much should have one home.
 *
 * The wording is fixed. These are the sentences that say the app is not a
 * doctor and not contraception, and paraphrasing them to fit a layout is how a
 * disclaimer quietly stops disclaiming anything. A screen that cannot fit them
 * is a screen that needs changing.
 */

/* ------------------------------------------------------- onboarding -- */

export const DISCLAIMER_TITLE = 'Başlamadan önce';

export const DISCLAIMER_INTRO =
  'Bu uygulama regl döngünü ve gebeliğini takip etmene yardımcı olur. Gösterdiği ' +
  'tarihler ve bilgiler, girdiğin kayıtlara dayanan tahminlerdir.';

/**
 * The three that matter, in the order they matter.
 *
 * A list rather than a paragraph: these are the points somebody has to be able
 * to find again, and the middle one — that this is not contraception — is the
 * one a wall of text would swallow.
 */
export const DISCLAIMER_POINTS: readonly string[] = [
  'Tıbbi tavsiye, teşhis veya tedavi yerine geçmez.',
  'Doğum kontrol yöntemi olarak ya da gebe kalmak için tek başına kullanılmamalıdır.',
  'Sağlığınla ilgili bir endişen varsa bir sağlık profesyoneline danış. Acil bir durumda ' +
    "112'yi ara.",
];

/* ---------------------------------------------------------- about -- */

export const ABOUT_SCREEN_TITLE = 'Hakkında';

/** The row in settings that leads here. */
export const ABOUT_OPEN_LABEL = 'Hakkında';

export const ABOUT_IMPORTANT_SECTION_TITLE = 'Önemli bilgi';

/**
 * The long form, as paragraphs.
 *
 * Kept as separate strings rather than one blob with newlines in it, so the
 * screen can space them as paragraphs and a test can point at the one it means.
 */
export const ABOUT_IMPORTANT_PARAGRAPHS: readonly string[] = [
  'Regl & Gebelik Takvimi, girdiğin kayıtlara dayanarak döngü evreleri, doğurganlık ' +
    'penceresi, ovülasyon günü ve tahmini doğum tarihi gibi tahminler gösterir. Herkesin ' +
    'döngüsü farklıdır; bu tahminler kesin değildir.',
  'Uygulamadaki içerikler genel bilgilendirme amaçlıdır. Tıbbi tavsiye, teşhis veya tedavi ' +
    'yerine geçmez.',
  'Uygulama bir doğum kontrol yöntemi değildir. Gebelikten korunmak ya da gebe kalmak için ' +
    'tek başına kullanılmamalıdır.',
  'Gebelik süresince düzenli doktor kontrollerini aksatma. Sağlığınla ilgili bir endişen ' +
    "varsa bir sağlık profesyoneline danış. Acil bir durumda 112'yi ara.",
];

/** Shown beside the version, so the number has something to be the version of. */
export const ABOUT_APP_NAME = 'Regl & Gebelik Takvimi';

export const ABOUT_VERSION_LABEL = 'Sürüm';

/** When the version cannot be read, which should not happen but is not fatal. */
export const ABOUT_VERSION_UNKNOWN = 'Bilinmiyor';

/* -------------------------------------------------------- footers -- */

/**
 * Under every piece of health content the app shows.
 *
 * One line, secondary, and the same line everywhere: somebody who has seen it
 * under the daily note should recognise it under the pregnancy week rather than
 * read it again as something new.
 */
export const CONTENT_DISCLAIMER_FOOTER =
  'Genel bilgilendirme amaçlıdır, tıbbi tavsiye değildir.';
