package com.manishmeena.mkai.ui.screens

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp

@Composable
fun AboutScreen() {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(20.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp)
    ) {
        Text(
            text = "About M.K AI",
            style = MaterialTheme.typography.headlineSmall,
            fontWeight = FontWeight.Bold
        )
        Text(
            text = "Developer: Manish Meena",
            style = MaterialTheme.typography.titleMedium,
            color = MaterialTheme.colorScheme.secondary
        )
        Text(
            text = "M.K AI is a personal AI assistant developed by Manish Meena to make smartphone interaction smarter, faster and easier.",
            style = MaterialTheme.typography.bodyLarge
        )
        HorizontalDivider()
        Text(
            text = "Architecture & Security",
            style = MaterialTheme.typography.titleMedium,
            fontWeight = FontWeight.SemiBold
        )
        Text(
            text = "• Native Kotlin + Jetpack Compose + Material 3 MVVM\n" +
                "• Bilingual Hindi & English SpeechRecognizer + TextToSpeech\n" +
                "• Server-side Google Gemini & 16+ Multi-Provider AI Gateway\n" +
                "• Zero API keys stored inside APK source code\n" +
                "• EncryptedSharedPreferences (AES-256) for session tokens\n" +
                "• Explicit user confirmation for calls, SMS, and system settings",
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.85f)
        )
    }
}
