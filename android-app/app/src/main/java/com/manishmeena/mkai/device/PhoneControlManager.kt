package com.manishmeena.mkai.device

import android.Manifest
import android.app.ActivityManager
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.hardware.camera2.CameraCharacteristics
import android.hardware.camera2.CameraManager
import android.media.AudioManager
import android.net.Uri
import android.os.BatteryManager
import android.os.Build
import android.provider.MediaStore
import android.provider.Settings
import androidx.core.content.ContextCompat
import com.manishmeena.mkai.data.model.IntentCommand
import java.time.ZonedDateTime
import java.time.format.DateTimeFormatter
import java.util.Locale

data class PhoneExecutionResult(
    val executed: Boolean,
    val summary: String,
    val needsPermission: String? = null,
    val needsConfirmation: Boolean = false,
    val pendingCommand: IntentCommand? = null
)

class PhoneControlManager(private val context: Context) {

    private var torchEnabled = false

    fun executeCommand(command: IntentCommand, confirmed: Boolean = false): PhoneExecutionResult {
        if (command.requiresConfirmation && !confirmed) {
            return PhoneExecutionResult(
                executed = false,
                summary = "Confirmation required for ${command.action}",
                needsConfirmation = true,
                pendingCommand = command
            )
        }

        return when (command.action) {
            "OPEN_APP" -> openInstalledApp(command.target ?: "")
            "OPEN_CAMERA" -> openCamera()
            "DIAL_PHONE" -> openDialerOrCall(command.target ?: "", directCall = confirmed)
            "SEND_SMS" -> prepareSms(command.target ?: "", command.value ?: "")
            "GET_BATTERY" -> readBatteryInfo()
            "TOGGLE_FLASHLIGHT" -> controlFlashlight(command.value ?: "toggle")
            "ADJUST_VOLUME" -> adjustMediaVolume(command.value ?: "up")
            "OPEN_WIFI_SETTINGS" -> openSystemSettings(Settings.ACTION_WIFI_SETTINGS, "Wi-Fi settings")
            "OPEN_BLUETOOTH_SETTINGS" -> openSystemSettings(Settings.ACTION_BLUETOOTH_SETTINGS, "Bluetooth settings")
            "OPEN_LOCATION_SETTINGS" -> openSystemSettings(Settings.ACTION_LOCATION_SOURCE_SETTINGS, "Location settings")
            "ADJUST_BRIGHTNESS" -> adjustScreenBrightness(command.value ?: "up")
            "GET_DEVICE_INFO" -> readDeviceInfo()
            "GET_DATETIME" -> readDateTime()
            "OPEN_NOTIFICATION_SETTINGS" -> openNotificationSettings()
            "OPEN_SETTINGS" -> openSystemSettings(Settings.ACTION_SETTINGS, "Android settings")
            else -> PhoneExecutionResult(executed = false, summary = "")
        }
    }

    // 1. Open installed applications
    fun openInstalledApp(appName: String): PhoneExecutionResult {
        val normalized = appName.trim().lowercase(Locale.ROOT)
        if (normalized.isEmpty()) {
            return PhoneExecutionResult(false, "Please specify which app to open.")
        }

        val wellKnownPackages = mapOf(
            "youtube" to "com.google.android.youtube",
            "whatsapp" to "com.whatsapp",
            "google" to "com.google.android.googlequicksearchbox",
            "chrome" to "com.android.chrome",
            "instagram" to "com.instagram.android",
            "spotify" to "com.spotify.music",
            "gmail" to "com.google.android.gm",
            "maps" to "com.google.android.apps.maps",
            "calculator" to "com.google.android.calculator"
        )

        val pm = context.packageManager
        val directPkg = wellKnownPackages.entries.firstOrNull { normalized.contains(it.key) }?.value
        if (directPkg != null) {
            pm.getLaunchIntentForPackage(directPkg)?.let { intent ->
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                context.startActivity(intent)
                return PhoneExecutionResult(true, "Opened $appName")
            }
        }

        val launcherIntent = Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER)
        val apps = pm.queryIntentActivities(launcherIntent, 0)
        val matched = apps.firstOrNull {
            it.loadLabel(pm).toString().lowercase(Locale.ROOT).contains(normalized)
        }

        if (matched != null) {
            pm.getLaunchIntentForPackage(matched.activityInfo.packageName)?.let { launchIntent ->
                launchIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                context.startActivity(launchIntent)
                return PhoneExecutionResult(true, "Opened ${matched.loadLabel(pm)}")
            }
        }

        return PhoneExecutionResult(false, "App '$appName' was not found on this device.")
    }

    // 2. Open camera
    fun openCamera(): PhoneExecutionResult {
        if (ContextCompat.checkSelfPermission(context, Manifest.permission.CAMERA)
            != PackageManager.PERMISSION_GRANTED
        ) {
            return PhoneExecutionResult(
                executed = false,
                summary = "Camera permission is required to launch the camera.",
                needsPermission = Manifest.permission.CAMERA
            )
        }
        val intent = Intent(MediaStore.ACTION_IMAGE_CAPTURE).apply {
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        return try {
            context.startActivity(intent)
            PhoneExecutionResult(true, "Camera launched")
        } catch (e: Exception) {
            PhoneExecutionResult(false, "Unable to open camera: ${e.message}")
        }
    }

    // 3. Open dialer and initiate call with user confirmation
    fun openDialerOrCall(target: String, directCall: Boolean): PhoneExecutionResult {
        val sanitized = target.filter { it.isDigit() || it == '+' }
        val action = if (directCall &&
            sanitized.isNotEmpty() &&
            ContextCompat.checkSelfPermission(context, Manifest.permission.CALL_PHONE) == PackageManager.PERMISSION_GRANTED
        ) {
            Intent.ACTION_CALL
        } else {
            Intent.ACTION_DIAL
        }

        val intent = Intent(action, Uri.parse("tel:$sanitized")).apply {
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        context.startActivity(intent)
        return PhoneExecutionResult(true, "Opened phone dialer for $target")
    }

    // 4. Open SMS app and prepare message
    fun prepareSms(target: String, messageBody: String): PhoneExecutionResult {
        val sanitized = target.filter { it.isDigit() || it == '+' }
        val intent = Intent(Intent.ACTION_SENDTO, Uri.parse("smsto:$sanitized")).apply {
            putExtra("sms_body", messageBody)
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        context.startActivity(intent)
        return PhoneExecutionResult(true, "Prepared SMS draft for $target")
    }

    // 5. Read battery level
    fun readBatteryInfo(): PhoneExecutionResult {
        val bm = context.getSystemService(Context.BATTERY_SERVICE) as BatteryManager
        val level = bm.getIntProperty(BatteryManager.BATTERY_PROPERTY_CAPACITY)
        val charging = bm.isCharging
        val statusText = if (charging) "Charging" else "Discharging"
        return PhoneExecutionResult(true, "Battery: $level% ($statusText)")
    }

    // 6. Control flashlight where supported
    fun controlFlashlight(mode: String): PhoneExecutionResult {
        val cm = context.getSystemService(Context.CAMERA_SERVICE) as CameraManager
        val cameraId = cm.cameraIdList.firstOrNull { id ->
            cm.getCameraCharacteristics(id)
                .get(CameraCharacteristics.FLASH_INFO_AVAILABLE) == true
        } ?: return PhoneExecutionResult(false, "No flashlight hardware detected on this device.")

        val desiredState = when (mode.lowercase(Locale.ROOT)) {
            "on", "true", "enable" -> true
            "off", "false", "disable" -> false
            else -> !torchEnabled
        }

        return try {
            cm.setTorchMode(cameraId, desiredState)
            torchEnabled = desiredState
            PhoneExecutionResult(true, "Flashlight turned ${if (desiredState) "ON" else "OFF"}")
        } catch (e: Exception) {
            PhoneExecutionResult(false, "Flashlight unavailable: ${e.message}")
        }
    }

    // 7. Adjust media volume
    fun adjustMediaVolume(direction: String): PhoneExecutionResult {
        val am = context.getSystemService(Context.AUDIO_SERVICE) as AudioManager
        val max = am.getStreamMaxVolume(AudioManager.STREAM_MUSIC)
        val current = am.getStreamVolume(AudioManager.STREAM_MUSIC)

        val percent = direction.filter { it.isDigit() }.toIntOrNull()
        when {
            percent != null -> {
                val targetVol = ((percent.coerceIn(0, 100) / 100f) * max).toInt()
                am.setStreamVolume(AudioManager.STREAM_MUSIC, targetVol, AudioManager.FLAG_SHOW_UI)
            }
            direction.lowercase(Locale.ROOT) in listOf("down", "kam", "low", "decrease") -> {
                am.adjustStreamVolume(AudioManager.STREAM_MUSIC, AudioManager.ADJUST_LOWER, AudioManager.FLAG_SHOW_UI)
            }
            direction.lowercase(Locale.ROOT) == "mute" -> {
                am.setStreamVolume(AudioManager.STREAM_MUSIC, 0, AudioManager.FLAG_SHOW_UI)
            }
            else -> {
                am.adjustStreamVolume(AudioManager.STREAM_MUSIC, AudioManager.ADJUST_RAISE, AudioManager.FLAG_SHOW_UI)
            }
        }
        val updated = am.getStreamVolume(AudioManager.STREAM_MUSIC)
        val pct = if (max > 0) (updated * 100) / max else 0
        return PhoneExecutionResult(true, "Media volume adjusted to $pct% (was $current/$max)")
    }

    // 8, 9, 10, 15. Open Settings panels
    fun openSystemSettings(action: String, label: String): PhoneExecutionResult {
        val intent = Intent(action).apply { addFlags(Intent.FLAG_ACTIVITY_NEW_TASK) }
        return try {
            context.startActivity(intent)
            PhoneExecutionResult(true, "Opened $label")
        } catch (e: Exception) {
            PhoneExecutionResult(false, "Could not open $label: ${e.message}")
        }
    }

    // 11. Control screen brightness where supported (requires WRITE_SETTINGS)
    fun adjustScreenBrightness(value: String): PhoneExecutionResult {
        if (!Settings.System.canWrite(context)) {
            val intent = Intent(
                Settings.ACTION_MANAGE_WRITE_SETTINGS,
                Uri.parse("package:${context.packageName}")
            ).apply { addFlags(Intent.FLAG_ACTIVITY_NEW_TASK) }
            context.startActivity(intent)
            return PhoneExecutionResult(
                executed = false,
                summary = "Please allow 'Modify system settings' to control screen brightness."
            )
        }

        val current = Settings.System.getInt(
            context.contentResolver,
            Settings.System.SCREEN_BRIGHTNESS,
            128
        )
        val pct = value.filter { it.isDigit() }.toIntOrNull()
        val next = when {
            pct != null -> ((pct.coerceIn(5, 100) / 100f) * 255).toInt()
            value.lowercase(Locale.ROOT) in listOf("down", "kam", "low") -> (current - 50).coerceAtLeast(15)
            else -> (current + 50).coerceAtMost(255)
        }

        Settings.System.putInt(
            context.contentResolver,
            Settings.System.SCREEN_BRIGHTNESS_MODE,
            Settings.System.SCREEN_BRIGHTNESS_MODE_MANUAL
        )
        Settings.System.putInt(context.contentResolver, Settings.System.SCREEN_BRIGHTNESS, next)
        val nextPct = (next * 100) / 255
        return PhoneExecutionResult(true, "Screen brightness set to $nextPct%")
    }

    // 12. Read device information
    fun readDeviceInfo(): PhoneExecutionResult {
        val am = context.getSystemService(Context.ACTIVITY_SERVICE) as ActivityManager
        val memInfo = ActivityManager.MemoryInfo()
        am.getMemoryInfo(memInfo)
        val totalRamGb = String.format(Locale.US, "%.1f", memInfo.totalMem / (1024.0 * 1024.0 * 1024.0))
        val info = "${Build.MANUFACTURER.uppercase(Locale.ROOT)} ${Build.MODEL} · Android ${Build.VERSION.RELEASE} (SDK ${Build.VERSION.SDK_INT}) · $totalRamGb GB RAM"
        return PhoneExecutionResult(true, info)
    }

    // 13. Show date and time
    fun readDateTime(): PhoneExecutionResult {
        val now = ZonedDateTime.now()
        val formatted = now.format(DateTimeFormatter.ofPattern("EEEE, dd MMM yyyy · hh:mm a", Locale.ENGLISH))
        return PhoneExecutionResult(true, formatted)
    }

    // 14. Open notification settings
    fun openNotificationSettings(): PhoneExecutionResult {
        val intent = Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).apply {
            putExtra(Settings.EXTRA_APP_PACKAGE, context.packageName)
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        context.startActivity(intent)
        return PhoneExecutionResult(true, "Opened notification settings")
    }
}
