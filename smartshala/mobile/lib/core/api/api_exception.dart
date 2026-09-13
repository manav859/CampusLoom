import 'package:flutter/foundation.dart';

import 'package:dio/dio.dart';

/// The backend always fails as `{ "error": { "code", "message", "details" } }`.
class ApiException implements Exception {
  ApiException({required this.message, required this.code, this.statusCode});

  final String message;
  final String code;
  final int? statusCode;

  bool get isUnauthorized => statusCode == 401;
  bool get isForbidden => statusCode == 403;
  bool get isOffline => code == 'NETWORK_ERROR';

  factory ApiException.fromDio(DioException error) {
    switch (error.type) {
      case DioExceptionType.connectionTimeout:
      case DioExceptionType.receiveTimeout:
      case DioExceptionType.sendTimeout:
        return ApiException(
          message: 'The server took too long to respond. Please try again.',
          code: 'TIMEOUT',
        );
      case DioExceptionType.connectionError:
      case DioExceptionType.unknown:
        // In debug the usual cause is a backend that is not running, or a
        // device that cannot see API_BASE_URL — naming the host it tried saves
        // guessing. Release builds keep the plain message.
        final host = error.requestOptions.uri.origin;
        return ApiException(
          message: kDebugMode
              ? 'Cannot reach SmartShala at $host. Check that the backend is '
                  'running and reachable from this device.'
              : 'Cannot reach SmartShala. Check your internet connection.',
          code: 'NETWORK_ERROR',
        );
      default:
        break;
    }

    final status = error.response?.statusCode;
    final data = error.response?.data;

    if (data is Map && data['error'] is Map) {
      final payload = data['error'] as Map;
      return ApiException(
        message: (payload['message'] as String?)?.trim().isNotEmpty == true
            ? payload['message'] as String
            : 'Something went wrong.',
        code: payload['code'] as String? ?? 'APP_ERROR',
        statusCode: status,
      );
    }

    return ApiException(
      message: 'Something went wrong. Please try again.',
      code: 'APP_ERROR',
      statusCode: status,
    );
  }

  @override
  String toString() => message;
}
