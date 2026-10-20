import 'package:flutter_test/flutter_test.dart';
import 'package:smartshala_mobile/features/auth/login_screen.dart';

/// The form catches a malformed identifier or password before it costs a
/// round trip. There is no school code to check: the server finds the tenant
/// from the identifier and returns it.
void main() {
  group('identifier', () {
    test('accepts an email or a ten-digit phone', () {
      expect(validateIdentifier('rekha.sharma@smartshala.local'), isNull);
      expect(validateIdentifier(' 9876504115 '), isNull);
    });

    test('rejects blanks, malformed emails and short phone numbers', () {
      expect(validateIdentifier(null), 'Enter your email or phone');
      expect(validateIdentifier('rekha@'), isNotNull);
      expect(validateIdentifier('98765'), isNotNull);
    });
  });

  group('password', () {
    test('accepts six characters or more, up to the server maximum', () {
      expect(validatePassword('secret'), isNull);
      expect(validatePassword('a' * 72), isNull);
    });

    test('rejects an empty, short or over-long password', () {
      expect(validatePassword(''), 'Enter your password');
      expect(validatePassword('short'), isNotNull);
      expect(validatePassword('a' * 73), isNotNull);
    });
  });
}
