package com.manishmeena.mkai.data.model

import com.google.gson.annotations.SerializedName

data class LoginRequest(
    val email: String,
    val password: String
)

data class RegisterRequest(
    val name: String,
    val email: String,
    val password: String,
    val preferredLanguage: String = "hi"
)

data class AuthResponse(
    val token: String,
    val user: UserProfile
)

data class UserProfile(
    val id: String,
    val name: String,
    val email: String,
    val role: String,
    val preferredLanguage: String,
    val theme: String,
    val voiceEnabled: Boolean,
    val ttsRate: Float,
    val autoSelectProvider: Boolean,
    val defaultProviderId: String,
    val defaultModel: String
)

data class ProfileUpdateRequest(
    val name: String? = null,
    val preferredLanguage: String? = null,
    val theme: String? = null,
    val voiceEnabled: Boolean? = null,
    val ttsRate: Float? = null,
    val autoSelectProvider: Boolean? = null
)

data class ChatRequest(
    val conversationId: String? = null,
    val message: String,
    val providerId: String? = null,
    val model: String? = null
)

data class IntentCommand(
    val action: String = "NONE",
    val target: String? = null,
    val value: String? = null,
    val requiresConfirmation: Boolean = false
)

data class ChatMessageDto(
    val id: String,
    val role: String,
    val content: String,
    val command: IntentCommand? = null,
    val providerId: String? = null,
    val model: String? = null,
    val latencyMs: Int? = null,
    @SerializedName("created_at") val createdAt: String? = null
)

data class ChatResponse(
    val conversationId: String,
    val message: ChatMessageDto
)

data class ConversationDto(
    val id: String,
    val title: String,
    @SerializedName("last_message") val lastMessage: String? = null,
    @SerializedName("updated_at") val updatedAt: String
)

data class ConversationsResponse(
    val conversations: List<ConversationDto>
)

data class MessagesResponse(
    val messages: List<ChatMessageDto>
)

data class ProviderSummaryDto(
    val id: String,
    val name: String,
    val category: String,
    val enabled: Boolean,
    val selectedModel: String,
    val healthStatus: String,
    val avgLatencyMs: Int
)

data class ProvidersResponse(
    val autoSelectProvider: Boolean,
    val defaultProviderId: String,
    val defaultModel: String,
    val providers: List<ProviderSummaryDto>
)
