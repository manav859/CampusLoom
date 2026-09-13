plugins {
    id("com.android.application")
    // The Flutter Gradle Plugin must be applied after the Android and Kotlin Gradle plugins.
    id("dev.flutter.flutter-gradle-plugin")
}

android {
    namespace = "com.smartshala.smartshala_mobile"
    compileSdk = flutter.compileSdkVersion
    ndkVersion = flutter.ndkVersion

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    defaultConfig {
        applicationId = "com.smartshala.smartshala_mobile"
        // You can update the following values to match your application needs.
        // For more information, see: https://flutter.dev/to/review-gradle-config.
        minSdk = flutter.minSdkVersion
        targetSdk = flutter.targetSdkVersion
        versionCode = flutter.versionCode
        versionName = flutter.versionName
    }

    // The Principal and Teacher portals ship as two Play Store apps built from
    // one codebase. Each flavor pairs with its own entrypoint:
    //   flutter run --flavor principal -t lib/main_principal.dart
    //   flutter run --flavor teacher   -t lib/main_teacher.dart
    // Required for the per-flavor app_name resValue below.
    buildFeatures {
        resValues = true
    }

    flavorDimensions += "portal"

    productFlavors {
        create("principal") {
            dimension = "portal"
            applicationId = "com.smartshala.principal"
            resValue("string", "app_name", "SmartShala Principal")
        }
        create("teacher") {
            dimension = "portal"
            applicationId = "com.smartshala.teacher"
            resValue("string", "app_name", "SmartShala Teacher")
        }
    }

    buildTypes {
        release {
            // TODO: Add your own signing config for the release build.
            // Signing with the debug keys for now, so `flutter run --release` works.
            signingConfig = signingConfigs.getByName("debug")
        }
    }
}

kotlin {
    compilerOptions {
        jvmTarget = org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_17
    }
}

flutter {
    source = "../.."
}
