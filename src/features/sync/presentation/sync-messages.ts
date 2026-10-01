import type { CloudSyncFailure, CloudSyncOutcome } from '../application/run-cloud-sync';

import type { Messages } from '@/i18n';
import { plural } from '@/i18n';
import type { Language } from '@/i18n/language';
import { formatClock, formatNumericDate } from '@/utils/format-date';

/**
 * What the account screen says a sync did.
 *
 * Short, and honest about what changed. That last part is the whole job: a sync
 * moves someone's period history between a phone and an account, and a message
 * that said "done" for an outcome where nothing was written would be the app
 * telling them their data is somewhere it is not.
 *
 * So every sentence here names what happened to the data. "Sent" means it went;
 * "brought to this phone" means the phone changed; a conflict says plainly that
 * nothing was touched on either side. Nobody should have to guess which of
 * those they got, in either language.
 *
 * None of these is an SDK message. No path, no project name, no exception text
 * and no stored value reaches any of them.
 */

const syncMessagesTr = {
  failures: {
    'signed-out': 'Senkronizasyon için giriş yapman gerekiyor.',
    'not-configured': 'Bulut hesabı şu anda yapılandırılmamış.',
    'invalid-credentials': 'Hesabına erişilemedi. Çıkış yapıp tekrar giriş yapmayı dene.',
    'network-failed': 'Bağlantı kurulamadı. İnternet bağlantını kontrol et.',
    // Not a connection problem, and worth saying so: retrying will read the
    // same document again. The backup is left exactly as it was found.
    'unreadable-backup':
      'Hesabındaki yedek bu sürüm tarafından okunamadı. Hiçbir veri değiştirilmedi.',
    'local-failed': 'Telefondaki veriler okunamadı. Hiçbir veri değiştirilmedi.',
    // Not a fault and not worth retrying: the account is ahead of this build.
    // Says what was protected and what to do, because "update" on its own
    // reads as nagging rather than as the thing standing between somebody and
    // losing what they wrote on another phone.
    'app-out-of-date':
      'Hesabındaki yedek, bu uygulama sürümünün tanımadığı bilgiler içeriyor. Üzerine ' +
      'yazmamak için gönderim durduruldu. Uygulamayı güncelleyip tekrar dene.',
    'deletion-pending':
      'Hesap silme işlemi yarım kaldı. Senkronizasyon kapalı — hesabı silmeyi tamamla ' +
      'ya da vazgeç.',
    unknown: 'Senkronizasyon tamamlanamadı. Hiçbir veri değiştirilmedi.',
  } as Readonly<Record<CloudSyncFailure, string>>,

  /* --------------------------------------------- what one sync came to -- */

  outcomeNoop: 'Her şey güncel. Telefonun ve hesabın aynı.',
  outcomePushed: 'Telefondaki veriler hesabına gönderildi.',
  outcomePulled: 'Hesabındaki veriler telefona alındı.',
  outcomeMerged: 'İki taraftaki değişiklikler birleştirildi.',

  /**
   * The two conflicts get the longest sentences because they are the ones that
   * need a person, and because the reassurance is the important half: being
   * told there is a disagreement is alarming in a way that being told nothing
   * was lost is not.
   */
  outcomeConflictNoBase:
    'Çakışma bulundu; hiçbir veri değiştirilmedi. Bu cihaz bu hesapla daha ' +
    'önce hiç senkronize edilmedi, bu yüzden hangi tarafın yeni olduğu ' +
    'bilinemiyor. "Çakışmayı çöz" ile hangi tarafın kalacağını seçebilirsin.',

  outcomeConflictUnresolved:
    'Çakışma bulundu; hiçbir veri değiştirilmedi. Aynı kayıt iki tarafta ' +
    'birbirinden farklı değiştirilmiş. "Çakışmayı çöz" ile hangi tarafın ' +
    'kalacağını seçebilirsin.',

  /**
   * Not a failure, and it does not read like one. The account changed while
   * this sync was working — the other phone got there first — and the answer is
   * simply to press it again.
   */
  outcomeRetryRequired:
    'Hesap az önce başka bir cihazdan güncellendi; hiçbir veri değiştirilmedi. Tekrar dene.',

  /**
   * How many places a merge could not settle.
   *
   * A count and nothing else. Not which record, not which date, not which
   * value: this is a screen somebody may be holding in front of another person,
   * and the same rule applies here as to the restore preview — how many is what
   * they need to know, which day is not.
   */
  conflictCount: (count: number) => `Çözülmeyi bekleyen ${count} çakışma var.`,

  /* ----------------------------------------------- the account screen -- */

  /**
   * The shorter half of what the About screen says about changing phones.
   *
   * Here it can be an instruction rather than a fact, because the button it
   * refers to is a few lines below it.
   */
  phoneTransferNote:
    'Telefon değiştirirsen kayıtların kendiliğinden gelmez; taşımak için buradan yedek al.',

  automaticSyncLabel: 'Otomatik senkronizasyon',

  /**
   * What it does, said plainly.
   *
   * The second sentence is the one that matters. "Automatic" on a health app
   * reasonably reads as "uploads whenever it likes, including while I am
   * asleep", and that is exactly what this does not do.
   */
  automaticSyncNote:
    'Açıkken, uygulamayı kullanırken değişiklikler kendiliğinden hesabınla eşitlenir. ' +
    'Uygulama kapalıyken hiçbir şey gönderilmez.',

  /** Why the backup button is unavailable while the switch is on. */
  backupDisabledBySyncMessage:
    'Otomatik senkronizasyon açıkken "Yedek oluştur" kapalı. Elle yedek, hesaptaki ' +
    'dokümanı olduğu gibi değiştirdiği için senkronizasyonun tuttuğu sürüm bilgisini ' +
    'siler. Kapatırsan elle yedek yeniden kullanılabilir.',

  syncButtonLabel: 'Şimdi senkronize et',
  syncBusyLabel: 'Senkronize ediliyor...',

  /* ------------------------------------------------- automatic sync -- */

  automaticSyncEnabledMessage: 'Otomatik senkronizasyon açıldı.',

  automaticSyncDisabledMessage:
    'Otomatik senkronizasyon kapatıldı. Artık yalnızca "Şimdi senkronize et" ile ' +
    'senkronize olur.',

  /**
   * What an automatic sync says when it could not finish.
   *
   * One sentence for every failure, rather than the specific one. An automatic
   * sync is something nobody asked for at that moment, and handing somebody a
   * different diagnosis every few minutes for a problem they did not set out to
   * have is noise. The specific message still appears for the button they
   * pressed themselves.
   */
  automaticSyncFailedMessage:
    'Son otomatik senkronizasyon tamamlanamadı. Hiçbir veri değiştirilmedi.',

  syncNeverMessage: 'Henüz senkronize edilmedi.',

  /**
   * When the last sync finished, coarsely.
   *
   * Today gets a time because "today" alone is not enough to tell a sync five
   * minutes ago from one this morning. Everything older gets a date and no
   * clock: a precise timestamp for every sync going back weeks is a record of
   * when somebody opens a period tracker, and nothing here needs one.
   */
  lastSyncToday: (clock: string) => `Son senkronizasyon: bugün ${clock}`,
  lastSyncYesterday: 'Son senkronizasyon: dün',
  lastSyncOn: (date: string) => `Son senkronizasyon: ${date}`,

  /* ----------------------------------------------- conflict notice -- */

  conflictNoticeMessage: 'Çakışma var. Çözülene kadar otomatik senkronizasyon duracak.',
  conflictOpenLabel: 'Çakışmayı çöz',

  /* ---------------------------------------------- refreshed data -- */

  /**
   * Shown when a sync replaced what a screen was holding.
   *
   * Only ever when there was something to interrupt — an unsaved edit in a
   * form. Arriving at a screen and seeing current data is not an event, and a
   * notice for it would be noise on every navigation.
   *
   * It says the data changed and asks them to look, rather than asking them to
   * choose: the choice between two versions of a period history belongs on the
   * conflict screen, where both sides are described. Here one side simply won,
   * because nothing they had was written down yet.
   */
  dataRefreshedNotice:
    'Veriler başka bir cihazdan güncellendi. Değişikliklerini tekrar kontrol et.',
};

export type SyncMessages = typeof syncMessagesTr;

const syncMessagesEn: SyncMessages = {
  failures: {
    'signed-out': 'You need to be signed in to sync.',
    'not-configured': 'Cloud accounts are not set up in this build.',
    'invalid-credentials': 'Your account could not be reached. Try signing out and back in.',
    'network-failed': 'Could not connect. Check your internet connection.',
    'unreadable-backup':
      'The backup in your account could not be read by this version. Nothing was changed.',
    'local-failed': 'The data on this phone could not be read. Nothing was changed.',
    'app-out-of-date':
      'The backup in your account holds information this version of the app does not ' +
      'recognise. Sending was stopped so that nothing would be overwritten. Update the app ' +
      'and try again.',
    'deletion-pending':
      'An account deletion was left half-finished. Syncing is off — finish deleting the ' +
      'account or cancel it.',
    unknown: 'That sync could not be completed. Nothing was changed.',
  },

  outcomeNoop: 'Everything is up to date. Your phone and your account match.',
  outcomePushed: 'What was on your phone was sent to your account.',
  outcomePulled: 'What was in your account was brought to this phone.',
  outcomeMerged: 'The changes on both sides were merged.',

  outcomeConflictNoBase:
    'A conflict was found; nothing was changed. This device has never synced with this ' +
    'account before, so there is no way to tell which side is newer. Use "Resolve the ' +
    'conflict" to choose which one to keep.',

  outcomeConflictUnresolved:
    'A conflict was found; nothing was changed. The same record was changed differently on ' +
    'each side. Use "Resolve the conflict" to choose which one to keep.',

  outcomeRetryRequired:
    'Your account was just updated from another device; nothing was changed. Try again.',

  conflictCount: (count: number) =>
    plural(count, '1 conflict is waiting to be resolved.', `${count} conflicts are waiting to be resolved.`),

  phoneTransferNote:
    'If you change phones your records will not follow by themselves; take a backup here to ' +
    'move them.',

  automaticSyncLabel: 'Automatic sync',

  automaticSyncNote:
    'With this on, changes are synced with your account by themselves while you are using ' +
    'the app. Nothing is sent while the app is closed.',

  backupDisabledBySyncMessage:
    '"Create a backup" is off while automatic sync is on. A manual backup replaces the ' +
    'document in your account outright, which erases the revision sync counts on. Switch ' +
    'sync off and manual backup works again.',

  syncButtonLabel: 'Sync now',
  syncBusyLabel: 'Syncing...',

  automaticSyncEnabledMessage: 'Automatic sync is on.',

  automaticSyncDisabledMessage:
    'Automatic sync is off. It will now only sync when you press "Sync now".',

  automaticSyncFailedMessage: 'The last automatic sync could not finish. Nothing was changed.',

  syncNeverMessage: 'Not synced yet.',

  lastSyncToday: (clock: string) => `Last sync: today at ${clock}`,
  lastSyncYesterday: 'Last sync: yesterday',
  lastSyncOn: (date: string) => `Last sync: ${date}`,

  conflictNoticeMessage: 'There is a conflict. Automatic sync stops until it is resolved.',
  conflictOpenLabel: 'Resolve the conflict',

  dataRefreshedNotice:
    'The data was updated from another device. Check your changes again.',
};

export const syncMessages: Messages<SyncMessages> = { tr: syncMessagesTr, en: syncMessagesEn };

/** What to say about a failure, and the plainest thing for anything unknown. */
export function syncFailureMessageIn(
  messages: SyncMessages,
  failure: CloudSyncFailure | string
): string {
  return messages.failures[failure as CloudSyncFailure] ?? messages.failures.unknown;
}

/** What to say about one finished sync. */
export function syncOutcomeMessageIn(
  messages: SyncMessages,
  outcome: CloudSyncOutcome
): string {
  switch (outcome.kind) {
    case 'noop':
      return messages.outcomeNoop;

    case 'pushed':
      return messages.outcomePushed;

    case 'pulled':
      return messages.outcomePulled;

    case 'merged':
      return messages.outcomeMerged;

    case 'conflict':
      return outcome.reason === 'no-base'
        ? messages.outcomeConflictNoBase
        : messages.outcomeConflictUnresolved;

    case 'retry-required':
      return messages.outcomeRetryRequired;

    case 'error':
      return syncFailureMessageIn(messages, outcome.failure);
  }
}

/** How many places a merge could not settle, as a sentence, or `null`. */
export function syncConflictCountMessageIn(
  messages: SyncMessages,
  outcome: CloudSyncOutcome
): string | null {
  if (outcome.kind !== 'conflict' || outcome.conflicts.length === 0) {
    return null;
  }

  return messages.conflictCount(outcome.conflicts.length);
}

/** Whether an outcome means the phone's own data changed. No words in it. */
export function didSyncChangeThisPhone(outcome: CloudSyncOutcome): boolean {
  return outcome.kind === 'pulled' || outcome.kind === 'merged';
}

/**
 * When the last sync finished, coarsely.
 *
 * The three shapes - today with a clock, yesterday, and a bare date - come from
 * the catalogue; which of them applies is this function's arithmetic, and it is
 * the same arithmetic in both languages.
 */
export function lastSyncMessageIn(
  messages: SyncMessages,
  language: Language,
  lastSyncAt: string | null,
  now: Date = new Date()
): string {
  if (lastSyncAt === null) {
    return messages.syncNeverMessage;
  }

  const when = new Date(lastSyncAt);

  if (Number.isNaN(when.getTime())) {
    return messages.syncNeverMessage;
  }

  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);

  if (sameDay(when, now)) {
    return messages.lastSyncToday(formatClock(when));
  }

  if (sameDay(when, yesterday)) {
    return messages.lastSyncYesterday;
  }

  return messages.lastSyncOn(formatNumericDate(when, language));
}

/* ------------------------------------------------------------------------- */
/* The Turkish values under their original names, for the assertions that     */
/* already name them. Not for screens - see the note at the top of the file.  */
/* ------------------------------------------------------------------------- */

export const PHONE_TRANSFER_NOTE = syncMessagesTr.phoneTransferNote;
export const AUTOMATIC_SYNC_LABEL = syncMessagesTr.automaticSyncLabel;
export const AUTOMATIC_SYNC_NOTE = syncMessagesTr.automaticSyncNote;
export const BACKUP_DISABLED_BY_SYNC_MESSAGE = syncMessagesTr.backupDisabledBySyncMessage;
export const SYNC_BUTTON_LABEL = syncMessagesTr.syncButtonLabel;
export const SYNC_BUSY_LABEL = syncMessagesTr.syncBusyLabel;
export const AUTOMATIC_SYNC_ENABLED_MESSAGE = syncMessagesTr.automaticSyncEnabledMessage;
export const AUTOMATIC_SYNC_DISABLED_MESSAGE = syncMessagesTr.automaticSyncDisabledMessage;
export const AUTOMATIC_SYNC_FAILED_MESSAGE = syncMessagesTr.automaticSyncFailedMessage;
export const SYNC_NEVER_MESSAGE = syncMessagesTr.syncNeverMessage;
export const CONFLICT_NOTICE_MESSAGE = syncMessagesTr.conflictNoticeMessage;
export const CONFLICT_OPEN_LABEL = syncMessagesTr.conflictOpenLabel;
export const DATA_REFRESHED_NOTICE = syncMessagesTr.dataRefreshedNotice;

export function syncFailureMessage(failure: CloudSyncFailure | string): string {
  return syncFailureMessageIn(syncMessagesTr, failure);
}

export function syncOutcomeMessage(outcome: CloudSyncOutcome): string {
  return syncOutcomeMessageIn(syncMessagesTr, outcome);
}

export function syncConflictCountMessage(outcome: CloudSyncOutcome): string | null {
  return syncConflictCountMessageIn(syncMessagesTr, outcome);
}

export function lastSyncMessage(lastSyncAt: string | null, now: Date = new Date()): string {
  return lastSyncMessageIn(syncMessagesTr, 'tr', lastSyncAt, now);
}
