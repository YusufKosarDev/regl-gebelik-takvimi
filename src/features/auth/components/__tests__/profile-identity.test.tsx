import { fireEvent, render } from '@testing-library/react-native';

import { ProfileIdentity } from '../profile-identity';

/**
 * Who this is, at the top of the tab that answers that question.
 *
 * Ours, not taken from anywhere. The structural reference puts the person on a
 * tab of their own and the store screenshots show nothing of what is on it, so
 * there is no layout here to follow and none was invented to look like one.
 *
 * What it is for: the tab used to open with the cycle-length steppers, which
 * is a setting, and the account - the one genuinely identifying thing on the
 * screen - was a button whose label somebody had to press to find out their
 * own state. The answer comes to the tab; the controls stay on the account
 * screen, which is a large screen about sync and backup and belongs there.
 */
function renderIdentity(
  auth: Parameters<typeof ProfileIdentity>[0]['auth'],
  handlers: { onOpenAvatar?: () => void; onOpenAccount?: () => void } = {}
) {
  return render(
    <ProfileIdentity
      auth={auth}
      avatar={null}
      avatarLabel="Avatar oluştur"
      accountLabel="Hesabı aç"
      onOpenAvatar={handlers.onOpenAvatar ?? (() => {})}
      onOpenAccount={handlers.onOpenAccount ?? (() => {})}
    />
  );
}

describe('ProfileIdentity', () => {
  it('names the account that is signed in', async () => {
    const { getByText } = await renderIdentity({
      status: 'signed-in',
      user: { uid: 'u1', email: 'biri@example.com' } as never,
    });

    expect(getByText('biri@example.com')).toBeTruthy();
  });

  it('says so rather than showing a blank when the account has no address', async () => {
    const { getByText } = await renderIdentity({
      status: 'signed-in',
      user: { uid: 'u1', email: null } as never,
    });

    expect(getByText('E-posta adresi yok')).toBeTruthy();
  });

  it('says where the records are when nobody is signed in', async () => {
    const { getByText } = await renderIdentity({ status: 'signed-out', user: null });

    expect(getByText('Kayıtların yalnızca bu telefonda.')).toBeTruthy();
  });

  it('says the same when there is no sync to sign in to', async () => {
    // `not-configured` is a build without the cloud set up. From the person's
    // side it is the same fact: the records are on the phone.
    const { getByText } = await renderIdentity({ status: 'not-configured', user: null });

    expect(getByText('Kayıtların yalnızca bu telefonda.')).toBeTruthy();
  });

  it('claims neither while it is still finding out', async () => {
    // The wrong half-second is still wrong: "your records are on this phone
    // only" shown to somebody who is signed in is a false statement about
    // where their data is.
    const { getByText, queryByText } = await renderIdentity({ status: 'loading', user: null });

    expect(queryByText('Kayıtların yalnızca bu telefonda.')).toBeNull();
    expect(getByText('Hesap durumu kontrol ediliyor.')).toBeTruthy();
  });

  it('opens the avatar editor', async () => {
    const onOpenAvatar = jest.fn();
    const { getByLabelText } = await renderIdentity(
      { status: 'signed-out', user: null },
      { onOpenAvatar }
    );

    await fireEvent.press(getByLabelText('Avatar oluştur'));

    expect(onOpenAvatar).toHaveBeenCalledTimes(1);
  });

  it('opens the account screen', async () => {
    const onOpenAccount = jest.fn();
    const { getByLabelText } = await renderIdentity(
      { status: 'signed-out', user: null },
      { onOpenAccount }
    );

    await fireEvent.press(getByLabelText('Hesabı aç'));

    expect(onOpenAccount).toHaveBeenCalledTimes(1);
  });

  it('offers exactly those two controls and nothing else', async () => {
    const { queryAllByRole } = await renderIdentity({ status: 'signed-out', user: null });

    expect(queryAllByRole('button').map((node) => node.props.accessibilityLabel)).toEqual([
      'Avatar oluştur',
      'Hesabı aç',
    ]);
  });
});
