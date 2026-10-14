# Store assets

What goes to the Play Console. Everything here is produced from this repository
rather than drawn somewhere else, so it can be made again.

## The three graphics

`generate-store-graphics.mjs` writes them from the icon's own geometry:

```sh
node assets/icon-source/generate-store-graphics.mjs
```

| file | what Play's field takes |
|---|---|
| `feature-tr.png`, `feature-en.png` | 1024x500, 24-bit, **no** alpha |
| `play-icon-512.png` | 512x512, 32-bit **with** alpha |

`feature-base.svg` and `feature-base.png` are the lettering-free intermediate
and are gitignored: the script rewrites them on every run and nothing uploads
them.

### The `f` in "telefonunda"

It looks joined to the `o` and it is not. Measured from the pixels: there are
two columns of pure background between the glyphs, against five columns for the
`e`–`f` and `o`–`n` pairs either side. Fraunces' `f` has a hooked terminal that
overhangs to the right, so that pair sits at less than half the surrounding
rhythm. Not a ligature — a ligature would be one connected shape, and turning
ligatures off changes nothing. Loosening it means letter-spacing that line,
which would move the 189px clearance the type currently keeps from the
crescent, so it would want re-measuring.

## The fourteen screenshots

`screenshots/` holds seven screens in both languages: home, calendar, daily
record, pregnancy, notifications, privacy, and the beyond-horizon state. All
1080x1920, 24-bit, no alpha.

**They came from a local release build of `958bda8`, installed 14 October 2026.**
That line is the one that goes stale. A screenshot is evidence of whatever build
was on the device and nothing in the capture says which — the README's "A
screenshot is evidence of whatever build is on the device" section exists
because a set was nearly published from a build three hours older than the fix
it was meant to show.

Before trusting these again, compare the install time with the commit:

```sh
adb shell dumpsys package com.yusufkosardev.regltakvimi | grep lastUpdateTime
git log -1 --format='%ad' --date=iso
```

The device clock runs UTC and the commit date is local, so a build made from a
commit can look three hours older than it. Compare the same zone.

### How they were taken

Display forced to 1080x1920 (native 1080x2400 is 2.22:1 and fails Play's 2.0
limit), SystemUI demo mode for a fixed status bar, animation scales at 0, and
`ffmpeg -pix_fmt rgb24` to drop the alpha `screencap` emits. The commands are in
the root README under the screenshot notes.

**Capture at rest, not mid-scroll.** The set these replaced had body text
running under the floating tab bar with a sentence cut mid-word, which looks
like a layout bug and is not one: the content simply passes under a translucent
bar while scrolling, and every screen clears it when the scroll settles.

### The data behind them

Entered through the app's own flows, no fixtures: cycle from 3 Ekim 2026 (day 12
on 14 Ekim, follicular), one daily record on 14 Ekim (light · cramps + fatigue ·
good), pregnancy from a last period of 26 Haziran 2026 (week 16 day 6, due 2
April 2027), all three reminder switches on with notification permission
granted. The two horizon shots move the period start back to 6 Eylül, which puts
today at day 39 and past the prediction horizon.

Nothing identifying is on screen: no account, no address, no avatar.
