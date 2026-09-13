import 'package:flutter_test/flutter_test.dart';
import 'package:smartshala_mobile/features/auth/login_screen.dart';

/// The login form is the only place a bad school code can be caught before it
/// becomes a request to a tenant URL the server will reject.
void main() {
  group('school code', () {
    test('accepts an eight-character code in either case', () {
      expect(validateSchoolCode('SS000001'), isNull);
      expect(validateSchoolCode('  b03fad2f '), isNull);
    });

    test('rejects blank, short, long and punctuated codes', () {
      expect(validateSchoolCode(''), 'Enter your school code');
      expect(validateSchoolCode('   '), 'Enter your school code');
      expect(validateSchoolCode('SS0001'), isNotNull);
      expect(validateSchoolCode('SS0000012'), isNotNull);
      expect(validateSchoolCode('DEMO-SCH'), isNotNull);
    });
  });

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
