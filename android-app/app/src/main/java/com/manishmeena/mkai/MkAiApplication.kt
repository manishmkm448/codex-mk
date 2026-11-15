package com.manishmeena.mkai

import android.app.Application
import com.manishmeena.mkai.data.local.SecurePrefs

class MkAiApplication : Application() {
    lateinit var securePrefs: SecurePrefs
        private set

    override fun onCreate() {
        super.onCreate()
        securePrefs = SecurePrefs(this)
    }
}
