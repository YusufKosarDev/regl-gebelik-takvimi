import type { Messages } from '@/i18n';

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
 *
 * ## The English is a translation, not a rewrite
 *
 * Same claims, same order, same three points. The rule above applies to both
 * halves: neither may be shortened to fit.
 *
 * ## The emergency line is the one place the two halves differ
 *
 * Turkish says 112, which is correct in Turkey and is where this app is used.
 * English says "contact your local emergency services" and names no number.
 *
 * A language is not a country. Somebody installing from an English listing may
 * be anywhere, and 112 reaches help in Turkey and the EU while the US dials 911
 * and the UK 999. A precise number that is wrong for a large share of readers is
 * worse on this line than a vague instruction that is right for all of them -
 * this is the sentence somebody reads while deciding whether to call, and it has
 * to work wherever they are standing.
 *
 * This is a deliberate asymmetry, not a translation that drifted. Do not
 * "restore parity" by putting a number back into the English.
 */

const disclaimerMessagesTr = {
  /* ----------------------------------------------------- onboarding -- */

  disclaimerTitle: 'Başlamadan önce',

  disclaimerIntro:
    'Bu uygulama regl döngünü ve gebeliğini takip etmene yardımcı olur. Gösterdiği ' +
    'tarihler ve bilgiler, girdiğin kayıtlara dayanan tahminlerdir.',

  /**
   * The three that matter, in the order they matter.
   *
   * A list rather than a paragraph: these are the points somebody has to be
   * able to find again, and the middle one - that this is not contraception -
   * is the one a wall of text would swallow.
   */
  disclaimerPoints: [
    'Tıbbi tavsiye, teşhis veya tedavi yerine geçmez.',
    'Doğum kontrol yöntemi olarak ya da gebe kalmak için tek başına kullanılmamalıdır.',
    'Sağlığınla ilgili bir endişen varsa bir sağlık profesyoneline danış. Acil bir durumda ' +
      "112'yi ara.",
  ] as readonly string[],

  /* ---------------------------------------------------------- about -- */

  aboutScreenTitle: 'Hakkında',

  /** The row in settings that leads here. */
  aboutOpenLabel: 'Hakkında',

  aboutImportantSectionTitle: 'Önemli bilgi',

  /**
   * The long form, as paragraphs.
   *
   * Kept as separate strings rather than one blob with newlines in it, so the
   * screen can space them as paragraphs and a test can point at the one it
   * means.
   */
  aboutImportantParagraphs: [
    'Regl & Gebelik Takvimi, girdiğin kayıtlara dayanarak döngü evreleri, doğurganlık ' +
      'penceresi, ovülasyon günü ve tahmini doğum tarihi gibi tahminler gösterir. Herkesin ' +
      'döngüsü farklıdır; bu tahminler kesin değildir.',
    'Uygulamadaki içerikler genel bilgilendirme amaçlıdır. Tıbbi tavsiye, teşhis veya tedavi ' +
      'yerine geçmez.',
    'Uygulama bir doğum kontrol yöntemi değildir. Gebelikten korunmak ya da gebe kalmak için ' +
      'tek başına kullanılmamalıdır.',
    'Gebelik süresince düzenli doktor kontrollerini aksatma. Sağlığınla ilgili bir endişen ' +
      "varsa bir sağlık profesyoneline danış. Acil bir durumda 112'yi ara.",
  ] as readonly string[],

  /** Shown beside the version, so the number has something to be the version of. */
  aboutAppName: 'Regl & Gebelik Takvimi',

  aboutVersionLabelText: 'Sürüm',

  /** When the version cannot be read, which should not happen but is not fatal. */
  aboutVersionUnknown: 'Bilinmiyor',

  /* ----------------------------------------------- moving to a phone -- */

  /**
   * What happens to the records when the phone changes.
   *
   * On this screen rather than only on the account screen, because the account
   * screen is behind signing in and the person who loses everything is exactly
   * the one who never made an account.
   */
  aboutTransferSectionTitle: 'Verilerin taşınması',

  aboutTransferParagraph:
    "Kayıtların bu telefonda tutulur ve Android'in otomatik yedeklemesine dahil " +
    'edilmez. Telefon değiştirirsen geçmişin kendiliğinden gelmez — taşımak için ' +
    'Hesap ekranından yedek al.',

  /* ---------------------------------------------- links and support -- */

  aboutLinksSectionTitle: 'Belgeler',

  aboutPrivacyLabel: 'Gizlilik politikası',
  aboutKvkkLabel: 'KVKK aydınlatma metni',
  aboutDeletionLabel: 'Veri silme',

  aboutSupportSectionTitle: 'Destek',

  /** Prefixed, so the address reads as something to write to rather than a link. */
  aboutSupportLabel: (email: string) => `Destek: ${email}`,

  /**
   * Shown when the phone will not open a link or the mail app.
   *
   * It carries the address itself rather than only apologising: somebody who
   * cannot open the privacy policy still needs to be able to reach it, and an
   * address on screen can be typed into a browser or copied by hand.
   */
  linkOpenFailedMessage: (target: string) =>
    `Açılamadı. Bu adresi tarayıcına yazabilirsin: ${target}`,

  mailOpenFailedMessage: (email: string) =>
    `E-posta uygulaması açılamadı. Bu adrese yazabilirsin: ${email}`,

  /* ------------------------------------------------------- footers -- */

  /**
   * Under every piece of health content the app shows.
   *
   * One line, secondary, and the same line everywhere: somebody who has seen it
   * under the daily note should recognise it under the pregnancy week rather
   * than read it again as something new.
   */
  contentDisclaimerFooter: 'Genel bilgilendirme amaçlıdır, tıbbi tavsiye değildir.',

  /** The version, spoken as a label and its value. */
  aboutVersionLabel: (version: string) => `Sürüm: ${version}`,

  /** The version as it is printed, which reads as a phrase rather than a field. */
  aboutVersionText: (version: string) => `Sürüm ${version}`,
};

export type DisclaimerMessages = typeof disclaimerMessagesTr;

const disclaimerMessagesEn: DisclaimerMessages = {
  disclaimerTitle: 'Before you start',

  disclaimerIntro:
    'This app helps you keep track of your cycle and your pregnancy. The dates and ' +
    'information it shows are estimates based on the records you enter.',

  disclaimerPoints: [
    'It is not a substitute for medical advice, diagnosis or treatment.',
    'It must not be used on its own as a method of contraception or to conceive.',
    'If you have any concern about your health, speak to a healthcare professional. ' +
      'In an emergency, contact your local emergency services.',
  ],

  aboutScreenTitle: 'About',

  aboutOpenLabel: 'About',

  aboutImportantSectionTitle: 'Important information',

  aboutImportantParagraphs: [
    'Regl & Gebelik Takvimi shows estimates - cycle phases, the fertile window, the day ' +
      'of ovulation and an estimated due date - based on the records you enter. Every ' +
      'cycle is different, and these estimates are not certainties.',
    'The content in this app is for general information. It is not a substitute for ' +
      'medical advice, diagnosis or treatment.',
    'This app is not a method of contraception. It must not be used on its own to avoid ' +
      'pregnancy or to conceive.',
    'Keep up with your regular check-ups throughout a pregnancy. If you have any concern ' +
      'about your health, speak to a healthcare professional. In an emergency, contact your ' +
      'local emergency services.',
  ],

  aboutAppName: 'Regl & Gebelik Takvimi',

  aboutVersionLabelText: 'Version',

  aboutVersionUnknown: 'Unknown',

  aboutTransferSectionTitle: 'Moving your records',

  aboutTransferParagraph:
    'Your records are kept on this phone and are left out of Android’s automatic ' +
    'backup. If you change phones your history will not follow by itself — take a backup ' +
    'from the Account screen to move it.',

  aboutLinksSectionTitle: 'Documents',

  aboutPrivacyLabel: 'Privacy policy',

  /**
   * The one row that opens a document the reader may not be able to read.
   *
   * KVKK is the notice required by Turkish Law No. 6698 and is published in
   * Turkish only, because a translation would read like the instrument without
   * being it. The label says so, so that somebody tapping it has been told
   * before the browser opens rather than after.
   */
  aboutKvkkLabel: 'KVKK notice (Turkish)',

  aboutDeletionLabel: 'Deleting your data',

  aboutSupportSectionTitle: 'Support',

  aboutSupportLabel: (email: string) => `Support: ${email}`,

  linkOpenFailedMessage: (target: string) =>
    `That would not open. You can type this address into your browser: ${target}`,

  mailOpenFailedMessage: (email: string) =>
    `Your mail app would not open. You can write to this address: ${email}`,

  contentDisclaimerFooter: 'For general information only. This is not medical advice.',

  aboutVersionLabel: (version: string) => `Version: ${version}`,

  aboutVersionText: (version: string) => `Version ${version}`,
};

export const disclaimerMessages: Messages<DisclaimerMessages> = {
  tr: disclaimerMessagesTr,
  en: disclaimerMessagesEn,
};

/* ------------------------------------------------------------------------- */
/* The Turkish values under their original names, for the assertions that     */
/* already name them. Not for screens - see the note at the top of the file.  */
/* ------------------------------------------------------------------------- */

export const DISCLAIMER_TITLE = disclaimerMessagesTr.disclaimerTitle;
export const DISCLAIMER_INTRO = disclaimerMessagesTr.disclaimerIntro;
export const DISCLAIMER_POINTS = disclaimerMessagesTr.disclaimerPoints;
export const ABOUT_SCREEN_TITLE = disclaimerMessagesTr.aboutScreenTitle;
export const ABOUT_OPEN_LABEL = disclaimerMessagesTr.aboutOpenLabel;
export const ABOUT_IMPORTANT_SECTION_TITLE = disclaimerMessagesTr.aboutImportantSectionTitle;
export const ABOUT_IMPORTANT_PARAGRAPHS = disclaimerMessagesTr.aboutImportantParagraphs;
export const ABOUT_APP_NAME = disclaimerMessagesTr.aboutAppName;
export const ABOUT_VERSION_LABEL = disclaimerMessagesTr.aboutVersionLabelText;
export const ABOUT_VERSION_UNKNOWN = disclaimerMessagesTr.aboutVersionUnknown;
export const ABOUT_TRANSFER_SECTION_TITLE = disclaimerMessagesTr.aboutTransferSectionTitle;
export const ABOUT_TRANSFER_PARAGRAPH = disclaimerMessagesTr.aboutTransferParagraph;
export const ABOUT_LINKS_SECTION_TITLE = disclaimerMessagesTr.aboutLinksSectionTitle;
export const ABOUT_PRIVACY_LABEL = disclaimerMessagesTr.aboutPrivacyLabel;
export const ABOUT_KVKK_LABEL = disclaimerMessagesTr.aboutKvkkLabel;
export const ABOUT_DELETION_LABEL = disclaimerMessagesTr.aboutDeletionLabel;
export const ABOUT_SUPPORT_SECTION_TITLE = disclaimerMessagesTr.aboutSupportSectionTitle;
export const CONTENT_DISCLAIMER_FOOTER = disclaimerMessagesTr.contentDisclaimerFooter;

export const aboutSupportLabel = disclaimerMessagesTr.aboutSupportLabel;
export const linkOpenFailedMessage = disclaimerMessagesTr.linkOpenFailedMessage;
export const mailOpenFailedMessage = disclaimerMessagesTr.mailOpenFailedMessage;
export const aboutVersionLabel = disclaimerMessagesTr.aboutVersionLabel;
export const aboutVersionText = disclaimerMessagesTr.aboutVersionText;
