// Builds the launcher icons, the launch-screen mark, the Play Store icon and
// the in-app logo for both flavors from the web dashboard's logo, so the apps
// wear exactly the mark the web does. Nothing imports this: it is run by hand
// after the brand changes.
//
//   flutter test tool/generate_brand_assets.dart
//
// The source is frontend/public/logo-latest.png: a white interlocked "SS" on a
// blue square. The blue becomes the launcher background, and the white mark is
// lifted off it onto transparency for the adaptive icon's foreground layer.
import 'dart:io';
import 'dart:typed_data';
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

/// Relative to the mobile/ project, where the command is run. The default mark
/// for any flavor without its own entry in [_sources].
const _source = '../frontend/public/logo-latest.png';

/// Each app wears the web's logo. The label under the icon and the background
/// colour tell them apart.
const _flavors = ['principal', 'teacher', 'parent'];

/// Per-flavor mark source, overriding [_source]. The teacher app carries its
/// own refreshed "SS", so its mark is lifted from its own file rather than the
/// shared web logo.
const _sources = <String, String>{'teacher': '../frontend/public/logo-teacher.png'};

/// Per-flavor launcher background, overriding the source logo's blue so the
/// apps are told apart on the home screen. A flavor absent here keeps the blue.
const _grounds = <String, Color>{
  'parent': Color(0xFF2E7D32), // leaf green
  'teacher': Color(0xFF5B3CFC), // indigo
};

/// Android density buckets, as a multiple of mdpi.
const _densities = <String, double>{'mdpi': 1, 'hdpi': 1.5, 'xhdpi': 2, 'xxhdpi': 3, 'xxxhdpi': 4};

/// The legacy launcher icon is 48dp, the adaptive layers are drawn on a 108dp
/// canvas of which only the middle 66dp survives every mask, and the
/// launch-screen mark shows at 96dp. The status-bar notification icon is 24dp.
const _legacyDp = 48.0;
const _adaptiveDp = 108.0;
const _splashDp = 96.0;
const _notificationDp = 24.0;

/// How much of each canvas the mark fills. The adaptive figure keeps it well
/// inside the 61% safe zone; a circular mask cuts the corners off anything
/// larger. The legacy and splash marks sit on their own blue square.
const _legacyInkFraction = 0.5;
const _adaptiveInkFraction = 0.42;

/// The notification icon is drawn almost edge to edge. It has no ground of its
/// own: Android reads only its alpha, tints the result white or grey, and adds
/// its own padding around it in the status bar and the shade.
const _notificationInkFraction = 0.9;

/// Corner radius of the rounded square, as a fraction of its side. iOS rounds
/// and masks app icons itself and rejects one that arrives pre-rounded, so the
/// iOS set is drawn with a corner of 0 — a full-bleed square.
const _cornerFraction = 0.22;

/// The iOS app icon set, file name to pixel size: every size Xcode's asset
/// catalog asks for, at the names its Contents.json uses.
const _iosIcons = <String, int>{
  'Icon-App-20x20@1x.png': 20,
  'Icon-App-20x20@2x.png': 40,
  'Icon-App-20x20@3x.png': 60,
  'Icon-App-29x29@1x.png': 29,
  'Icon-App-29x29@2x.png': 58,
  'Icon-App-29x29@3x.png': 87,
  'Icon-App-40x40@1x.png': 40,
  'Icon-App-40x40@2x.png': 80,
  'Icon-App-40x40@3x.png': 120,
  'Icon-App-60x60@2x.png': 120,
  'Icon-App-60x60@3x.png': 180,
  'Icon-App-76x76@1x.png': 76,
  'Icon-App-76x76@2x.png': 152,
  'Icon-App-83.5x83.5@2x.png': 167,
  'Icon-App-1024x1024@1x.png': 1024,
};

/// The in-app logo, shown at up to 40dp: 4x for the densest screens.
const _inAppSize = 160;

/// iOS draws one launch screen for both flavors — they wear the same mark — so
/// this set is shared, unlike Android's per-flavor ic_splash.
const _iosLaunchScales = <String, int>{'': 1, '@2x': 2, '@3x': 3};

void main() {
  testWidgets('generate brand assets', (WidgetTester tester) async {
    // Every line below touches the real world - decoding, encoding, writing
    // files - and the test binding freezes the clock, so an await outside
    // runAsync never comes back.
    await tester.runAsync(() async {
      final root = Directory.current.path;

      // Lift each distinct source once: the shared web logo for most flavors,
      // the teacher app's own file for teacher.
      final lifted = <String, _Lifted>{};
      Future<_Lifted> load(String source) async =>
          lifted[source] ??= await _loadSource('$root/$source');

      final shared = await load(_source);

      for (final flavor in _flavors) {
        final res = '$root/android/app/src/$flavor/res';
        final src = await load(_sources[flavor] ?? _source);
        final logo = src.logo;
        final mark = src.mark;
        final ground = _grounds[flavor] ?? src.ground;

        for (final density in _densities.entries) {
          final scale = density.value;
          await _write(
            '$res/mipmap-${density.key}/ic_launcher.png',
            await _paint((_legacyDp * scale).round(), mark: mark, ground: ground, ink: _legacyInkFraction),
          );
          await _write(
            '$res/drawable-${density.key}/ic_launcher_foreground.png',
            await _paint((_adaptiveDp * scale).round(), mark: mark, ink: _adaptiveInkFraction),
          );
          await _write(
            '$res/drawable-${density.key}/ic_splash.png',
            await _paint((_splashDp * scale).round(), mark: mark, ground: ground, ink: _legacyInkFraction),
          );
          await _write(
            '$res/drawable-${density.key}/ic_notification.png',
            await _paint((_notificationDp * scale).round(), mark: mark, ink: _notificationInkFraction),
          );
        }

        // The adaptive icon, with the same foreground as the monochrome layer so
        // Android 13 themed icons get the mark rather than a filled square.
        await _writeText('$res/mipmap-anydpi-v26/ic_launcher.xml', _adaptiveIconXml);
        await _writeText('$res/values/ic_launcher_background.xml', _backgroundColorXml(ground));

        // What a Play Store listing asks for: 512x512, square, and no rounding of
        // our own — the store applies its own mask. A flavor with its own ground
        // wears the launcher's mark-on-ground so the listing matches the icon the
        // phone shows; the rest keep the web logo as is.
        await _write(
          '$root/store/$flavor/icon-512.png',
          _grounds.containsKey(flavor)
              ? await _paint(512, mark: mark, ground: ground, ink: _legacyInkFraction, corner: 0)
              : await _scaled(logo, 512),
        );

        // iOS. One asset catalog per flavor, named by FLAVOR_APP_ICON in
        // ios/Flutter/<flavor>.xcconfig, so the two apps can hold different
        // marks later without touching the Xcode project.
        final iconset = '$root/ios/Runner/Assets.xcassets/AppIcon-$flavor.appiconset';
        for (final icon in _iosIcons.entries) {
          await _write(
            '$iconset/${icon.key}',
            await _paint(icon.value, mark: mark, ground: ground, ink: _legacyInkFraction, corner: 0),
          );
        }
        await _writeText('$iconset/Contents.json', _iosContentsJson);
      }

      // The iOS launch screen, which ships blank white otherwise: the same
      // mark at the same size Android's ic_splash draws, on the background
      // LaunchScreen.storyboard paints behind it.
      for (final scale in _iosLaunchScales.entries) {
        await _write(
          '$root/ios/Runner/Assets.xcassets/LaunchImage.imageset/LaunchImage${scale.key}.png',
          await _paint((_splashDp * scale.value).round(), mark: shared.mark, ground: shared.ground, ink: _legacyInkFraction),
        );
      }

      // The app bar and sign-in screen mark: the web logo itself.
      await _write('$root/assets/brand/logo.png', await _scaled(shared.logo, _inAppSize));
    });
  });
}

/// A decoded mark source: the whole logo, its white mark lifted onto
/// transparency, and the ground colour it was lifted off.
typedef _Lifted = ({ui.Image logo, ({ui.Image image, Rect bounds}) mark, Color ground});

Future<_Lifted> _loadSource(String path) async {
  final logo = await _decode(await File(path).readAsBytes());
  final pixels = (await logo.toByteData(format: ui.ImageByteFormat.rawRgba))!;
  final ground = _pixel(pixels, logo.width, 4, 4);
  final mark = await _liftMark(pixels, logo.width, logo.height, ground);
  return (logo: logo, mark: mark, ground: ground);
}

const _adaptiveIconXml = '''<?xml version="1.0" encoding="utf-8"?>
<!-- Generated by tool/generate_brand_assets.dart -->
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@color/ic_launcher_background" />
    <foreground android:drawable="@drawable/ic_launcher_foreground" />
    <monochrome android:drawable="@drawable/ic_launcher_foreground" />
</adaptive-icon>
''';

/// Xcode's index of the icon set above — the Flutter template's own file,
/// identical for both flavors.
const _iosContentsJson = '''{
  "images" : [
    {
      "size" : "20x20",
      "idiom" : "iphone",
      "filename" : "Icon-App-20x20@2x.png",
      "scale" : "2x"
    },
    {
      "size" : "20x20",
      "idiom" : "iphone",
      "filename" : "Icon-App-20x20@3x.png",
      "scale" : "3x"
    },
    {
      "size" : "29x29",
      "idiom" : "iphone",
      "filename" : "Icon-App-29x29@1x.png",
      "scale" : "1x"
    },
    {
      "size" : "29x29",
      "idiom" : "iphone",
      "filename" : "Icon-App-29x29@2x.png",
      "scale" : "2x"
    },
    {
      "size" : "29x29",
      "idiom" : "iphone",
      "filename" : "Icon-App-29x29@3x.png",
      "scale" : "3x"
    },
    {
      "size" : "40x40",
      "idiom" : "iphone",
      "filename" : "Icon-App-40x40@2x.png",
      "scale" : "2x"
    },
    {
      "size" : "40x40",
      "idiom" : "iphone",
      "filename" : "Icon-App-40x40@3x.png",
      "scale" : "3x"
    },
    {
      "size" : "60x60",
      "idiom" : "iphone",
      "filename" : "Icon-App-60x60@2x.png",
      "scale" : "2x"
    },
    {
      "size" : "60x60",
      "idiom" : "iphone",
      "filename" : "Icon-App-60x60@3x.png",
      "scale" : "3x"
    },
    {
      "size" : "20x20",
      "idiom" : "ipad",
      "filename" : "Icon-App-20x20@1x.png",
      "scale" : "1x"
    },
    {
      "size" : "20x20",
      "idiom" : "ipad",
      "filename" : "Icon-App-20x20@2x.png",
      "scale" : "2x"
    },
    {
      "size" : "29x29",
      "idiom" : "ipad",
      "filename" : "Icon-App-29x29@1x.png",
      "scale" : "1x"
    },
    {
      "size" : "29x29",
      "idiom" : "ipad",
      "filename" : "Icon-App-29x29@2x.png",
      "scale" : "2x"
    },
    {
      "size" : "40x40",
      "idiom" : "ipad",
      "filename" : "Icon-App-40x40@1x.png",
      "scale" : "1x"
    },
    {
      "size" : "40x40",
      "idiom" : "ipad",
      "filename" : "Icon-App-40x40@2x.png",
      "scale" : "2x"
    },
    {
      "size" : "76x76",
      "idiom" : "ipad",
      "filename" : "Icon-App-76x76@1x.png",
      "scale" : "1x"
    },
    {
      "size" : "76x76",
      "idiom" : "ipad",
      "filename" : "Icon-App-76x76@2x.png",
      "scale" : "2x"
    },
    {
      "size" : "83.5x83.5",
      "idiom" : "ipad",
      "filename" : "Icon-App-83.5x83.5@2x.png",
      "scale" : "2x"
    },
    {
      "size" : "1024x1024",
      "idiom" : "ios-marketing",
      "filename" : "Icon-App-1024x1024@1x.png",
      "scale" : "1x"
    }
  ],
  "info" : {
    "version" : 1,
    "author" : "xcode"
  }
}
''';

String _backgroundColorXml(Color color) {
  final hex = color.toARGB32().toRadixString(16).substring(2).toUpperCase();
  return '''<?xml version="1.0" encoding="utf-8"?>
<!-- Generated by tool/generate_brand_assets.dart -->
<resources>
    <color name="ic_launcher_background">#$hex</color>
</resources>
''';
}

Future<ui.Image> _decode(Uint8List bytes) async {
  final codec = await ui.instantiateImageCodec(bytes);
  return (await codec.getNextFrame()).image;
}

Color _pixel(ByteData pixels, int width, int x, int y) {
  final offset = (y * width + x) * 4;
  return Color.fromARGB(255, pixels.getUint8(offset), pixels.getUint8(offset + 1), pixels.getUint8(offset + 2));
}

/// The white mark on transparency, trimmed to its ink. Each pixel's opacity is
/// how far it sits from the blue ground towards white, so the anti-aliased
/// edges of the logo stay smooth.
Future<({ui.Image image, Rect bounds})> _liftMark(ByteData source, int width, int height, Color ground) async {
  final out = Uint8List(width * height * 4);
  final channels = [(ground.r * 255).round(), (ground.g * 255).round(), (ground.b * 255).round()];
  var left = width, top = height, right = 0, bottom = 0;

  for (var y = 0; y < height; y++) {
    for (var x = 0; x < width; x++) {
      final offset = (y * width + x) * 4;
      var whiteness = 1.0;
      for (var channel = 0; channel < 3; channel++) {
        final base = channels[channel];
        if (base >= 250) continue;
        final value = (source.getUint8(offset + channel) - base) / (255 - base);
        if (value < whiteness) whiteness = value;
      }
      final alpha = (whiteness.clamp(0.0, 1.0) * 255).round();
      out[offset] = 255;
      out[offset + 1] = 255;
      out[offset + 2] = 255;
      out[offset + 3] = alpha;
      if (alpha > 24) {
        if (x < left) left = x;
        if (x > right) right = x;
        if (y < top) top = y;
        if (y > bottom) bottom = y;
      }
    }
  }
  if (right < left || bottom < top) throw StateError('No white mark found in $_source');

  final image = await _fromPixels(out, width, height);
  return (image: image, bounds: Rect.fromLTRB(left.toDouble(), top.toDouble(), right + 1.0, bottom + 1.0));
}

Future<ui.Image> _fromPixels(Uint8List pixels, int width, int height) async {
  final buffer = await ui.ImmutableBuffer.fromUint8List(pixels);
  final descriptor = ui.ImageDescriptor.raw(buffer, width: width, height: height, pixelFormat: ui.PixelFormat.rgba8888);
  final codec = await descriptor.instantiateCodec();
  return (await codec.getNextFrame()).image;
}

/// The mark centred on a [size] by [size] canvas, on a rounded square of
/// [ground] when given, else on transparency. [ink] is the share of the canvas
/// the mark's longer side fills, [corner] the radius as a fraction of the side.
Future<Uint8List> _paint(
  int size, {
  required ({ui.Image image, Rect bounds}) mark,
  Color? ground,
  required double ink,
  double corner = _cornerFraction,
}) async {
  final recorder = ui.PictureRecorder();
  final canvas = Canvas(recorder);
  final side = size.toDouble();

  if (ground != null) {
    canvas.drawRRect(
      RRect.fromRectAndRadius(Rect.fromLTWH(0, 0, side, side), Radius.circular(side * corner)),
      Paint()..color = ground,
    );
  }

  final bounds = mark.bounds;
  final longest = bounds.width > bounds.height ? bounds.width : bounds.height;
  final scale = (side * ink) / longest;
  final target = Rect.fromCenter(
    center: Offset(side / 2, side / 2),
    width: bounds.width * scale,
    height: bounds.height * scale,
  );
  canvas.drawImageRect(mark.image, bounds, target, Paint()..filterQuality = FilterQuality.high);

  return _encode(recorder.endRecording(), size);
}

/// The whole logo, scaled to [size].
Future<Uint8List> _scaled(ui.Image logo, int size) async {
  final recorder = ui.PictureRecorder();
  Canvas(recorder).drawImageRect(
    logo,
    Rect.fromLTWH(0, 0, logo.width.toDouble(), logo.height.toDouble()),
    Rect.fromLTWH(0, 0, size.toDouble(), size.toDouble()),
    Paint()..filterQuality = FilterQuality.high,
  );
  return _encode(recorder.endRecording(), size);
}

Future<Uint8List> _encode(ui.Picture picture, int size) async {
  final image = await picture.toImage(size, size);
  final png = (await image.toByteData(format: ui.ImageByteFormat.png))!;
  image.dispose();
  return png.buffer.asUint8List();
}

Future<void> _write(String path, Uint8List bytes) async {
  final file = File(path);
  await file.parent.create(recursive: true);
  await file.writeAsBytes(bytes);
}

Future<void> _writeText(String path, String text) async {
  final file = File(path);
  await file.parent.create(recursive: true);
  await file.writeAsString(text);
}
