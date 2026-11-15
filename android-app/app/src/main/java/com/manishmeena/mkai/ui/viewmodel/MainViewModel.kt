package com.manishmeena.mkai.ui.viewmodel

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.manishmeena.mkai.MkAiApplication
import com.manishmeena.mkai.data.model.*
import com.manishmeena.mkai.data.remote.MkAiApiService
import com.manishmeena.mkai.data.remote.RetrofitClient
import com.manishmeena.mkai.device.PhoneControlManager
import com.manishmeena.mkai.device.PhoneExecutionResult
import com.manishmeena.mkai.voice.VoiceAssistantManager
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch

data class UiState(
    val isAuthenticated: Boolean = false,
    val user: UserProfile? = null,
    val isLoading: Boolean = false,
    val isThinking: Boolean = false,
    val error: String? = null,
    val darkTheme: Boolean = true,
    val preferredLanguage: String = "hi",
    val continuousVoice: Boolean = false,
    val backendUrl: String = "",
    val conversations: List<ConversationDto> = emptyList(),
    val activeConversationId: String? = null,
    val messages: List<ChatMessageDto> = emptyList(),
    val providers: List<ProviderSummaryDto> = emptyList(),
    val pendingConfirmationCommand: IntentCommand? = null,
    val pendingPermissionRequest: String? = null,
    val lastDeviceActionFeedback: String? = null
)

class MainViewModel(application: Application) : AndroidViewModel(application) {
    private val prefs = (application as MkAiApplication).securePrefs
    private var api: MkAiApiService = RetrofitClient.create(prefs)
    val phoneController = PhoneControlManager(application)

    private val _uiState = MutableStateFlow(
        UiState(
            isAuthenticated = !prefs.authToken.isNullOrBlank(),
            darkTheme = prefs.darkTheme,
            preferredLanguage = prefs.preferredLanguage,
            continuousVoice = prefs.continuousVoice,
            backendUrl = prefs.backendUrl
        )
    )
    val uiState: StateFlow<UiState> = _uiState

    val voiceManager = VoiceAssistantManager(
        context = application,
        onTranscriptReady = { spoken -> sendMessage(spoken) },
        onError = { err -> _uiState.value = _uiState.value.copy(error = err) }
    )

    init {
        voiceManager.setLanguage(prefs.preferredLanguage)
        if (!prefs.authToken.isNullOrBlank()) {
            loadSessionData()
        }
    }

    fun updateBackendUrl(url: String) {
        prefs.backendUrl = url.trim()
        api = RetrofitClient.create(prefs)
        _uiState.value = _uiState.value.copy(backendUrl = prefs.backendUrl, error = null)
    }

    fun login(email: String, password: String) {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true, error = null)
            try {
                val res = api.login(LoginRequest(email.trim(), password))
                prefs.authToken = res.token
                prefs.userEmail = res.user.email
                prefs.preferredLanguage = res.user.preferredLanguage
                voiceManager.setLanguage(res.user.preferredLanguage)
                _uiState.value = _uiState.value.copy(
                    isAuthenticated = true,
                    user = res.user,
                    preferredLanguage = res.user.preferredLanguage,
                    isLoading = false
                )
                loadSessionData()
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(
                    isLoading = false,
                    error = e.message ?: "Login failed"
                )
            }
        }
    }

    fun register(name: String, email: String, password: String) {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true, error = null)
            try {
                val res = api.register(
                    RegisterRequest(name.trim(), email.trim(), password, prefs.preferredLanguage)
                )
                prefs.authToken = res.token
                prefs.userEmail = res.user.email
                _uiState.value = _uiState.value.copy(
                    isAuthenticated = true,
                    user = res.user,
                    isLoading = false
                )
                loadSessionData()
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(
                    isLoading = false,
                    error = e.message ?: "Registration failed"
                )
            }
        }
    }

    fun logout() {
        voiceManager.stopListening()
        voiceManager.stopSpeaking()
        prefs.clearSession()
        _uiState.value = UiState(
            isAuthenticated = false,
            darkTheme = prefs.darkTheme,
            preferredLanguage = prefs.preferredLanguage,
            backendUrl = prefs.backendUrl
        )
    }

    fun loadSessionData() {
        viewModelScope.launch {
            try {
                val profile = api.getProfile()["user"]
                val convs = api.getConversations().conversations
                val providersRes = api.getProviders()
                val firstConvId = convs.firstOrNull()?.id
                val msgs = if (firstConvId != null) {
                    api.getMessages(firstConvId).messages
                } else {
                    listOf(
                        ChatMessageDto(
                            id = "welcome",
                            role = "assistant",
                            content = "Hello! I am M.K AI, your personal AI assistant. I was developed by Manish Meena. How can I help you today?"
                        )
                    )
                }
                _uiState.value = _uiState.value.copy(
                    user = profile,
                    conversations = convs,
                    activeConversationId = firstConvId,
                    messages = msgs,
                    providers = providersRes.providers
                )
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(error = e.message)
            }
        }
    }

    fun sendMessage(text: String) {
        val trimmed = text.trim()
        if (trimmed.isEmpty()) return

        val optimisticUser = ChatMessageDto(
            id = "local_${System.currentTimeMillis()}",
            role = "user",
            content = trimmed
        )
        _uiState.value = _uiState.value.copy(
            messages = _uiState.value.messages + optimisticUser,
            isThinking = true,
            error = null
        )

        viewModelScope.launch {
            try {
                val res = api.sendChat(
                    ChatRequest(
                        conversationId = _uiState.value.activeConversationId,
                        message = trimmed
                    )
                )
                var assistantMsg = res.message
                val cmd = assistantMsg.command

                if (cmd != null && cmd.action != "NONE") {
                    val execResult = phoneController.executeCommand(cmd, confirmed = false)
                    handleExecutionResult(execResult, cmd)
                    if (execResult.executed && execResult.summary.isNotEmpty() &&
                        (cmd.action == "GET_BATTERY" || cmd.action == "GET_DEVICE_INFO" || cmd.action == "GET_DATETIME")
                    ) {
                        assistantMsg = assistantMsg.copy(
                            content = "${assistantMsg.content}\n\n${execResult.summary}"
                        )
                    }
                }

                _uiState.value = _uiState.value.copy(
                    activeConversationId = res.conversationId,
                    messages = _uiState.value.messages + assistantMsg,
                    isThinking = false
                )

                if (_uiState.value.user?.voiceEnabled != false) {
                    voiceManager.speak(assistantMsg.content, _uiState.value.user?.ttsRate ?: 1.0f)
                }
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(
                    isThinking = false,
                    error = e.message ?: "Failed to reach M.K AI backend"
                )
            }
        }
    }

    private fun handleExecutionResult(result: PhoneExecutionResult, cmd: IntentCommand) {
        if (result.needsConfirmation) {
            _uiState.value = _uiState.value.copy(pendingConfirmationCommand = cmd)
        } else if (result.needsPermission != null) {
            _uiState.value = _uiState.value.copy(
                pendingPermissionRequest = result.needsPermission,
                lastDeviceActionFeedback = result.summary
            )
        } else if (result.summary.isNotEmpty()) {
            _uiState.value = _uiState.value.copy(lastDeviceActionFeedback = result.summary)
        }
    }

    fun confirmPendingCommand() {
        val cmd = _uiState.value.pendingConfirmationCommand ?: return
        _uiState.value = _uiState.value.copy(pendingConfirmationCommand = null)
        val result = phoneController.executeCommand(cmd, confirmed = true)
        _uiState.value = _uiState.value.copy(lastDeviceActionFeedback = result.summary)
    }

    fun dismissPendingCommand() {
        _uiState.value = _uiState.value.copy(pendingConfirmationCommand = null)
    }

    fun clearPermissionPrompt() {
        _uiState.value = _uiState.value.copy(pendingPermissionRequest = null)
    }

    fun toggleTheme() {
        val next = !_uiState.value.darkTheme
        prefs.darkTheme = next
        _uiState.value = _uiState.value.copy(darkTheme = next)
    }

    fun setLanguage(lang: String) {
        prefs.preferredLanguage = lang
        voiceManager.setLanguage(lang)
        _uiState.value = _uiState.value.copy(preferredLanguage = lang)
        viewModelScope.launch {
            runCatching { api.updateProfile(ProfileUpdateRequest(preferredLanguage = lang)) }
        }
    }

    fun toggleContinuousVoice(enabled: Boolean) {
        prefs.continuousVoice = enabled
        _uiState.value = _uiState.value.copy(continuousVoice = enabled)
    }

    fun toggleMicrophone() {
        if (voiceManager.isListening.value) {
            voiceManager.stopListening()
        } else {
            val tag = if (_uiState.value.preferredLanguage == "en") "en-IN" else "hi-IN"
            voiceManager.startListening(tag, _uiState.value.continuousVoice)
        }
    }

    fun startNewChat() {
        _uiState.value = _uiState.value.copy(
            activeConversationId = null,
            messages = listOf(
                ChatMessageDto(
                    id = "welcome_${System.currentTimeMillis()}",
                    role = "assistant",
                    content = "Hello! I am M.K AI, your personal AI assistant. I was developed by Manish Meena. How can I help you today?"
                )
            )
        )
    }

    fun clearError() {
        _uiState.value = _uiState.value.copy(error = null)
    }

    override fun onCleared() {
        super.onCleared()
        voiceManager.release()
    }
}
