// Guards the brand assets tool/generate_brand_assets.dart produces. A missing
// density is invisible until a phone in that bucket shows a blank icon, and a
// foreground drawn too large loses its corners to whatever mask the launcher
// applies.
import 'dart:io';
import 'dart:ui' as ui;

import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';

/// dp of each drawing, and the multiplier of every density bucket.
const _legacyDp = 48;
const _adaptiveDp = 108;
const _splashDp = 96;
const _densities = <String, double>{'mdpi': 1, 'hdpi': 1.5, 'xhdpi': 2, 'xxhdpi': 3, 'xxxhdpi': 4};

/// Only the middle 66 of the adaptive icon's 108dp survives every launcher mask.
const _safeZone = 66 / 108;

const _flavors = <String, String>{'principal': '#2456E6', 'teacher': '#0D9488'};

String _res(String flavor) => 'android/app/src/$flavor/res';

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
        }
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
  }

  test('the launch screen shows the mark, not the stock white window', () {
    final xml = File('android/app/src/main/res/drawable/launch_background.xml').readAsStringSync();
    expect(xml, contains('@color/brand_launch_background'));
    expect(xml, contains('@drawable/ic_splash'));
  });
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
