import { StyleSheet, View } from 'react-native';

import type { AvatarConfig } from '../domain/avatar-config';
import { describeAvatar } from '../presentation/avatar-labels';
import type { AvatarVisuals } from '../presentation/avatar-visuals';
import { resolveAvatarVisuals } from '../presentation/avatar-visuals';

/**
 * The avatar, drawn.
 *
 * Plain `View`s and nothing else: no SVG, no canvas, no image files. Every part
 * is a rectangle with a corner radius, stacked absolutely on a fixed canvas, so
 * the whole thing scales by multiplying one number and needs nothing bundled
 * with the app.
 *
 * It holds no mapping of its own. Which colour a skin tone is and what a hair
 * style looks like both live in `presentation/avatar-visuals`, so this file is
 * layout and that file is the design — and a catalogue change only ever touches
 * the latter.
 *
 * Nothing here can fail on an avatar it does not recognise: the visuals resolve
 * every id, falling back to neutral, so an avatar saved before a catalogue edit
 * still draws as a person rather than as an error.
 */

/**
 * The canvas, in design units, at the large size.
 *
 * One coordinate space for every part, so a change to the head moves the ears
 * and the glasses with it instead of leaving them behind.
 */
const CANVAS = { width: 132, height: 152 };
const HEAD = { width: 68, height: 76, left: 32, top: 20 };
const EAR = { width: 12, height: 18, top: 58 };
const NECK = { width: 24, height: 20, left: 54, top: 88 };
const BODY = { height: 50 };
const EYE = { size: 7, top: 56, left: 48, right: 77 };
const MOUTH = { width: 18, height: 4, left: 57, top: 76 };

export type AvatarPreviewProps = {
  readonly config: AvatarConfig;
  /** `small` is the version Home shows next to a link; `large` is the editor's. */
  readonly size?: 'small' | 'large';
  readonly testID?: string;
};

export function AvatarPreview({ config, size = 'large', testID }: AvatarPreviewProps) {
  const visuals = resolveAvatarVisuals(config);
  const scale = size === 'large' ? 1 : 0.5;
  const u = (value: number) => value * scale;

  return (
    // One accessible element: the avatar is a single thing on screen, so it is a
    // single thing to a screen reader rather than a dozen unlabelled boxes.
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={describeAvatar(config)}
      testID={testID}
      style={{ width: u(CANVAS.width), height: u(CANVAS.height) }}>
      <HairBack visuals={visuals} u={u} />
      <Neck visuals={visuals} u={u} />
      <Outfit visuals={visuals} u={u} />
      <Head visuals={visuals} u={u} />
      <Ears visuals={visuals} u={u} />
      <HairFront visuals={visuals} u={u} />
      <Face visuals={visuals} u={u} />
      <Accessory visuals={visuals} u={u} />
    </View>
  );
}

type Part = { visuals: AvatarVisuals; u: (value: number) => number };

/** The length of hair that falls behind the head and shoulders. */
function HairBack({ visuals, u }: Part) {
  const { hairShape, hair } = visuals;
  const spread = HEAD.width * hairShape.volume;
  const fall = HEAD.height * hairShape.length;

  return (
    <View
      style={[
        styles.layer,
        {
          left: u(HEAD.left - spread),
          top: u(HEAD.top - 6),
          width: u(HEAD.width + spread * 2),
          height: u(HEAD.height * 0.7 + fall),
          backgroundColor: hair.shade,
          borderTopLeftRadius: u(HEAD.width * 0.5),
          borderTopRightRadius: u(HEAD.width * 0.5),
          // A wave ends in a soft curl; anything else ends bluntly.
          borderBottomLeftRadius: u(hairShape.scallop ? HEAD.width * 0.45 : HEAD.width * 0.12),
          borderBottomRightRadius: u(hairShape.scallop ? HEAD.width * 0.45 : HEAD.width * 0.12),
        },
      ]}
    />
  );
}

function Neck({ visuals, u }: Part) {
  return (
    <View
      style={[
        styles.layer,
        {
          left: u(NECK.left),
          top: u(NECK.top),
          width: u(NECK.width),
          height: u(NECK.height),
          backgroundColor: visuals.skin.shade,
        },
      ]}
    />
  );
}

/** The garment: a block of shoulders, plus whatever the neckline does. */
function Outfit({ visuals, u }: Part) {
  const { outfitShape, outfit } = visuals;
  const width = CANVAS.width * outfitShape.width;
  const left = (CANVAS.width - width) / 2;
  const top = CANVAS.height - BODY.height;

  return (
    <>
      <View
        style={[
          styles.layer,
          {
            left: u(left),
            top: u(top),
            width: u(width),
            height: u(BODY.height),
            backgroundColor: outfit.base,
            borderTopLeftRadius: u(width * outfitShape.corner),
            borderTopRightRadius: u(width * outfitShape.corner),
          },
        ]}
      />

      {outfitShape.neckline === 'round' && (
        <View
          style={[
            styles.layer,
            {
              left: u(CANVAS.width / 2 - 15),
              top: u(top - 3),
              width: u(30),
              height: u(14),
              backgroundColor: outfit.trim,
              borderBottomLeftRadius: u(15),
              borderBottomRightRadius: u(15),
            },
          ]}
        />
      )}

      {outfitShape.neckline === 'placket' && (
        <View
          style={[
            styles.layer,
            {
              left: u(CANVAS.width / 2 - 4),
              top: u(top),
              width: u(8),
              height: u(BODY.height),
              backgroundColor: outfit.trim,
            },
          ]}
        />
      )}

      {outfitShape.neckline === 'strap' && (
        <>
          <View
            style={[
              styles.layer,
              {
                left: u(left + width * 0.22),
                top: u(top - 10),
                width: u(7),
                height: u(14),
                backgroundColor: outfit.trim,
              },
            ]}
          />
          <View
            style={[
              styles.layer,
              {
                left: u(left + width * 0.78 - 7),
                top: u(top - 10),
                width: u(7),
                height: u(14),
                backgroundColor: outfit.trim,
              },
            ]}
          />
        </>
      )}
    </>
  );
}

function Head({ visuals, u }: Part) {
  return (
    <View
      style={[
        styles.layer,
        {
          left: u(HEAD.left),
          top: u(HEAD.top),
          width: u(HEAD.width),
          height: u(HEAD.height),
          backgroundColor: visuals.skin.base,
          // Taller than wide and rounded unevenly, so it reads as a face rather
          // than a ball.
          borderRadius: u(HEAD.width * 0.46),
          borderBottomLeftRadius: u(HEAD.width * 0.42),
          borderBottomRightRadius: u(HEAD.width * 0.42),
        },
      ]}
    />
  );
}

function Ears({ visuals, u }: Part) {
  const style = {
    top: u(EAR.top),
    width: u(EAR.width),
    height: u(EAR.height),
    backgroundColor: visuals.skin.shade,
    borderRadius: u(EAR.width / 2),
  };

  return (
    <>
      <View style={[styles.layer, style, { left: u(HEAD.left - EAR.width + 3) }]} />
      <View style={[styles.layer, style, { left: u(HEAD.left + HEAD.width - 3) }]} />
    </>
  );
}

/** The fringe over the forehead, plus a gathered knot when the style has one. */
function HairFront({ visuals, u }: Part) {
  const { hairShape, hair } = visuals;
  const spread = HEAD.width * hairShape.volume;

  return (
    <>
      <View
        style={[
          styles.layer,
          {
            left: u(HEAD.left - spread * 0.6),
            top: u(HEAD.top - 4),
            width: u(HEAD.width + spread * 1.2),
            height: u(HEAD.height * 0.42),
            backgroundColor: hair.base,
            borderTopLeftRadius: u(HEAD.width * 0.5),
            borderTopRightRadius: u(HEAD.width * 0.5),
            borderBottomLeftRadius: u(HEAD.width * hairShape.fringe),
            borderBottomRightRadius: u(HEAD.width * hairShape.fringe),
          },
        ]}
      />

      {hairShape.knot && (
        <View
          style={[
            styles.layer,
            {
              left: u(CANVAS.width / 2 - 14),
              top: u(HEAD.top - 22),
              width: u(28),
              height: u(28),
              backgroundColor: hair.base,
              borderRadius: u(14),
            },
          ]}
        />
      )}
    </>
  );
}

/** Eyes and a mouth, in whatever reads on this skin tone. */
function Face({ visuals, u }: Part) {
  const eye = {
    top: u(EYE.top),
    width: u(EYE.size),
    height: u(EYE.size),
    backgroundColor: visuals.skin.feature,
    borderRadius: u(EYE.size / 2),
  };

  return (
    <>
      <View style={[styles.layer, eye, { left: u(EYE.left) }]} />
      <View style={[styles.layer, eye, { left: u(EYE.right) }]} />

      <View
        style={[
          styles.layer,
          {
            left: u(MOUTH.left),
            top: u(MOUTH.top),
            width: u(MOUTH.width),
            height: u(MOUTH.height),
            backgroundColor: visuals.skin.feature,
            borderRadius: u(MOUTH.height),
          },
        ]}
      />
    </>
  );
}

/** Whichever accessory was chosen, drawn where it would actually sit. */
function Accessory({ visuals, u }: Part) {
  const { accessory, hair, skin } = visuals;

  if (accessory === null) {
    return null;
  }

  if (accessory === 'glasses') {
    const lens = {
      top: u(EYE.top - 6),
      width: u(22),
      height: u(19),
      borderWidth: u(2.5),
      borderColor: skin.feature,
      borderRadius: u(7),
    };

    return (
      <>
        <View style={[styles.layer, lens, { left: u(EYE.left - 8) }]} />
        <View style={[styles.layer, lens, { left: u(EYE.right - 10) }]} />
        <View
          style={[
            styles.layer,
            {
              left: u(EYE.left + 14),
              top: u(EYE.top + 1),
              width: u(9),
              height: u(2.5),
              backgroundColor: skin.feature,
            },
          ]}
        />
      </>
    );
  }

  if (accessory === 'earrings') {
    const stud = {
      top: u(EAR.top + EAR.height - 5),
      width: u(8),
      height: u(8),
      backgroundColor: '#E2B84B',
      borderRadius: u(4),
    };

    return (
      <>
        <View style={[styles.layer, stud, { left: u(HEAD.left - EAR.width + 5) }]} />
        <View style={[styles.layer, stud, { left: u(HEAD.left + HEAD.width - 1) }]} />
      </>
    );
  }

  // A clip sits on the hair rather than the face, so it is drawn against the
  // fringe and tinted to stand off whatever colour the hair is.
  return (
    <View
      style={[
        styles.layer,
        {
          left: u(HEAD.left + 4),
          top: u(HEAD.top + 8),
          width: u(20),
          height: u(7),
          backgroundColor: '#E2B84B',
          borderColor: hair.shade,
          borderWidth: u(1),
          borderRadius: u(3.5),
        },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  layer: {
    position: 'absolute',
  },
});
