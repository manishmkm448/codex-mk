package com.manishmeena.mkai

import android.Manifest
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.lifecycle.viewmodel.compose.viewModel
import com.manishmeena.mkai.ui.screens.AboutScreen
import com.manishmeena.mkai.ui.screens.AuthScreen
import com.manishmeena.mkai.ui.screens.ChatScreen
import com.manishmeena.mkai.ui.screens.ControlsAndSettingsScreen
import com.manishmeena.mkai.ui.theme.MkAiTheme
import com.manishmeena.mkai.ui.viewmodel.MainViewModel
import kotlinx.coroutines.launch

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            val vm: MainViewModel = viewModel()
            val uiState by vm.uiState.collectAsState()
            val isListening by vm.voiceManager.isListening.collectAsState()
            val isSpeaking by vm.voiceManager.isSpeaking.collectAsState()
            val audioLevel by vm.voiceManager.audioLevel.collectAsState()
            val partialText by vm.voiceManager.partialText.collectAsState()

            val permissionLauncher = rememberLauncherForActivityResult(
                ActivityResultContracts.RequestPermission()
            ) { granted ->
                if (granted && uiState.pendingPermissionRequest == Manifest.permission.RECORD_AUDIO) {
                    vm.toggleMicrophone()
                }
                vm.clearPermissionPrompt()
            }

            LaunchedEffect(uiState.pendingPermissionRequest) {
                uiState.pendingPermissionRequest?.let { perm ->
                    permissionLauncher.launch(perm)
                }
            }

            MkAiTheme(darkTheme = uiState.darkTheme) {
                if (!uiState.isAuthenticated) {
                    Surface(color = MaterialTheme.colorScheme.background) {
                        AuthScreen(
                            isLoading = uiState.isLoading,
                            error = uiState.error,
                            backendUrl = uiState.backendUrl,
                            onUpdateBackendUrl = vm::updateBackendUrl,
                            onLogin = vm::login,
                            onRegister = vm::register
                        )
                    }
                } else {
                    MainScaffold(
                        vm = vm,
                        isListening = isListening,
                        isSpeaking = isSpeaking,
                        audioLevel = audioLevel,
                        partialText = partialText,
                        onRequestPermission = { perm -> permissionLauncher.launch(perm) }
                    )
                }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun MainScaffold(
    vm: MainViewModel,
    isListening: Boolean,
    isSpeaking: Boolean,
    audioLevel: Float,
    partialText: String,
    onRequestPermission: (String) -> Unit
) {
    val uiState by vm.uiState.collectAsState()
    var currentTab by remember { mutableStateOf("chat") }
    val drawerState = rememberDrawerState(DrawerValue.Closed)
    val scope = rememberCoroutineScope()

    ModalNavigationDrawer(
        drawerState = drawerState,
        drawerContent = {
            ModalDrawerSheet {
                Text(
                    text = "M.K AI",
                    style = MaterialTheme.typography.titleLarge,
                    modifier = Modifier.padding(20.dp)
                )
                NavigationDrawerItem(
                    label = { Text("AI Assistant") },
                    selected = currentTab == "chat",
                    onClick = {
                        currentTab = "chat"
                        scope.launch { drawerState.close() }
                    },
                    icon = { Icon(Icons.Default.AutoAwesome, contentDescription = null) }
                )
                NavigationDrawerItem(
                    label = { Text("Controls & Settings") },
                    selected = currentTab == "settings",
                    onClick = {
                        currentTab = "settings"
                        scope.launch { drawerState.close() }
                    },
                    icon = { Icon(Icons.Default.Settings, contentDescription = null) }
                )
                NavigationDrawerItem(
                    label = { Text("About Manish Meena") },
                    selected = currentTab == "about",
                    onClick = {
                        currentTab = "about"
                        scope.launch { drawerState.close() }
                    },
                    icon = { Icon(Icons.Default.Person, contentDescription = null) }
                )
                HorizontalDivider(modifier = Modifier.padding(vertical = 8.dp))
                NavigationDrawerItem(
                    label = { Text("New Conversation") },
                    selected = false,
                    onClick = {
                        vm.startNewChat()
                        currentTab = "chat"
                        scope.launch { drawerState.close() }
                    },
                    icon = { Icon(Icons.Default.AddComment, contentDescription = null) }
                )
            }
        }
    ) {
        Scaffold(
            topBar = {
                TopAppBar(
                    title = { Text("M.K AI") },
                    navigationIcon = {
                        IconButton(onClick = { scope.launch { drawerState.open() } }) {
                            Icon(Icons.Default.Menu, contentDescription = "Menu")
                        }
                    },
                    actions = {
                        IconButton(onClick = vm::toggleTheme) {
                            Icon(
                                imageVector = if (uiState.darkTheme) Icons.Default.LightMode else Icons.Default.DarkMode,
                                contentDescription = "Toggle Theme"
                            )
                        }
                    }
                )
            }
        ) { innerPadding ->
            Surface(modifier = Modifier.padding(innerPadding)) {
                when (currentTab) {
                    "chat" -> ChatScreen(
                        uiState = uiState,
                        isListening = isListening,
                        isSpeaking = isSpeaking,
                        audioLevel = audioLevel,
                        partialText = partialText,
                        onSendMessage = vm::sendMessage,
                        onToggleMic = {
                            onRequestPermission(Manifest.permission.RECORD_AUDIO)
                            vm.toggleMicrophone()
                        },
                        onConfirmPending = vm::confirmPendingCommand,
                        onDismissPending = vm::dismissPendingCommand
                    )
                    "settings" -> ControlsAndSettingsScreen(
                        uiState = uiState,
                        phoneController = vm.phoneController,
                        onRequestPermission = onRequestPermission,
                        onToggleTheme = vm::toggleTheme,
                        onSelectLanguage = vm::setLanguage,
                        onToggleContinuousVoice = vm::toggleContinuousVoice,
                        onUpdateBackendUrl = vm::updateBackendUrl,
                        onLogout = vm::logout
                    )
                    "about" -> AboutScreen()
                }
            }
        }
    }
}
