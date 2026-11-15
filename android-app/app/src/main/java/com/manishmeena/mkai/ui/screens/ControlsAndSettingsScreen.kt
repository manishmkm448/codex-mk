package com.manishmeena.mkai.ui.screens

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.provider.Settings
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.core.content.ContextCompat
import com.manishmeena.mkai.device.PhoneControlManager
import com.manishmeena.mkai.ui.viewmodel.UiState

@Composable
fun ControlsAndSettingsScreen(
    uiState: UiState,
    phoneController: PhoneControlManager,
    onRequestPermission: (String) -> Unit,
    onToggleTheme: () -> Unit,
    onSelectLanguage: (String) -> Unit,
    onToggleContinuousVoice: (Boolean) -> Unit,
    onUpdateBackendUrl: (String) -> Unit,
    onLogout: () -> Unit
) {
    val context = LocalContext.current
    var actionFeedback by remember { mutableStateOf<String?>(null) }
    var serverInput by remember(uiState.backendUrl) { mutableStateOf(uiState.backendUrl) }

    val micGranted = ContextCompat.checkSelfPermission(
        context,
        Manifest.permission.RECORD_AUDIO
    ) == PackageManager.PERMISSION_GRANTED
    val cameraGranted = ContextCompat.checkSelfPermission(
        context,
        Manifest.permission.CAMERA
    ) == PackageManager.PERMISSION_GRANTED
    val writeSettingsGranted = Settings.System.canWrite(context)

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        Text(
            text = "Device Controls & Permissions",
            style = MaterialTheme.typography.titleLarge,
            fontWeight = FontWeight.Bold
        )

        if (actionFeedback != null) {
            Surface(
                color = MaterialTheme.colorScheme.surfaceVariant,
                shape = MaterialTheme.shapes.medium,
                modifier = Modifier.fillMaxWidth()
            ) {
                Text(
                    text = actionFeedback!!,
                    modifier = Modifier.padding(12.dp),
                    style = MaterialTheme.typography.bodySmall
                )
            }
        }

        // Quick native phone controls
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            OutlinedButton(
                onClick = { actionFeedback = phoneController.controlFlashlight("toggle").summary },
                modifier = Modifier.weight(1f)
            ) { Text("Flashlight") }
            OutlinedButton(
                onClick = { actionFeedback = phoneController.readBatteryInfo().summary },
                modifier = Modifier.weight(1f)
            ) { Text("Battery") }
        }

        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            OutlinedButton(
                onClick = { actionFeedback = phoneController.readDeviceInfo().summary },
                modifier = Modifier.weight(1f)
            ) { Text("Device Info") }
            OutlinedButton(
                onClick = {
                    actionFeedback = phoneController.openSystemSettings(
                        Settings.ACTION_WIFI_SETTINGS,
                        "Wi-Fi settings"
                    ).summary
                },
                modifier = Modifier.weight(1f)
            ) { Text("Wi-Fi Settings") }
        }

        HorizontalDivider()

        Text(
            text = "Permissions Transparency",
            style = MaterialTheme.typography.titleMedium,
            fontWeight = FontWeight.SemiBold
        )

        PermissionRow(
            title = "Microphone (RECORD_AUDIO)",
            reason = "Required strictly when you tap the mic for Hindi/English speech recognition.",
            granted = micGranted,
            onAction = { onRequestPermission(Manifest.permission.RECORD_AUDIO) }
        )

        PermissionRow(
            title = "Camera (CAMERA)",
            reason = "Required to launch camera capture on your voice command.",
            granted = cameraGranted,
            onAction = { onRequestPermission(Manifest.permission.CAMERA) }
        )

        PermissionRow(
            title = "Modify System Settings (WRITE_SETTINGS)",
            reason = "Required only to adjust screen brightness when requested.",
            granted = writeSettingsGranted,
            onAction = {
                val intent = Intent(
                    Settings.ACTION_MANAGE_WRITE_SETTINGS,
                    Uri.parse("package:${context.packageName}")
                )
                context.startActivity(intent)
            }
        )

        OutlinedButton(
            onClick = {
                context.startActivity(Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS))
            },
            modifier = Modifier.fillMaxWidth()
        ) {
            Text("Manage Optional Accessibility Helper")
        }

        HorizontalDivider()

        Text(
            text = "Assistant Preferences",
            style = MaterialTheme.typography.titleMedium,
            fontWeight = FontWeight.SemiBold
        )

        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text("Primary Language")
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                FilterChip(
                    selected = uiState.preferredLanguage == "hi",
                    onClick = { onSelectLanguage("hi") },
                    label = { Text("Hindi") }
                )
                FilterChip(
                    selected = uiState.preferredLanguage == "en",
                    onClick = { onSelectLanguage("en") },
                    label = { Text("English") }
                )
            }
        }

        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text("Dark Neon Theme")
            Switch(checked = uiState.darkTheme, onCheckedChange = { onToggleTheme() })
        }

        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text("Continuous Listening (Active App)")
            Switch(
                checked = uiState.continuousVoice,
                onCheckedChange = onToggleContinuousVoice
            )
        }

        OutlinedTextField(
            value = serverInput,
            onValueChange = { serverInput = it },
            label = { Text("Backend Server URL") },
            singleLine = true,
            modifier = Modifier.fillMaxWidth()
        )
        Button(onClick = { onUpdateBackendUrl(serverInput) }) {
            Text("Update Server URL")
        }

        OutlinedButton(
            onClick = onLogout,
            modifier = Modifier.fillMaxWidth(),
            colors = ButtonDefaults.outlinedButtonColors(contentColor = MaterialTheme.colorScheme.error)
        ) {
            Text("Sign Out (${uiState.user?.email ?: ""})")
        }
    }
}

@Composable
private fun PermissionRow(
    title: String,
    reason: String,
    granted: Boolean,
    onAction: () -> Unit
) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Column(modifier = Modifier.weight(1f).padding(end = 12.dp)) {
            Text(title, style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.Medium)
            Text(
                reason,
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.7f)
            )
        }
        if (granted) {
            Text("Granted", style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.secondary)
        } else {
            FilledTonalButton(onClick = onAction) { Text("Allow") }
        }
    }
}
