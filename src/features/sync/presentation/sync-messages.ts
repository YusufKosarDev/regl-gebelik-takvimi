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
        ? 'Çakışma bulundu, çözülmedi; hiçbir veri değiştirilmedi. Telefonunda ve ' +
            'hesabında farklı kayıtlar var ve bu cihaz daha önce hiç senkronize ' +
            'edilmediği için hangisinin yeni olduğu bilinemiyor. Şimdilik "Yedeği geri ' +
            'yükle" ile hesaptakini alabilir ya da "Yedek oluştur" ile telefondakini ' +
            'gönderebilirsin.'
        : 'Çakışma bulundu, çözülmedi; hiçbir veri değiştirilmedi. Aynı kayıt iki ' +
            'tarafta birbirinden farklı değiştirilmiş. Çakışmaları çözme ekranı henüz ' +
            'yok; o gelene kadar telefonundaki ve hesabındaki veriler olduğu gibi ' +
            'duruyor.';

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

/** What the switch that turns automatic sync on says about itself. */
export const AUTOMATIC_SYNC_LABEL = 'Otomatik senkronizasyon';

/**
 * What it does today, said plainly.
 *
 * It records the choice and nothing else runs on it yet. Writing that down is
 * not an apology for an unfinished feature: a switch that looks like it starts
 * background uploads, and does not, would be a worse promise than no switch.
 */
export const AUTOMATIC_SYNC_NOTE =
  'Açık olduğunda senkronizasyon tercihin kaydedilir. Kendiliğinden senkronizasyon ' +
  'henüz çalışmıyor; şimdilik yalnızca "Şimdi senkronize et" ile senkronize olur.';

/** Why the backup button is unavailable while the switch is on. */
export const BACKUP_DISABLED_BY_SYNC_MESSAGE =
  'Otomatik senkronizasyon açıkken "Yedek oluştur" kapalı. Elle yedek, hesaptaki ' +
  'dokümanı olduğu gibi değiştirdiği için senkronizasyonun tuttuğu sürüm bilgisini ' +
  'siler. Kapatırsan elle yedek yeniden kullanılabilir.';

export const SYNC_BUTTON_LABEL = 'Şimdi senkronize et';
export const SYNC_BUSY_LABEL = 'Senkronize ediliyor...';
