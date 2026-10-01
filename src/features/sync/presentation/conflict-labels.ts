import type { SyncConflictSideSummary } from '../application/build-conflict-preview';
import type { ResolveSyncConflictFailure } from '../application/resolve-sync-conflict';

import type { Messages } from '@/i18n';
import { plural } from '@/i18n';
import type { Language } from '@/i18n/language';
import { formatClock, formatNumericDate } from '@/utils/format-date';

/**
 * How the conflict screen reads.
 *
 * The screen asks somebody to throw one of two versions of their own period
 * history away, so the words carry more weight here than anywhere else in the
 * app. Three rules run through them, and the English half was written against
 * them rather than translated into them:
 *
 *   - say what will be destroyed, not only what will be kept. "Keep the cloud
 *     one" sounds additive and is not.
 *   - never show a date, a value or a record. Counts and presence only, the
 *     same line the restore preview holds: this is a screen somebody may be
 *     holding in front of another person.
 *   - never imply a merge. There is no per-record choice here, and copy that
 *     hinted at one would be promising something the app does not do.
 */

const conflictLabelsTr = {
  conflictScreenTitle: 'Çakışmayı çöz',

  conflictBodyUnresolved:
    'Aynı kayıtlar iki tarafta farklı şekilde değiştirilmiş. Hangi tarafın kalacağını ' +
    'seç. Seçmediğin taraftaki değişiklikler silinecek.',

  conflictBodyNoBase:
    'Bu cihaz daha önce bu hesapla hiç senkronize edilmemiş, bu yüzden hangisinin yeni ' +
    'olduğu bilinemiyor. Hangi tarafın kalacağını seç.',

  conflictColumnLocal: 'Bu cihaz',
  conflictColumnRemote: 'Bulut',

  conflictRowRecords: 'Regl kayıtları',
  conflictRowPregnancy: 'Gebelik takibi',
  conflictRowAvatar: 'Avatar',
  conflictRowSettings: 'Döngü ayarları',
  conflictRowLastChange: 'Son değişiklik',
  conflictRowDevice: 'Değiştiren cihaz',

  conflictPresent: 'var',
  conflictAbsent: 'yok',
  conflictUnknown: 'Bilinmiyor',

  conflictDeviceThis: 'Bu cihaz',
  conflictDeviceOther: 'Başka bir cihaz',

  conflictKeepLocalLabel: 'Bu cihazdakini kullan',
  conflictKeepRemoteLabel: 'Buluttakini kullan',
  conflictCancelLabel: 'Vazgeç',

  conflictKeepLocalWarning:
    'Buluttaki veriler bu cihazdakilerle değiştirilecek. Bu işlem geri alınamaz.',

  conflictKeepRemoteWarning:
    'Bu cihazdaki veriler buluttakilerle değiştirilecek. Bu işlem geri alınamaz.',

  conflictKeepLocalConfirm: 'Bu cihazdakini gönder',
  conflictKeepRemoteConfirm: 'Buluttakini indir',

  conflictBusyLabel: 'Uygulanıyor...',

  conflictKeepLocalDone: 'Bu cihazdaki veriler hesabına gönderildi. Çakışma çözüldü.',
  conflictKeepRemoteDone: 'Hesaptaki veriler bu cihaza alındı. Çakışma çözüldü.',

  /** Nothing is in the account any more, so there is nothing to choose between. */
  conflictNoRemoteMessage: 'Hesapta artık yedek yok. Çözülecek bir çakışma kalmadı.',

  conflictLoadFailedMessage: 'Çakışma bilgileri okunamadı. Hiçbir veri değiştirilmedi.',

  failures: {
    // The one failure that is not a fault: somebody else wrote while this
    // screen was open, so the choice was about data that is no longer current.
    'revision-moved': 'Bulut bu sırada değişti. Seçimini güncel verilere göre tekrar yap.',
    'network-failed': 'Bağlantı kurulamadı. Hiçbir veri değiştirilmedi.',
    'local-failed': 'Telefondaki veriler yazılamadı. Hiçbir veri değiştirilmedi.',
    'app-out-of-date':
      'Hesabındaki yedek, bu uygulama sürümünün tanımadığı bilgiler içeriyor. Üzerine ' +
      'yazmamak için işlem durduruldu. Uygulamayı güncelleyip tekrar dene.',
    unknown: 'Çakışma çözülemedi. Hiçbir veri değiştirilmedi.',
  } as Readonly<Record<ResolveSyncConflictFailure, string>>,

  /** A count, and never which days they are. */
  recordCount: (count: number) => `${count} kayıt`,

  /**
   * When the cloud side was last written, coarsely.
   *
   * A date and a clock, which is as precise as this screen gets: somebody
   * choosing between two versions needs to know roughly when the other one was
   * written, and nothing finer than that.
   */
  lastChange: (date: string, clock: string) => `${date} ${clock}`,

  /**
   * One row of the comparison, read as one thing.
   *
   * The row prints its label and the two values in columns, which a screen
   * reader would otherwise announce as three unrelated fragments.
   */
  comparisonRow: (label: string, localColumn: string, local: string, remoteColumn: string, remote: string) =>
    `${label}: ${localColumn} ${local}, ${remoteColumn} ${remote}`,
};

export type ConflictLabels = typeof conflictLabelsTr;

const conflictLabelsEn: ConflictLabels = {
  conflictScreenTitle: 'Resolve the conflict',

  conflictBodyUnresolved:
    'The same records were changed differently on each side. Choose which side to keep. ' +
    'The changes on the side you do not choose will be deleted.',

  conflictBodyNoBase:
    'This device has never synced with this account before, so there is no way to tell ' +
    'which one is newer. Choose which side to keep.',

  conflictColumnLocal: 'This device',
  conflictColumnRemote: 'Cloud',

  conflictRowRecords: 'Period records',
  conflictRowPregnancy: 'Pregnancy tracking',
  conflictRowAvatar: 'Avatar',
  conflictRowSettings: 'Cycle settings',
  conflictRowLastChange: 'Last change',
  conflictRowDevice: 'Changed by',

  conflictPresent: 'yes',
  conflictAbsent: 'no',
  conflictUnknown: 'Not known',

  conflictDeviceThis: 'This device',
  conflictDeviceOther: 'Another device',

  conflictKeepLocalLabel: 'Keep the one on this device',
  conflictKeepRemoteLabel: 'Keep the one in the cloud',
  conflictCancelLabel: 'Cancel',

  conflictKeepLocalWarning:
    'What is in the cloud will be replaced with what is on this device. This cannot be undone.',

  conflictKeepRemoteWarning:
    'What is on this device will be replaced with what is in the cloud. This cannot be undone.',

  conflictKeepLocalConfirm: 'Send this device’s',
  conflictKeepRemoteConfirm: 'Download the cloud’s',

  conflictBusyLabel: 'Applying...',

  conflictKeepLocalDone:
    'What was on this device was sent to your account. The conflict is resolved.',
  conflictKeepRemoteDone:
    'What was in your account was brought to this device. The conflict is resolved.',

  conflictNoRemoteMessage:
    'There is no backup in your account any more. There is no conflict left to resolve.',

  conflictLoadFailedMessage: 'The conflict details could not be read. Nothing was changed.',

  failures: {
    'revision-moved':
      'The cloud changed in the meantime. Make your choice again against the current data.',
    'network-failed': 'Could not connect. Nothing was changed.',
    'local-failed': 'The data on this phone could not be written. Nothing was changed.',
    'app-out-of-date':
      'The backup in your account holds information this version of the app does not ' +
      'recognise. This was stopped so that nothing would be overwritten. Update the app ' +
      'and try again.',
    unknown: 'That conflict could not be resolved. Nothing was changed.',
  },

  recordCount: (count: number) => plural(count, '1 record', `${count} records`),

  lastChange: (date: string, clock: string) => `${date} ${clock}`,

  comparisonRow: (label: string, localColumn: string, local: string, remoteColumn: string, remote: string) =>
    `${label}: ${localColumn} ${local}, ${remoteColumn} ${remote}`,
};

export const conflictLabels: Messages<ConflictLabels> = {
  tr: conflictLabelsTr,
  en: conflictLabelsEn,
};

export function conflictFailureMessageIn(
  labels: ConflictLabels,
  reason: ResolveSyncConflictFailure | string
): string {
  return labels.failures[reason as ResolveSyncConflictFailure] ?? labels.failures.unknown;
}

/** A count, and never which days they are. */
export function conflictRecordCountLabelIn(
  labels: ConflictLabels,
  summary: SyncConflictSideSummary
): string {
  return labels.recordCount(summary.periodRecordCount);
}

/** Either there or not, for the three things that are one or the other. */
export function conflictPresenceLabelIn(labels: ConflictLabels, present: boolean): string {
  return present ? labels.conflictPresent : labels.conflictAbsent;
}

/**
 * Which device last wrote the cloud side.
 *
 * Only ever "this one" or "another one". The stored id is a random per-install
 * string with no name in it, so there is nothing more specific to say — and the
 * distinction somebody actually needs is whether the other version is their own
 * older write or a different phone's.
 */
export function conflictDeviceLabelIn(
  labels: ConflictLabels,
  writtenByThisDevice: boolean
): string {
  return writtenByThisDevice ? labels.conflictDeviceThis : labels.conflictDeviceOther;
}

/** When the cloud side was last written, coarsely, or "not known". */
export function conflictLastChangeLabelIn(
  labels: ConflictLabels,
  language: Language,
  updatedAt: string | null
): string {
  if (updatedAt === null) {
    return labels.conflictUnknown;
  }

  const when = new Date(updatedAt);

  if (Number.isNaN(when.getTime())) {
    return labels.conflictUnknown;
  }

  return labels.lastChange(formatNumericDate(when, language), formatClock(when));
}

/** One row of the comparison, read as one thing. */
export function comparisonRowLabelIn(
  labels: ConflictLabels,
  label: string,
  local: string,
  remote: string
): string {
  return labels.comparisonRow(
    label,
    labels.conflictColumnLocal,
    local,
    labels.conflictColumnRemote,
    remote
  );
}

/* ------------------------------------------------------------------------- */
/* The Turkish values under their original names, for the assertions that     */
/* already name them. Not for screens - see the note at the top of the file.  */
/* ------------------------------------------------------------------------- */

export const CONFLICT_SCREEN_TITLE = conflictLabelsTr.conflictScreenTitle;
export const CONFLICT_BODY_UNRESOLVED = conflictLabelsTr.conflictBodyUnresolved;
export const CONFLICT_BODY_NO_BASE = conflictLabelsTr.conflictBodyNoBase;
export const CONFLICT_COLUMN_LOCAL = conflictLabelsTr.conflictColumnLocal;
export const CONFLICT_COLUMN_REMOTE = conflictLabelsTr.conflictColumnRemote;
export const CONFLICT_ROW_RECORDS = conflictLabelsTr.conflictRowRecords;
export const CONFLICT_ROW_PREGNANCY = conflictLabelsTr.conflictRowPregnancy;
export const CONFLICT_ROW_AVATAR = conflictLabelsTr.conflictRowAvatar;
export const CONFLICT_ROW_SETTINGS = conflictLabelsTr.conflictRowSettings;
export const CONFLICT_ROW_LAST_CHANGE = conflictLabelsTr.conflictRowLastChange;
export const CONFLICT_ROW_DEVICE = conflictLabelsTr.conflictRowDevice;
export const CONFLICT_PRESENT = conflictLabelsTr.conflictPresent;
export const CONFLICT_ABSENT = conflictLabelsTr.conflictAbsent;
export const CONFLICT_UNKNOWN = conflictLabelsTr.conflictUnknown;
export const CONFLICT_DEVICE_THIS = conflictLabelsTr.conflictDeviceThis;
export const CONFLICT_DEVICE_OTHER = conflictLabelsTr.conflictDeviceOther;
export const CONFLICT_KEEP_LOCAL_LABEL = conflictLabelsTr.conflictKeepLocalLabel;
export const CONFLICT_KEEP_REMOTE_LABEL = conflictLabelsTr.conflictKeepRemoteLabel;
export const CONFLICT_CANCEL_LABEL = conflictLabelsTr.conflictCancelLabel;
export const CONFLICT_KEEP_LOCAL_WARNING = conflictLabelsTr.conflictKeepLocalWarning;
export const CONFLICT_KEEP_REMOTE_WARNING = conflictLabelsTr.conflictKeepRemoteWarning;
export const CONFLICT_KEEP_LOCAL_CONFIRM = conflictLabelsTr.conflictKeepLocalConfirm;
export const CONFLICT_KEEP_REMOTE_CONFIRM = conflictLabelsTr.conflictKeepRemoteConfirm;
export const CONFLICT_BUSY_LABEL = conflictLabelsTr.conflictBusyLabel;
export const CONFLICT_KEEP_LOCAL_DONE = conflictLabelsTr.conflictKeepLocalDone;
export const CONFLICT_KEEP_REMOTE_DONE = conflictLabelsTr.conflictKeepRemoteDone;
export const CONFLICT_NO_REMOTE_MESSAGE = conflictLabelsTr.conflictNoRemoteMessage;
export const CONFLICT_LOAD_FAILED_MESSAGE = conflictLabelsTr.conflictLoadFailedMessage;

export function conflictFailureMessage(reason: ResolveSyncConflictFailure | string): string {
  return conflictFailureMessageIn(conflictLabelsTr, reason);
}

export function conflictRecordCountLabel(summary: SyncConflictSideSummary): string {
  return conflictRecordCountLabelIn(conflictLabelsTr, summary);
}

export function conflictPresenceLabel(present: boolean): string {
  return conflictPresenceLabelIn(conflictLabelsTr, present);
}

export function conflictDeviceLabel(writtenByThisDevice: boolean): string {
  return conflictDeviceLabelIn(conflictLabelsTr, writtenByThisDevice);
}

export function conflictLastChangeLabel(updatedAt: string | null): string {
  return conflictLastChangeLabelIn(conflictLabelsTr, 'tr', updatedAt);
}

export function comparisonRowLabel(label: string, local: string, remote: string): string {
  return comparisonRowLabelIn(conflictLabelsTr, label, local, remote);
}
