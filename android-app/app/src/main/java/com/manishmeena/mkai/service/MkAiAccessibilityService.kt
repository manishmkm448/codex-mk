package com.manishmeena.mkai.service

import android.accessibilityservice.AccessibilityService
import android.view.accessibility.AccessibilityEvent

/**
 * Optional AccessibilityService strictly for explicit user-requested global navigation actions
 * (Back, Home, Recents, Notifications shade) when explicitly enabled in Android Settings.
 * Never reads screen windows, messages, or notifications.
 */
class MkAiAccessibilityService : AccessibilityService() {

    override fun onServiceConnected() {
        super.onServiceConnected()
        instance = this
    }

    override fun onAccessibilityEvent(event: AccessibilityEvent?) {
        // Intentionally no passive reading of user screens or messages
    }

    override fun onInterrupt() {}

    override fun onDestroy() {
        super.onDestroy()
        if (instance === this) {
            instance = null
        }
    }

    fun triggerGlobalNavigation(actionId: Int): Boolean {
        return performGlobalAction(actionId)
    }

    companion object {
        @Volatile
        var instance: MkAiAccessibilityService? = null
            private set
    }
}
