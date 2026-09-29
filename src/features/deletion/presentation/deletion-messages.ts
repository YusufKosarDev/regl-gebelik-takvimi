import type {
  AccountDeletionOutcome,
  DeletionFailure,
  LocalWipeOutcome,
} from '../domain/deletion-outcome';

import type { Messages } from '@/i18n';

/**
 * Everything the two deletion flows say, in one place.
 *
 * Deleting is the one thing in this app that cannot be undone, so the words
 * matter more here than anywhere else. Two rules run through all of them, and
 * they are what the English half was written against rather than translated
 * into:
 *
 *   - say what is gone and what is not. "Tüm verilerimi sil" does not touch the
 *     account, and a person who thinks it does will believe they have deleted
 *     something that is still sitting in Firestore.
 *   - never report a failure as though nothing happened when something did. The
 *     account can be gone while the phone is still full, and that is its own
 *     sentence rather than an error.
 *
 * No value from a database, an address or an error is ever interpolated in.
 */

const deletionMessagesTr = {
  /* -------------------------------------------------------------- account -- */

  // The section heading and the button beneath it say different things on
  // purpose: a screen reader announcing "Hesabı sil" twice in a row gives no
  // clue which one is the control.
  accountDeleteSectionTitle: 'Hesap silme',

  accountDeleteSectionDescription:
    'Hesabın ve buluttaki yedeğin kalıcı olarak silinir. Bu işlem geri alınamaz.',

  accountDeleteOpenLabel: 'Hesabı sil',

  accountDeletePanelTitle: 'Hesabını silmek üzeresin',

  accountDeletePanelBody:
    'Buluttaki yedeğin ve hesabın kalıcı olarak silinecek. Bu işlem geri alınamaz. ' +
    'Devam etmek için şifreni gir.',

  accountDeletePasswordLabel: 'Şifre',

  accountDeleteWipeCheckboxLabel: 'Bu cihazdaki kayıtlarımı da sil',

  accountDeleteWipeOffNote:
    'Kayıtların telefonunda kalacak. Uygulamayı hesapsız kullanmaya devam edebilirsin.',

  accountDeleteWipeOnNote:
    'Regl geçmişin, gebelik bilgin ve avatarın bu telefondan da silinecek.',

  accountDeleteConfirmLabel: 'Hesabı kalıcı olarak sil',

  accountDeleteBusyLabel: 'Hesap siliniyor...',

  accountDeleteCancelLabel: 'Vazgeç',

  accountDeleteEmptyPasswordMessage: 'Şifre gerekli.',

  accountDeleteSuccess: {
    deleted: 'Hesabın silindi. Kayıtların bu telefonda kaldı.',
    'deleted-and-wiped': 'Hesabın ve bu cihazdaki tüm verilerin silindi.',
    // Nothing was deleted just now, and saying "silindi" would claim otherwise.
    'already-deleted':
      'Bu hesap zaten silinmiş görünüyor. Oturumun kapatıldı ve bu cihazdaki hesap ' +
      'kayıtları temizlendi.',
    'deleted-wipe-failed':
      'Hesabın silindi ama bu cihazdaki kayıtlar silinemedi. Ayarlar’dan ' +
      '"Tüm verilerimi sil" ile tekrar deneyebilirsin.',
  } as Readonly<Record<string, string>>,

  /**
   * What went wrong, and — just as importantly — what it means for what is left.
   *
   * `cloud-delete-failed` and `account-delete-failed` are the two halves of the
   * same moment and must not read the same: after the first, nothing has been
   * deleted; after the second, the backup is already gone and only the account
   * remains. Telling somebody "hesabın silinmedi" in the second case would be
   * true and useless — they would not know their backup had gone with it.
   */
  accountDeleteFailures: {
    'not-configured': 'Bu sürümde hesap özellikleri kapalı.',
    'signed-out': 'Bu işlem için giriş yapmış olman gerekiyor.',
    'invalid-credentials': 'Şifre doğrulanamadı. Lütfen tekrar dene.',
    'requires-recent-login': 'Güvenlik için şifreni tekrar girip yeniden denemen gerekiyor.',
    'network-failed': 'İnternet bağlantısı yok. Hesap silinmedi, tekrar deneyebilirsin.',
    'too-many-requests': 'Çok fazla deneme yapıldı. Lütfen biraz sonra tekrar dene.',
    'cloud-delete-failed':
      'Buluttaki yedek silinemedi. Hesabın silinmedi — tekrar deneyebilirsin.',
    'account-delete-failed':
      'Buluttaki yedeğin silindi ama hesap silinemedi. Lütfen tekrar dene.',
    'local-failed': 'Telefondaki veriler okunamadı. Hesabın silinmedi.',
    unknown: 'Hesap silinemedi. Lütfen tekrar dene.',
  } as Readonly<Record<DeletionFailure, string>>,

  /* ----------------------------------------------------------- local wipe -- */

  /** Heading only; the button below it keeps the first-person wording. */
  localWipeSectionTitle: 'Veri silme',

  localWipeSectionDescription:
    'Bu telefondaki regl geçmişin, gebelik bilgin, avatarın ve tercihlerin silinir. ' +
    'Uygulama baştan başlar.',

  localWipeOpenLabel: 'Tüm verilerimi sil',

  localWipePanelTitle: 'Bu cihazdaki her şey silinecek',

  localWipePanelBody:
    'Regl kayıtların, gebelik bilgin, avatarın, hatırlatıcıların ve ayarların bu ' +
    'telefondan kalıcı olarak silinecek. Bu işlem geri alınamaz.',

  /**
   * The line that keeps the two actions apart.
   *
   * Required rather than decorative: without it, "tüm verilerim" reads as "all
   * of my data, everywhere", and somebody would use this believing their cloud
   * backup had gone with it. English has exactly the same trap.
   */
  localWipeCloudDisclaimer:
    'Buluttaki yedeğin ve hesabın silinmez. Onları da silmek için Hesap ekranındaki ' +
    '"Hesabı sil" seçeneğini kullan.',

  localWipeSignedInNote: 'Hesabından çıkış yapılacak.',

  localWipeConfirmLabel: 'Her şeyi sil',

  localWipeBusyLabel: 'Siliniyor...',

  localWipeCancelLabel: 'Vazgeç',

  localWipeFailedMessage:
    'Veriler silinemedi. Hiçbir şey değişmedi, tekrar deneyebilirsin.',

  localWipePartialMessage: 'Veriler silindi ama bazı ayarlar temizlenemedi.',
};

export type DeletionMessages = typeof deletionMessagesTr;

const deletionMessagesEn: DeletionMessages = {
  accountDeleteSectionTitle: 'Deleting your account',

  accountDeleteSectionDescription:
    'Your account and your cloud backup are deleted for good. This cannot be undone.',

  accountDeleteOpenLabel: 'Delete my account',

  accountDeletePanelTitle: 'You are about to delete your account',

  accountDeletePanelBody:
    'Your cloud backup and your account will be deleted for good. This cannot be undone. ' +
    'Enter your password to go on.',

  accountDeletePasswordLabel: 'Password',

  accountDeleteWipeCheckboxLabel: 'Delete my records on this phone as well',

  accountDeleteWipeOffNote:
    'Your records will stay on your phone. You can go on using the app without an account.',

  accountDeleteWipeOnNote:
    'Your period history, your pregnancy information and your avatar will be deleted from ' +
    'this phone too.',

  accountDeleteConfirmLabel: 'Delete my account for good',

  accountDeleteBusyLabel: 'Deleting your account...',

  accountDeleteCancelLabel: 'Cancel',

  accountDeleteEmptyPasswordMessage: 'A password is needed.',

  accountDeleteSuccess: {
    deleted: 'Your account was deleted. Your records stayed on this phone.',
    'deleted-and-wiped': 'Your account and everything on this device were deleted.',
    'already-deleted':
      'This account appears to have been deleted already. You have been signed out and its ' +
      'records on this device were cleared.',
    'deleted-wipe-failed':
      'Your account was deleted, but the records on this device could not be. You can try ' +
      'again with "Delete all my data" in Settings.',
  },

  accountDeleteFailures: {
    'not-configured': 'Account features are switched off in this build.',
    'signed-out': 'You need to be signed in to do this.',
    'invalid-credentials': 'That password could not be verified. Please try again.',
    'requires-recent-login':
      'For security, you need to enter your password again and retry.',
    'network-failed':
      'There is no internet connection. Your account was not deleted; you can try again.',
    'too-many-requests': 'Too many attempts. Please try again in a little while.',
    'cloud-delete-failed':
      'Your cloud backup could not be deleted. Your account was not deleted — you can try again.',
    'account-delete-failed':
      'Your cloud backup was deleted but your account could not be. Please try again.',
    'local-failed': 'The data on this phone could not be read. Your account was not deleted.',
    unknown: 'Your account could not be deleted. Please try again.',
  },

  localWipeSectionTitle: 'Deleting your data',

  localWipeSectionDescription:
    'Your period history, pregnancy information, avatar and preferences are deleted from this ' +
    'phone. The app starts over.',

  localWipeOpenLabel: 'Delete all my data',

  localWipePanelTitle: 'Everything on this device will be deleted',

  localWipePanelBody:
    'Your period records, pregnancy information, avatar, reminders and settings will be ' +
    'deleted from this phone for good. This cannot be undone.',

  localWipeCloudDisclaimer:
    'Your cloud backup and your account are not deleted. To delete those as well, use ' +
    '"Delete my account" on the Account screen.',

  localWipeSignedInNote: 'You will be signed out of your account.',

  localWipeConfirmLabel: 'Delete everything',

  localWipeBusyLabel: 'Deleting...',

  localWipeCancelLabel: 'Cancel',

  localWipeFailedMessage:
    'That data could not be deleted. Nothing changed; you can try again.',

  localWipePartialMessage: 'Your data was deleted, but some settings could not be cleared.',
};

export const deletionMessages: Messages<DeletionMessages> = {
  tr: deletionMessagesTr,
  en: deletionMessagesEn,
};

/** The sentence for one account deletion outcome. */
export function accountDeletionMessageIn(
  messages: DeletionMessages,
  outcome: AccountDeletionOutcome
): string {
  if (outcome.kind === 'failed') {
    return messages.accountDeleteFailures[outcome.reason] ?? messages.accountDeleteFailures.unknown;
  }

  return messages.accountDeleteSuccess[outcome.kind] ?? messages.accountDeleteSuccess.deleted;
}

/**
 * The sentence for a wipe that did not fully succeed, or `null` when it did.
 *
 * `null` on success is deliberate. A finished wipe turns the onboarding flag
 * off, `RootLayout` swaps the route group, and this screen stops existing —
 * there is nowhere for a success message to be read, and leaving one behind
 * would put it on a screen the person never sees or, worse, on one that is
 * already gone.
 */
export function localWipeMessageIn(
  messages: DeletionMessages,
  outcome: LocalWipeOutcome
): string | null {
  if (outcome.kind === 'failed') {
    return messages.localWipeFailedMessage;
  }

  if (outcome.kind === 'partial') {
    return messages.localWipePartialMessage;
  }

  return null;
}

/**
 * Whether the password field should be emptied and the panel left open.
 *
 * True for exactly the two codes that mean "type it again": a password that did
 * not match, and a session Firebase wants re-proved. Everything else either
 * needs a different action or is not about the password at all, and clearing
 * the field for those would look like the app had lost what was typed.
 *
 * No language in it, which is why it did not become a catalogue function.
 */
export function shouldRetryWithPassword(outcome: AccountDeletionOutcome): boolean {
  return (
    outcome.kind === 'failed' &&
    (outcome.reason === 'invalid-credentials' || outcome.reason === 'requires-recent-login')
  );
}

/* ------------------------------------------------------------------------- */
/* The Turkish values under their original names, for the assertions that     */
/* already name them. Not for screens - see the note at the top of the file.  */
/* ------------------------------------------------------------------------- */

export const ACCOUNT_DELETE_SECTION_TITLE = deletionMessagesTr.accountDeleteSectionTitle;
export const ACCOUNT_DELETE_SECTION_DESCRIPTION =
  deletionMessagesTr.accountDeleteSectionDescription;
export const ACCOUNT_DELETE_OPEN_LABEL = deletionMessagesTr.accountDeleteOpenLabel;
export const ACCOUNT_DELETE_PANEL_TITLE = deletionMessagesTr.accountDeletePanelTitle;
export const ACCOUNT_DELETE_PANEL_BODY = deletionMessagesTr.accountDeletePanelBody;
export const ACCOUNT_DELETE_PASSWORD_LABEL = deletionMessagesTr.accountDeletePasswordLabel;
export const ACCOUNT_DELETE_WIPE_CHECKBOX_LABEL =
  deletionMessagesTr.accountDeleteWipeCheckboxLabel;
export const ACCOUNT_DELETE_WIPE_OFF_NOTE = deletionMessagesTr.accountDeleteWipeOffNote;
export const ACCOUNT_DELETE_WIPE_ON_NOTE = deletionMessagesTr.accountDeleteWipeOnNote;
export const ACCOUNT_DELETE_CONFIRM_LABEL = deletionMessagesTr.accountDeleteConfirmLabel;
export const ACCOUNT_DELETE_BUSY_LABEL = deletionMessagesTr.accountDeleteBusyLabel;
export const ACCOUNT_DELETE_CANCEL_LABEL = deletionMessagesTr.accountDeleteCancelLabel;
export const ACCOUNT_DELETE_EMPTY_PASSWORD_MESSAGE =
  deletionMessagesTr.accountDeleteEmptyPasswordMessage;
export const LOCAL_WIPE_SECTION_TITLE = deletionMessagesTr.localWipeSectionTitle;
export const LOCAL_WIPE_SECTION_DESCRIPTION = deletionMessagesTr.localWipeSectionDescription;
export const LOCAL_WIPE_OPEN_LABEL = deletionMessagesTr.localWipeOpenLabel;
export const LOCAL_WIPE_PANEL_TITLE = deletionMessagesTr.localWipePanelTitle;
export const LOCAL_WIPE_PANEL_BODY = deletionMessagesTr.localWipePanelBody;
export const LOCAL_WIPE_CLOUD_DISCLAIMER = deletionMessagesTr.localWipeCloudDisclaimer;
export const LOCAL_WIPE_SIGNED_IN_NOTE = deletionMessagesTr.localWipeSignedInNote;
export const LOCAL_WIPE_CONFIRM_LABEL = deletionMessagesTr.localWipeConfirmLabel;
export const LOCAL_WIPE_BUSY_LABEL = deletionMessagesTr.localWipeBusyLabel;
export const LOCAL_WIPE_CANCEL_LABEL = deletionMessagesTr.localWipeCancelLabel;

export function accountDeletionMessage(outcome: AccountDeletionOutcome): string {
  return accountDeletionMessageIn(deletionMessagesTr, outcome);
}

export function localWipeMessage(outcome: LocalWipeOutcome): string | null {
  return localWipeMessageIn(deletionMessagesTr, outcome);
}
