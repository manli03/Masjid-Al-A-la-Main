# Add project specific ProGuard rules here.
# You can control the set of applied configuration files using the
# proguardFiles setting in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# If your project uses WebView with JS, uncomment the following
# and specify the fully qualified class name to the JavaScript interface
# class:
#-keepclassmembers class fqcn.of.javascript.interface.for.webview {
#   public *;
#}

# Uncomment this to preserve the line number information for
# debugging stack traces.
-keepattributes SourceFile,LineNumberTable

# If you keep the line number information, uncomment this to
# hide the original source file name.
#-renamesourcefileattribute SourceFile

# ============================================================
# Capacitor Core - Keep all internal classes from being obfuscated
# Without these rules, R8 obfuscates Capacitor's internal permission
# checking classes (e.g., PermissionState renamed to "C"), causing
# NullPointerException in getPermissionStates() during release builds.
# ============================================================
-keep class com.getcapacitor.** { *; }
-keep class com.capacitorjs.** { *; }

# Keep all Capacitor annotations
-keepattributes *Annotation*
-keepattributes JavascriptInterface