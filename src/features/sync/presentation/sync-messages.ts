import type { CloudSyncFailure, CloudSyncOutcome } from '../application/run-cloud-sync';

/**
 * What the account screen says a sync did.
 *
 * Turkish, short, and honest about what changed. That last part is the whole
 * job: a sync moves someone's period history between a phone and an account,
 * and a message that said "tamamlandı" for an outcome where nothing was written
 * would be the app telling them their data is somewhere it is not.
 *
 * So every sentence here names what happened to the data. "Gönderildi" means it
 * went; "alındı" means the phone changed; a conflict says plainly that nothing
 * was touched on either side. Nobody should have to guess which of those they
 * got.
 *
 * None of these is an SDK message. No path, no project name, no exception text
 * and no stored value reaches any of them.
 */

const FAILURE_MESSAGES: Readonly<Record<CloudSyncFailure, string>> = {
  'signed-out': 'Senkronizasyon için giriş yapman gerekiyor.',
  'not-configured': 'Bulut hesabı şu anda yapılandırılmamış.',
  'invalid-credentials': 'Hesabına erişilemedi. Çıkış yapıp tekrar giriş yapmayı dene.',
  'network-failed': 'Bağlantı kurulamadı. İnternet bağlantını kontrol et.',
  // Not a connection problem, and worth saying so: retrying will read the same
  // document again. The backup is left exactly as it was found.
  'unreadable-backup':
    'Hesabındaki yedek bu sürüm tarafından okunamadı. Hiçbir veri değiştirilmedi.',
  'local-failed': 'Telefondaki veriler okunamadı. Hiçbir veri değiştirilmedi.',
  // Not a fault and not worth retrying: the account is ahead of this build.
  // Says what was protected and what to do, because "güncelle" on its own
  // reads as nagging rather than as the thing standing between somebody and
  // losing what they wrote on another phone.
  'app-out-of-date':
    'Hesabındaki yedek, bu uygulama sürümünün tanımadığı bilgiler içeriyor. Üzerine ' +
    'yazmamak için gönderim durduruldu. Uygulamayı güncelleyip tekrar dene.',
  'deletion-pending':
    'Hesap silme işlemi yarım kaldı. Senkronizasyon kapalı — hesabı silmeyi tamamla ' +
    'ya da vazgeç.',
  unknown: 'Senkronizasyon tamamlanamadı. Hiçbir veri değiştirilmedi.',
};

/** What to say about a failure, and the plainest thing for anything unknown. */
export function syncFailureMessage(failure: CloudSyncFailure | string): string {
  return FAILURE_MESSAGES[failure as CloudSyncFailure] ?? FAILURE_MESSAGES.unknown;
}

/**
 * What to say about one finished sync.
 *
 * `conflict` gets the longest sentence because it is the one that needs a
 * person, and because the reassurance is the important half: being told there
 * is a disagreement is alarming in a way that being told nothing was lost is
 * not.
 *
 * `retry-required` is not a failure and does not read like one. It means the
 * account changed while this sync was working — the other phone got there first
 * — and the answer is simply to press it again.
 */
export function syncOutcomeMessage(outcome: CloudSyncOutcome): string {
  switch (outcome.kind) {
    case 'noop':
      return 'Her şey güncel. Telefonun ve hesabın aynı.';

    case 'pushed':
      return 'Telefondaki veriler hesabına gönderildi.';

    case 'pulled':
      return 'Hesabındaki veriler telefona alındı.';

    case 'merged':
      return 'İki taraftaki değişiklikler birleştirildi.';

    case 'conflict':
      return outcome.reason === 'no-base'
        ? 'Çakışma bulundu; hiçbir veri değiştirilmedi. Bu cihaz bu hesapla daha ' +
            'önce hiç senkronize edilmedi, bu yüzden hangi tarafın yeni olduğu ' +
            'bilinemiyor. "Çakışmayı çöz" ile hangi tarafın kalacağını seçebilirsin.'
        : 'Çakışma bulundu; hiçbir veri değiştirilmedi. Aynı kayıt iki tarafta ' +
            'birbirinden farklı değiştirilmiş. "Çakışmayı çöz" ile hangi tarafın ' +
            'kalacağını seçebilirsin.';

    case 'retry-required':
      return 'Hesap az önce başka bir cihazdan güncellendi; hiçbir veri değiştirilmedi. ' +
        'Tekrar dene.';

    case 'error':
      return syncFailureMessage(outcome.failure);
  }
}

/**
 * How many places a merge could not settle, as a sentence, or `null`.
 *
 * A count and nothing else. Not which record, not which date, not which value:
 * this is a screen somebody may be holding in front of another person, and the
 * same rule applies here as to the restore preview — "kaç yerde" is what they
 * need to know, and "hangi gün" is not.
 */
export function syncConflictCountMessage(outcome: CloudSyncOutcome): string | null {
  if (outcome.kind !== 'conflict' || outcome.conflicts.length === 0) {
    return null;
  }

  return `Çözülmeyi bekleyen ${outcome.conflicts.length} çakışma var.`;
}

/** Whether an outcome means the phone's own data changed. */
export function didSyncChangeThisPhone(outcome: CloudSyncOutcome): boolean {
  return outcome.kind === 'pulled' || outcome.kind === 'merged';
}

/**
 * The shorter half of what the About screen says about changing phones.
 *
 * Here it can be an instruction rather than a fact, because the button it
 * refers to is a few lines below it.
 */
export const PHONE_TRANSFER_NOTE =
  'Telefon değiştirirsen kayıtların kendiliğinden gelmez; taşımak için buradan yedek al.';

/** What the switch that turns automatic sync on says about itself. */
export const AUTOMATIC_SYNC_LABEL = 'Otomatik senkronizasyon';

/**
 * What it does, said plainly.
 *
 * The second sentence is the one that matters. "Otomatik" on a health app
 * reasonably reads as "uploads whenever it likes, including while I am asleep",
 * and that is exactly what this does not do.
 */
export const AUTOMATIC_SYNC_NOTE =
  'Açıkken, uygulamayı kullanırken değişiklikler kendiliğinden hesabınla eşitlenir. ' +
  'Uygulama kapalıyken hiçbir şey gönderilmez.';

/** Why the backup button is unavailable while the switch is on. */
export const BACKUP_DISABLED_BY_SYNC_MESSAGE =
  'Otomatik senkronizasyon açıkken "Yedek oluştur" kapalı. Elle yedek, hesaptaki ' +
  'dokümanı olduğu gibi değiştirdiği için senkronizasyonun tuttuğu sürüm bilgisini ' +
  'siler. Kapatırsan elle yedek yeniden kullanılabilir.';

export const SYNC_BUTTON_LABEL = 'Şimdi senkronize et';
export const SYNC_BUSY_LABEL = 'Senkronize ediliyor...';

/* ------------------------------------------------------- automatic sync -- */

export const AUTOMATIC_SYNC_ENABLED_MESSAGE = 'Otomatik senkronizasyon açıldı.';

export const AUTOMATIC_SYNC_DISABLED_MESSAGE =
  'Otomatik senkronizasyon kapatıldı. Artık yalnızca "Şimdi senkronize et" ile ' +
  'senkronize olur.';

/**
 * What an automatic sync says when it could not finish.
 *
 * One sentence for every failure, rather than the specific one. An automatic
 * sync is something nobody asked for at that moment, and handing somebody a
 * different diagnosis every few minutes for a problem they did not set out to
 * have is noise. The specific message still appears for the button they pressed
 * themselves.
 */
export const AUTOMATIC_SYNC_FAILED_MESSAGE =
  'Son otomatik senkronizasyon tamamlanamadı. Hiçbir veri değiştirilmedi.';

export const SYNC_NEVER_MESSAGE = 'Henüz senkronize edilmedi.';

/**
 * When the last sync finished, coarsely.
 *
 * Today gets a time because "bugün" alone is not enough to tell a sync five
 * minutes ago from one this morning. Everything older gets a date and no clock:
 * a precise timestamp for every sync going back weeks is a record of when
 * somebody opens a period tracker, and nothing here needs one.
 */
export function lastSyncMessage(
  lastSyncAt: string | null,
  now: Date = new Date()
): string {
  if (lastSyncAt === null) {
    return SYNC_NEVER_MESSAGE;
  }

  const when = new Date(lastSyncAt);

  if (Number.isNaN(when.getTime())) {
    return SYNC_NEVER_MESSAGE;
  }

  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);

  if (sameDay(when, now)) {
    const hh = String(when.getHours()).padStart(2, '0');
    const mm = String(when.getMinutes()).padStart(2, '0');

    return `Son senkronizasyon: bugün ${hh}:${mm}`;
  }

  if (sameDay(when, yesterday)) {
    return 'Son senkronizasyon: dün';
  }

  const dd = String(when.getDate()).padStart(2, '0');
  const mo = String(when.getMonth() + 1).padStart(2, '0');

  return `Son senkronizasyon: ${dd}.${mo}.${when.getFullYear()}`;
}

/* ----------------------------------------------------- conflict notice -- */

export const CONFLICT_NOTICE_MESSAGE =
  'Çakışma var. Çözülene kadar otomatik senkronizasyon duracak.';

export const CONFLICT_OPEN_LABEL = 'Çakışmayı çöz';

/* ------------------------------------------------------ refreshed data -- */

/**
 * Shown when a sync replaced what a screen was holding.
 *
 * Only ever when there was something to interrupt — an unsaved edit in a form.
 * Arriving at a screen and seeing current data is not an event, and a notice
 * for it would be noise on every navigation.
 *
 * It says the data changed and asks them to look, rather than asking them to
 * choose: the choice between two versions of a period history belongs on the
 * conflict screen, where both sides are described. Here one side simply won,
 * because nothing they had was written down yet.
 */
export const DATA_REFRESHED_NOTICE =
  'Veriler başka bir cihazdan güncellendi. Değişikliklerini tekrar kontrol et.';
