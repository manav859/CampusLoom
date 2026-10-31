// Guards the brand assets tool/generate_brand_assets.dart produces. A missing
// density is invisible until a phone in that bucket shows a blank icon, and a
// foreground drawn too large loses its corners to whatever mask the launcher
// applies.
import 'dart:convert';
import 'dart:io';
import 'dart:ui' as ui;

import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';

/// dp of each drawing, and the multiplier of every density bucket.
const _legacyDp = 48;
const _adaptiveDp = 108;
const _splashDp = 96;
const _notificationDp = 24;
const _densities = <String, double>{'mdpi': 1, 'hdpi': 1.5, 'xhdpi': 2, 'xxhdpi': 3, 'xxxhdpi': 4};

/// Only the middle 66 of the adaptive icon's 108dp survives every launcher mask.
const _safeZone = 66 / 108;

/// Principal wears the web dashboard's blue; teacher wears its own indigo.
const _flavors = <String, String>{'principal': '#003DE5', 'teacher': '#5B3CFC'};

String _res(String flavor) => 'android/app/src/$flavor/res';

/// Named by FLAVOR_APP_ICON in `ios/Flutter/<flavor>.xcconfig` — rename one and
/// the other has to follow.
String _iconset(String flavor) => 'ios/Runner/Assets.xcassets/AppIcon-$flavor.appiconset';

void main() {
  for (final flavor in _flavors.keys) {
    group('$flavor launcher assets', () {
      test('every density is drawn at the right size', () async {
        for (final density in _densities.entries) {
          final scale = density.value;
          await _expectSquare('${_res(flavor)}/mipmap-${density.key}/ic_launcher.png', (_legacyDp * scale).round());
          await _expectSquare(
            '${_res(flavor)}/drawable-${density.key}/ic_launcher_foreground.png',
            (_adaptiveDp * scale).round(),
          );
          await _expectSquare('${_res(flavor)}/drawable-${density.key}/ic_splash.png', (_splashDp * scale).round());
          await _expectSquare(
            '${_res(flavor)}/drawable-${density.key}/ic_notification.png',
            (_notificationDp * scale).round(),
          );
        }
      });

      test('the notification icon is a transparent silhouette, not a square', () async {
        // Android reads this icon's alpha and tints it, so a drawing with an
        // opaque ground shows up in the status bar as a solid white block.
        final image = await _decode('${_res(flavor)}/drawable-xxxhdpi/ic_notification.png');
        final pixels = (await image.toByteData(format: ui.ImageByteFormat.rawRgba))!;
        final last = image.width - 1;
        for (final corner in [(0, 0), (last, 0), (0, last), (last, last)]) {
          final alpha = pixels.getUint8(((corner.$2 * image.width) + corner.$1) * 4 + 3);
          expect(alpha, 0, reason: 'corner ${corner.$1},${corner.$2} is painted');
        }

        // Nearly edge to edge: Android adds its own padding, and a mark drawn
        // small here is a speck in the shade.
        final ink = await _inkBounds(image);
        final side = image.width.toDouble();
        expect(ink.longestSide, greaterThan(side * 0.8));
        expect((ink.center.dx - side / 2).abs(), lessThan(side * 0.02));
        expect((ink.center.dy - side / 2).abs(), lessThan(side * 0.02));
      });

      test('the adaptive foreground stays inside the mask', () async {
        final image = await _decode('${_res(flavor)}/drawable-xxxhdpi/ic_launcher_foreground.png');
        final ink = await _inkBounds(image);
        final side = image.width.toDouble();

        expect(ink.width, greaterThan(side * 0.2), reason: 'the glyph should not be a speck');
        expect(ink.longestSide, lessThanOrEqualTo(side * _safeZone), reason: 'the mask would clip it');
        // Centred within a pixel or two of the middle.
        expect((ink.center.dx - side / 2).abs(), lessThan(side * 0.02));
        expect((ink.center.dy - side / 2).abs(), lessThan(side * 0.02));
      });

      test('the adaptive icon names a background, a foreground and a monochrome layer', () {
        final xml = File('${_res(flavor)}/mipmap-anydpi-v26/ic_launcher.xml').readAsStringSync();
        expect(xml, contains('<background android:drawable="@color/ic_launcher_background"'));
        expect(xml, contains('<foreground android:drawable="@drawable/ic_launcher_foreground"'));
        // Android 13 themed icons fall back to a flat square without this.
        expect(xml, contains('<monochrome android:drawable="@drawable/ic_launcher_foreground"'));
      });

      test('the background colour is the portal colour', () {
        final xml = File('${_res(flavor)}/values/ic_launcher_background.xml').readAsStringSync();
        expect(xml, contains('<color name="ic_launcher_background">${_flavors[flavor]}</color>'));
      });
    });

    group('$flavor iOS app icon', () {
      test('every size Contents.json asks for is drawn at that size', () async {
        final wanted = _iosSizes(flavor);
        // The set Xcode expects; a short one means the index was hand-edited.
        expect(wanted.length, 15);
        for (final icon in wanted.entries) {
          await _expectSquare('${_iconset(flavor)}/${icon.key}', icon.value);
        }
      });

      test('the icon is a full-bleed opaque square', () async {
        // iOS applies its own rounding and rejects an icon that arrives with
        // transparency, so every corner has to be painted.
        final image = await _decode('${_iconset(flavor)}/Icon-App-1024x1024@1x.png');
        final pixels = (await image.toByteData(format: ui.ImageByteFormat.rawRgba))!;
        final last = image.width - 1;
        for (final corner in [(0, 0), (last, 0), (0, last), (last, last)]) {
          final alpha = pixels.getUint8(((corner.$2 * image.width) + corner.$1) * 4 + 3);
          expect(alpha, 255, reason: 'corner ${corner.$1},${corner.$2} is see-through');
        }
      });
    });
  }

  test('the launch screen shows the mark, not the stock white window', () {
    final xml = File('android/app/src/main/res/drawable/launch_background.xml').readAsStringSync();
    expect(xml, contains('@color/brand_launch_background'));
    expect(xml, contains('@drawable/ic_splash'));
  });

  group('the iOS launch screen', () {
    const set = 'ios/Runner/Assets.xcassets/LaunchImage.imageset';

    test('carries the mark at every scale', () async {
      // Flutter ships a 1x1 transparent pixel here, which is to say a blank
      // white window on every cold start.
      for (final scale in {'': 1, '@2x': 2, '@3x': 3}.entries) {
        await _expectSquare('$set/LaunchImage${scale.key}.png', 96 * scale.value);
      }
    });

    test('is painted the same colour as the Android one', () {
      final storyboard = File('ios/Runner/Base.lproj/LaunchScreen.storyboard').readAsStringSync();
      // #F7F8FB, matching brand_launch_background in colors.xml.
      expect(storyboard, contains('red="0.96862745098039216"'));
      expect(storyboard, contains('green="0.97254901960784312"'));
      expect(storyboard, contains('blue="0.98431372549019602"'));
    });
  });
}

/// The iOS icon set as the asset catalog declares it: file name to the pixel
/// size its points-by-scale works out to.
Map<String, int> _iosSizes(String flavor) {
  final path = '${_iconset(flavor)}/Contents.json';
  final file = File(path);
  expect(file.existsSync(), isTrue, reason: '$path is missing — run tool/generate_brand_assets.dart');

  final images = (jsonDecode(file.readAsStringSync()) as Map<String, dynamic>)['images'] as List<dynamic>;
  return {
    for (final image in images.cast<Map<String, dynamic>>())
      image['filename'] as String:
          (double.parse((image['size'] as String).split('x').first) * int.parse((image['scale'] as String)[0])).round(),
  };
}

Future<void> _expectSquare(String path, int expected) async {
  final file = File(path);
  expect(file.existsSync(), isTrue, reason: '$path is missing — run tool/generate_brand_assets.dart');
  final image = await _decode(path);
  expect(image.width, expected, reason: '$path is ${image.width}px wide, expected $expected');
  expect(image.height, expected, reason: '$path is ${image.height}px tall, expected $expected');
}

Future<ui.Image> _decode(String path) async {
  final codec = await ui.instantiateImageCodec(await File(path).readAsBytes());
  return (await codec.getNextFrame()).image;
}

/// The bounding box of the pixels this image actually marks.
Future<Rect> _inkBounds(ui.Image image) async {
  final pixels = (await image.toByteData(format: ui.ImageByteFormat.rawRgba))!;
  var left = image.width, top = image.height, right = 0, bottom = 0;
  for (var y = 0; y < image.height; y++) {
    for (var x = 0; x < image.width; x++) {
      if (pixels.getUint8((y * image.width + x) * 4 + 3) > 8) {
        if (x < left) left = x;
        if (x > right) right = x;
        if (y < top) top = y;
        if (y > bottom) bottom = y;
      }
    }
  }
  expect(right, greaterThanOrEqualTo(left), reason: 'nothing was drawn');
  return Rect.fromLTRB(left.toDouble(), top.toDouble(), right + 1.0, bottom + 1.0);
}
