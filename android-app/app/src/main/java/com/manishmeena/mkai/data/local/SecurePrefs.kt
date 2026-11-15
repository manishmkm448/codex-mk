package com.manishmeena.mkai.data.local

import android.content.Context
import android.content.SharedPreferences
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import com.manishmeena.mkai.BuildConfig

class SecurePrefs(context: Context) {
    private val masterKey = MasterKey.Builder(context)
        .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
        .build()

    private val prefs: SharedPreferences = EncryptedSharedPreferences.create(
        context,
        "mk_ai_secure_prefs",
        masterKey,
        EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
        EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
    )

    var authToken: String?
        get() = prefs.getString(KEY_TOKEN, null)
        set(value) = prefs.edit().putString(KEY_TOKEN, value).apply()

    var backendUrl: String
        get() = prefs.getString(KEY_BACKEND_URL, BuildConfig.DEFAULT_BACKEND_URL)
            ?: BuildConfig.DEFAULT_BACKEND_URL
        set(value) {
            val normalized = if (value.endsWith("/")) value else "$value/"
            prefs.edit().putString(KEY_BACKEND_URL, normalized).apply()
        }

    var preferredLanguage: String
        get() = prefs.getString(KEY_LANGUAGE, "hi") ?: "hi"
        set(value) = prefs.edit().putString(KEY_LANGUAGE, value).apply()

    var darkTheme: Boolean
        get() = prefs.getBoolean(KEY_DARK_THEME, true)
        set(value) = prefs.edit().putBoolean(KEY_DARK_THEME, value).apply()

    var continuousVoice: Boolean
        get() = prefs.getBoolean(KEY_CONTINUOUS_VOICE, false)
        set(value) = prefs.edit().putBoolean(KEY_CONTINUOUS_VOICE, value).apply()

    var userEmail: String?
        get() = prefs.getString(KEY_EMAIL, null)
        set(value) = prefs.edit().putString(KEY_EMAIL, value).apply()

    fun clearSession() {
        prefs.edit()
            .remove(KEY_TOKEN)
            .remove(KEY_EMAIL)
            .apply()
    }

    companion object {
        private const val KEY_TOKEN = "auth_token"
        private const val KEY_BACKEND_URL = "backend_url"
        private const val KEY_LANGUAGE = "preferred_language"
        private const val KEY_DARK_THEME = "dark_theme"
        private const val KEY_CONTINUOUS_VOICE = "continuous_voice"
        private const val KEY_EMAIL = "user_email"
    }
}
