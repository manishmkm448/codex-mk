M.K AI — Native Android Application
Developed by Manish Meena
Architecture: Kotlin · Jetpack Compose · Material 3 · MVVM · Retrofit

"Hello! I am M.K AI, your personal AI assistant. I was developed by Manish Meena. How can I help you today?"

Project Structure
app/build.gradle.kts — Android SDK 35, Compose BOM, Material 3, Retrofit, Security Crypto
app/src/main/AndroidManifest.xml — Official Android permissions & opt-in MkAiAccessibilityService
voice/VoiceAssistantManager.kt — Bilingual Hindi (hi-IN) & English (en-IN) SpeechRecognizer + TextToSpeech
device/PhoneControlManager.kt — 15 native Android phone controls (apps, camera, dialer, SMS, battery, flashlight, volume, Wi-Fi, Bluetooth, location, brightness, device info, date/time, notifications, settings)
data/remote/ — Secure backend communication (zero API keys stored inside the APK)
data/local/SecurePrefs.kt — EncryptedSharedPreferences (AES-256-GCM) for JWT tokens
Exact Instructions for Building the Android APK
1. Open Project in Android Studio
Download or extract the android-app folder (M.K-AI-Android).
Launch Android Studio Ladybug (2024.2+) or newer.
Click File → Open and select the M.K-AI-Android directory (the folder containing settings.gradle.kts).
2. Sync Gradle
Wait for Android Studio to detect the Gradle project and download dependencies.
Ensure JDK 17 is selected under Settings → Build, Execution, Deployment → Build Tools → Gradle.
If prompted, click Sync Now or run:
./gradlew --refresh-dependencies
3. Configure Backend URL
Open app/build.gradle.kts.
Update DEFAULT_BACKEND_URL to your deployed M.K AI backend URL:
Android Emulator talking to local Express server: "http://10.0.2.2:3000/"
Physical Android phone via Cloud Run / Production URL: "https://your-mk-ai-domain.run.app/"
You can also edit the Backend URL live inside the app under Sign In → Configure Backend Server URL or Controls & Settings.
4. Build Debug APK (for Instant Testing)
In Android Studio, select Build → Build Bundle(s) / APK(s) → Build APK(s).
Or via terminal:
./gradlew assembleDebug
Locate your installable APK at: app/build/outputs/apk/debug/app-debug.apk
Install on a connected phone (adb install app/build/outputs/apk/debug/app-debug.apk).
5. Generate Signed Release APK
In Android Studio, select Build → Generate Signed Bundle / APK...
Choose APK and click Next.
Click Create new... to create your keystore (.jks), enter your key alias, passwords, and validity (e.g., 25 years).
Choose release build variant and enable V1 & V2 Signature Versions.
Click Finish. Android Studio builds and signs the production APK at: app/build/outputs/apk/release/app-release.apk
Or via command line after configuring signingConfigs in app/build.gradle.kts:
./gradlew assembleRelease
