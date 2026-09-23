import java.util.Properties

plugins {
    id("com.android.application")
    // The Flutter Gradle Plugin must be applied after the Android and Kotlin Gradle plugins.
    id("dev.flutter.flutter-gradle-plugin")
}

// Read before the android block: null until someone puts a keystore here.
val keystoreProperties: Properties? = rootProject.file("key.properties").takeIf { it.exists() }?.let { file ->
    Properties().apply { file.inputStream().use { load(it) } }
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

    // The upload keystore is not in this repository and must never be. Put
    // android/key.properties (storeFile, storePassword, keyAlias, keyPassword)
    // next to the .jks it names and release builds are signed with it. Without
    // it the build still works, signed with the debug key — fine for a test
    // install, rejected by the Play Store. See README.md.
    signingConfigs {
        if (keystoreProperties != null) {
            create("upload") {
                storeFile = file(keystoreProperties.getProperty("storeFile"))
                storePassword = keystoreProperties.getProperty("storePassword")
                keyAlias = keystoreProperties.getProperty("keyAlias")
                keyPassword = keystoreProperties.getProperty("keyPassword")
            }
        }
    }

    buildTypes {
        release {
            signingConfig = signingConfigs.getByName(if (keystoreProperties != null) "upload" else "debug")
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
