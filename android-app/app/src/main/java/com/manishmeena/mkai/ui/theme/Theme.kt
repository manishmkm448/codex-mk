package com.manishmeena.mkai.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

val ObsidianBg = Color(0xFF06040C)
val DeepPurpleSurface = Color(0xFF110A21)
val NeonPurple = Color(0xFFA855F7)
val NeonBlue = Color(0xFF38BDF8)

private val MkAiDarkScheme = darkColorScheme(
    primary = NeonPurple,
    secondary = NeonBlue,
    background = ObsidianBg,
    surface = DeepPurpleSurface,
    onPrimary = Color.White,
    onSecondary = ObsidianBg,
    onBackground = Color(0xFFF8FAFC),
    onSurface = Color(0xFFF1F5F9),
    surfaceVariant = Color(0xFF1B1233),
    outline = Color(0xFF312257)
)

private val MkAiLightScheme = lightColorScheme(
    primary = Color(0xFF7C3AED),
    secondary = Color(0xFF0284C7),
    background = Color(0xFFF8FAFC),
    surface = Color.White,
    onPrimary = Color.White,
    onSecondary = Color.White,
    onBackground = Color(0xFF0F172A),
    onSurface = Color(0xFF0F172A),
    surfaceVariant = Color(0xFFF1F5F9),
    outline = Color(0xFFE2E8F0)
)

@Composable
fun MkAiTheme(
    darkTheme: Boolean = true,
    content: @Composable () -> Unit
) {
    MaterialTheme(
        colorScheme = if (darkTheme) MkAiDarkScheme else MkAiLightScheme,
        content = content
    )
}
