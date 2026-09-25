import type { ResolveSyncConflictFailure } from '../application/resolve-sync-conflict';
import type { SyncConflictSideSummary } from '../application/build-conflict-preview';

/**
 * How the conflict screen reads in Turkish.
 *
 * The screen asks somebody to throw one of two versions of their own period
 * history away, so the words carry more weight here than anywhere else in the
 * app. Three rules run through them:
 *
 *   - say what will be destroyed, not only what will be kept. "Buluttakini
 *     kullan" sounds additive and is not.
 *   - never show a date, a value or a record. Counts and presence only, the
 *     same line the restore preview holds: this is a screen somebody may be
 *     holding in front of another person.
 *   - never imply a merge. There is no per-record choice here, and copy that
 *     hinted at one would be promising something the app does not do.
 */

export const CONFLICT_SCREEN_TITLE = 'Çakışmayı çöz';

export const CONFLICT_BODY_UNRESOLVED =
  'Aynı kayıtlar iki tarafta farklı şekilde değiştirilmiş. Hangi tarafın kalacağını ' +
  'seç. Seçmediğin taraftaki değişiklikler silinecek.';

export const CONFLICT_BODY_NO_BASE =
  'Bu cihaz daha önce bu hesapla hiç senkronize edilmemiş, bu yüzden hangisinin yeni ' +
  'olduğu bilinemiyor. Hangi tarafın kalacağını seç.';

export const CONFLICT_COLUMN_LOCAL = 'Bu cihaz';
export const CONFLICT_COLUMN_REMOTE = 'Bulut';

export const CONFLICT_ROW_RECORDS = 'Regl kayıtları';
export const CONFLICT_ROW_PREGNANCY = 'Gebelik takibi';
export const CONFLICT_ROW_AVATAR = 'Avatar';
export const CONFLICT_ROW_SETTINGS = 'Döngü ayarları';
export const CONFLICT_ROW_LAST_CHANGE = 'Son değişiklik';
export const CONFLICT_ROW_DEVICE = 'Değiştiren cihaz';

export const CONFLICT_PRESENT = 'var';
export const CONFLICT_ABSENT = 'yok';
export const CONFLICT_UNKNOWN = 'Bilinmiyor';

export const CONFLICT_DEVICE_THIS = 'Bu cihaz';
export const CONFLICT_DEVICE_OTHER = 'Başka bir cihaz';

export const CONFLICT_KEEP_LOCAL_LABEL = 'Bu cihazdakini kullan';
export const CONFLICT_KEEP_REMOTE_LABEL = 'Buluttakini kullan';
export const CONFLICT_CANCEL_LABEL = 'Vazgeç';

export const CONFLICT_KEEP_LOCAL_WARNING =
  'Buluttaki veriler bu cihazdakilerle değiştirilecek. Bu işlem geri alınamaz.';

export const CONFLICT_KEEP_REMOTE_WARNING =
  'Bu cihazdaki veriler buluttakilerle değiştirilecek. Bu işlem geri alınamaz.';

export const CONFLICT_KEEP_LOCAL_CONFIRM = 'Bu cihazdakini gönder';
export const CONFLICT_KEEP_REMOTE_CONFIRM = 'Buluttakini indir';

export const CONFLICT_BUSY_LABEL = 'Uygulanıyor...';

export const CONFLICT_KEEP_LOCAL_DONE =
  'Bu cihazdaki veriler hesabına gönderildi. Çakışma çözüldü.';

export const CONFLICT_KEEP_REMOTE_DONE =
  'Hesaptaki veriler bu cihaza alındı. Çakışma çözüldü.';

/** Nothing is in the account any more, so there is nothing to choose between. */
export const CONFLICT_NO_REMOTE_MESSAGE =
  'Hesapta artık yedek yok. Çözülecek bir çakışma kalmadı.';

export const CONFLICT_LOAD_FAILED_MESSAGE =
  'Çakışma bilgileri okunamadı. Hiçbir veri değiştirilmedi.';

const FAILURE_MESSAGES: Readonly<Record<ResolveSyncConflictFailure, string>> = {
  // The one failure that is not a fault: somebody else wrote while this screen
  // was open, so the choice was about data that is no longer current.
  'revision-moved': 'Bulut bu sırada değişti. Seçimini güncel verilere göre tekrar yap.',
  'network-failed': 'Bağlantı kurulamadı. Hiçbir veri değiştirilmedi.',
  'local-failed': 'Telefondaki veriler yazılamadı. Hiçbir veri değiştirilmedi.',
  'app-out-of-date':
    'Hesabındaki yedek, bu uygulama sürümünün tanımadığı bilgiler içeriyor. Üzerine ' +
    'yazmamak için işlem durduruldu. Uygulamayı güncelleyip tekrar dene.',
  unknown: 'Çakışma çözülemedi. Hiçbir veri değiştirilmedi.',
};

export function conflictFailureMessage(reason: ResolveSyncConflictFailure | string): string {
  return FAILURE_MESSAGES[reason as ResolveSyncConflictFailure] ?? FAILURE_MESSAGES.unknown;
}

/** "3 kayıt" — a count, and never which days they are. */
export function conflictRecordCountLabel(summary: SyncConflictSideSummary): string {
  return `${summary.periodRecordCount} kayıt`;
}

/** "var" / "yok", for the three things that are either there or not. */
export function conflictPresenceLabel(present: boolean): string {
  return present ? CONFLICT_PRESENT : CONFLICT_ABSENT;
}

/**
 * Which device last wrote the cloud side.
 *
 * Only ever "this one" or "another one". The stored id is a random per-install
 * string with no name in it, so there is nothing more specific to say — and the
 * distinction somebody actually needs is whether the other version is their own
 * older write or a different phone's.
 */
export function conflictDeviceLabel(writtenByThisDevice: boolean): string {
  return writtenByThisDevice ? CONFLICT_DEVICE_THIS : CONFLICT_DEVICE_OTHER;
}

/** When the cloud side was last written, coarsely, or "Bilinmiyor". */
export function conflictLastChangeLabel(updatedAt: string | null): string {
  if (updatedAt === null) {
    return CONFLICT_UNKNOWN;
  }

  const when = new Date(updatedAt);

  if (Number.isNaN(when.getTime())) {
    return CONFLICT_UNKNOWN;
  }

  const dd = String(when.getDate()).padStart(2, '0');
  const mo = String(when.getMonth() + 1).padStart(2, '0');
  const hh = String(when.getHours()).padStart(2, '0');
  const mm = String(when.getMinutes()).padStart(2, '0');

  return `${dd}.${mo}.${when.getFullYear()} ${hh}:${mm}`;
}

/**
 * One row of the comparison, read as one thing.
 *
 * The row prints its label and the two values in columns, which a screen reader
 * would otherwise announce as three unrelated fragments.
 */
export function comparisonRowLabel(label: string, local: string, remote: string): string {
  return `${label}: ${CONFLICT_COLUMN_LOCAL} ${local}, ${CONFLICT_COLUMN_REMOTE} ${remote}`;
}
