package com.manishmeena.mkai.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.Send
import androidx.compose.material.icons.filled.Mic
import androidx.compose.material.icons.filled.Stop
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.manishmeena.mkai.data.model.ChatMessageDto
import com.manishmeena.mkai.data.model.IntentCommand
import com.manishmeena.mkai.ui.components.AiOrb
import com.manishmeena.mkai.ui.components.VoiceWaveform
import com.manishmeena.mkai.ui.viewmodel.UiState

@Composable
fun ChatScreen(
    uiState: UiState,
    isListening: Boolean,
    isSpeaking: Boolean,
    audioLevel: Float,
    partialText: String,
    onSendMessage: (String) -> Unit,
    onToggleMic: () -> Unit,
    onConfirmPending: () -> Unit,
    onDismissPending: () -> Unit
) {
    var inputText by remember { mutableStateOf("") }
    val quickPrompts = listOf(
        "YouTube kholo",
        "Flashlight on karo",
        "Battery kitni hai?",
        "Mujhe time batao",
        "Camera kholo",
        "Volume kam karo"
    )

    if (uiState.pendingConfirmationCommand != null) {
        ConfirmationDialog(
            command = uiState.pendingConfirmationCommand,
            onConfirm = onConfirmPending,
            onDismiss = onDismissPending
        )
    }

    Column(modifier = Modifier.fillMaxSize()) {
        // Orb & Voice Header
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(top = 8.dp, bottom = 6.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            AiOrb(
                isListening = isListening,
                isThinking = uiState.isThinking,
                isSpeaking = isSpeaking,
                audioLevel = audioLevel,
                size = 94.dp
            )
            if (isListening || isSpeaking) {
                Spacer(Modifier.height(6.dp))
                VoiceWaveform(active = isListening || isSpeaking, audioLevel = audioLevel)
                if (partialText.isNotEmpty()) {
                    Text(
                        text = partialText,
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.secondary,
                        modifier = Modifier.padding(horizontal = 16.dp, vertical = 4.dp)
                    )
                }
            }
            if (!uiState.lastDeviceActionFeedback.isNullOrEmpty()) {
                Text(
                    text = uiState.lastDeviceActionFeedback,
                    style = MaterialTheme.typography.labelMedium,
                    color = MaterialTheme.colorScheme.secondary,
                    modifier = Modifier.padding(top = 4.dp)
                )
            }
        }

        // Chat Transcript
        LazyColumn(
            modifier = Modifier
                .weight(1f)
                .fillMaxWidth()
                .padding(horizontal = 16.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            items(uiState.messages, key = { it.id }) { msg ->
                ChatBubble(msg)
            }
            if (uiState.isThinking) {
                item {
                    Text(
                        text = "M.K AI is thinking...",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f),
                        modifier = Modifier.padding(vertical = 4.dp)
                    )
                }
            }
        }

        // Quick Actions
        LazyRow(
            contentPadding = PaddingValues(horizontal = 16.dp, vertical = 8.dp),
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            items(quickPrompts) { prompt ->
                FilledTonalButton(
                    onClick = { onSendMessage(prompt) },
                    contentPadding = PaddingValues(horizontal = 14.dp, vertical = 6.dp)
                ) {
                    Text(prompt, style = MaterialTheme.typography.labelMedium)
                }
            }
        }

        // Input Bar + Mic
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 12.dp, vertical = 10.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            IconButton(
                onClick = onToggleMic,
                modifier = Modifier
                    .size(48.dp)
                    .clip(CircleShape)
                    .background(
                        if (isListening) MaterialTheme.colorScheme.secondary
                        else MaterialTheme.colorScheme.primary
                    )
            ) {
                Icon(
                    imageVector = if (isListening) Icons.Default.Stop else Icons.Default.Mic,
                    contentDescription = "Voice Input",
                    tint = MaterialTheme.colorScheme.onPrimary
                )
            }

            OutlinedTextField(
                value = inputText,
                onValueChange = { inputText = it },
                placeholder = { Text("Boliye ya likhiye (Hindi / English)...") },
                modifier = Modifier.weight(1f),
                singleLine = true,
                shape = RoundedCornerShape(24.dp)
            )

            IconButton(
                onClick = {
                    if (inputText.isNotBlank()) {
                        onSendMessage(inputText)
                        inputText = ""
                    }
                },
                modifier = Modifier
                    .size(48.dp)
                    .clip(CircleShape)
                    .background(MaterialTheme.colorScheme.surfaceVariant)
            ) {
                Icon(
                    imageVector = Icons.AutoMirrored.Filled.Send,
                    contentDescription = "Send"
                )
            }
        }
    }
}

@Composable
private fun ChatBubble(message: ChatMessageDto) {
    val isUser = message.role == "user"
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = if (isUser) Arrangement.End else Arrangement.Start
    ) {
        Surface(
            color = if (isUser) MaterialTheme.colorScheme.primary
            else MaterialTheme.colorScheme.surfaceVariant,
            shape = RoundedCornerShape(18.dp),
            modifier = Modifier.widthIn(max = 310.dp)
        ) {
            Column(modifier = Modifier.padding(14.dp)) {
                Text(
                    text = message.content,
                    color = if (isUser) MaterialTheme.colorScheme.onPrimary
                    else MaterialTheme.colorScheme.onSurface,
                    style = MaterialTheme.typography.bodyMedium
                )
                if (!isUser && (message.providerId != null || message.command?.action != null && message.command.action != "NONE")) {
                    Spacer(Modifier.height(6.dp))
                    val meta = buildString {
                        if (message.providerId != null) append("${message.providerId} · ${message.model ?: ""}")
                        if (message.command != null && message.command.action != "NONE") {
                            if (isNotEmpty()) append(" · ")
                            append("Action: ${message.command.action}")
                        }
                    }
                    Text(
                        text = meta,
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.65f),
                        fontWeight = FontWeight.Medium
                    )
                }
            }
        }
    }
}

@Composable
private fun ConfirmationDialog(
    command: IntentCommand,
    onConfirm: () -> Unit,
    onDismiss: () -> Unit
) {
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Confirm Device Action") },
        text = {
            Text(
                "M.K AI wants to execute ${command.action}" +
                    (command.target?.let { " for $it" } ?: "") +
                    ". Proceed?"
            )
        },
        confirmButton = {
            Button(onClick = onConfirm) { Text("Allow") }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) { Text("Cancel") }
        }
    )
}
