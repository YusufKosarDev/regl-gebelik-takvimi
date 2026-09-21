import type {
  AccountDeletionOutcome,
  DeletionFailure,
  LocalWipeOutcome,
} from '../domain/deletion-outcome';

/**
 * Everything the two deletion flows say, in one place.
 *
 * Deleting is the one thing in this app that cannot be undone, so the words
 * matter more here than anywhere else. Two rules run through all of them:
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

/* ---------------------------------------------------------------- account -- */

export const ACCOUNT_DELETE_SECTION_TITLE = 'Hesabı sil';

export const ACCOUNT_DELETE_SECTION_DESCRIPTION =
  'Hesabın ve buluttaki yedeğin kalıcı olarak silinir. Bu işlem geri alınamaz.';

export const ACCOUNT_DELETE_OPEN_LABEL = 'Hesabı sil';

export const ACCOUNT_DELETE_PANEL_TITLE = 'Hesabını silmek üzeresin';

export const ACCOUNT_DELETE_PANEL_BODY =
  'Buluttaki yedeğin ve hesabın kalıcı olarak silinecek. Bu işlem geri alınamaz. ' +
  'Devam etmek için şifreni gir.';

export const ACCOUNT_DELETE_PASSWORD_LABEL = 'Şifre';

export const ACCOUNT_DELETE_WIPE_CHECKBOX_LABEL = 'Bu cihazdaki kayıtlarımı da sil';

export const ACCOUNT_DELETE_WIPE_OFF_NOTE =
  'Kayıtların telefonunda kalacak. Uygulamayı hesapsız kullanmaya devam edebilirsin.';

export const ACCOUNT_DELETE_WIPE_ON_NOTE =
  'Regl geçmişin, gebelik bilgin ve avatarın bu telefondan da silinecek.';

export const ACCOUNT_DELETE_CONFIRM_LABEL = 'Hesabı kalıcı olarak sil';

export const ACCOUNT_DELETE_BUSY_LABEL = 'Hesap siliniyor...';

export const ACCOUNT_DELETE_CANCEL_LABEL = 'Vazgeç';

export const ACCOUNT_DELETE_EMPTY_PASSWORD_MESSAGE = 'Şifre gerekli.';

const ACCOUNT_DELETE_SUCCESS: Readonly<Record<string, string>> = {
  deleted: 'Hesabın silindi. Kayıtların bu telefonda kaldı.',
  'deleted-and-wiped': 'Hesabın ve bu cihazdaki tüm verilerin silindi.',
  'deleted-wipe-failed':
    'Hesabın silindi ama bu cihazdaki kayıtlar silinemedi. Ayarlar’dan ' +
    '"Tüm verilerimi sil" ile tekrar deneyebilirsin.',
};

/**
 * What went wrong, and — just as importantly — what it means for what is left.
 *
 * `cloud-delete-failed` and `account-delete-failed` are the two halves of the
 * same moment and must not read the same: after the first, nothing has been
 * deleted; after the second, the backup is already gone and only the account
 * remains. Telling somebody "hesabın silinmedi" in the second case would be
 * true and useless — they would not know their backup had gone with it.
 */
const ACCOUNT_DELETE_FAILURES: Readonly<Record<DeletionFailure, string>> = {
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
};

/** The sentence for one account deletion outcome. */
export function accountDeletionMessage(outcome: AccountDeletionOutcome): string {
  if (outcome.kind === 'failed') {
    return ACCOUNT_DELETE_FAILURES[outcome.reason] ?? ACCOUNT_DELETE_FAILURES.unknown;
  }

  return ACCOUNT_DELETE_SUCCESS[outcome.kind] ?? ACCOUNT_DELETE_SUCCESS.deleted;
}

/**
 * Whether the password field should be emptied and the panel left open.
 *
 * True for exactly the two codes that mean "type it again": a password that did
 * not match, and a session Firebase wants re-proved. Everything else either
 * needs a different action or is not about the password at all, and clearing
 * the field for those would look like the app had lost what was typed.
 */
export function shouldRetryWithPassword(outcome: AccountDeletionOutcome): boolean {
  return (
    outcome.kind === 'failed' &&
    (outcome.reason === 'invalid-credentials' || outcome.reason === 'requires-recent-login')
  );
}

/* ------------------------------------------------------------- local wipe -- */

export const LOCAL_WIPE_SECTION_TITLE = 'Tüm verilerimi sil';

export const LOCAL_WIPE_SECTION_DESCRIPTION =
  'Bu telefondaki regl geçmişin, gebelik bilgin, avatarın ve tercihlerin silinir. ' +
  'Uygulama baştan başlar.';

export const LOCAL_WIPE_OPEN_LABEL = 'Tüm verilerimi sil';

export const LOCAL_WIPE_PANEL_TITLE = 'Bu cihazdaki her şey silinecek';

export const LOCAL_WIPE_PANEL_BODY =
  'Regl kayıtların, gebelik bilgin, avatarın, hatırlatıcıların ve ayarların bu ' +
  'telefondan kalıcı olarak silinecek. Bu işlem geri alınamaz.';

/**
 * The line that keeps the two actions apart.
 *
 * Required rather than decorative: without it, "tüm verilerim" reads as "all of
 * my data, everywhere", and somebody would use this believing their cloud
 * backup had gone with it.
 */
export const LOCAL_WIPE_CLOUD_DISCLAIMER =
  'Buluttaki yedeğin ve hesabın silinmez. Onları da silmek için Hesap ekranındaki ' +
  '"Hesabı sil" seçeneğini kullan.';

export const LOCAL_WIPE_SIGNED_IN_NOTE = 'Hesabından çıkış yapılacak.';

export const LOCAL_WIPE_CONFIRM_LABEL = 'Her şeyi sil';

export const LOCAL_WIPE_BUSY_LABEL = 'Siliniyor...';

export const LOCAL_WIPE_CANCEL_LABEL = 'Vazgeç';

const LOCAL_WIPE_FAILED_MESSAGE = 'Veriler silinemedi. Hiçbir şey değişmedi, tekrar deneyebilirsin.';

const LOCAL_WIPE_PARTIAL_MESSAGE = 'Veriler silindi ama bazı ayarlar temizlenemedi.';

/**
 * The sentence for a wipe that did not fully succeed, or `null` when it did.
 *
 * `null` on success is deliberate. A finished wipe turns the onboarding flag
 * off, `RootLayout` swaps the route group, and this screen stops existing —
 * there is nowhere for a success message to be read, and leaving one behind
 * would put it on a screen the person never sees or, worse, on one that is
 * already gone.
 */
export function localWipeMessage(outcome: LocalWipeOutcome): string | null {
  if (outcome.kind === 'failed') {
    return LOCAL_WIPE_FAILED_MESSAGE;
  }

  if (outcome.kind === 'partial') {
    return LOCAL_WIPE_PARTIAL_MESSAGE;
  }

  return null;
}
