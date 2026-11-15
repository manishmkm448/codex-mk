package com.manishmeena.mkai.ui.components

import androidx.compose.animation.core.*
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.unit.dp
import com.manishmeena.mkai.ui.theme.NeonBlue
import com.manishmeena.mkai.ui.theme.NeonPurple

@Composable
fun VoiceWaveform(
    active: Boolean,
    audioLevel: Float,
    modifier: Modifier = Modifier
) {
    val transition = rememberInfiniteTransition(label = "waveform")
    val phase by transition.animateFloat(
        initialValue = 0f,
        targetValue = (Math.PI * 2).toFloat(),
        animationSpec = infiniteRepeatable(
            animation = tween(1000, easing = LinearEasing)
        ),
        label = "wave_phase"
    )

    Row(
        modifier = modifier.height(34.dp),
        horizontalArrangement = Arrangement.spacedBy(4.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        val barCount = 16
        for (i in 0 until barCount) {
            val factor = if (active) {
                val wave = (kotlin.math.sin(phase + i * 0.55f) + 1f) / 2f
                0.25f + (wave * 0.45f) + (audioLevel * 0.55f)
            } else {
                0.18f
            }
            val heightDp = (6f + factor.coerceIn(0.15f, 1f) * 26f).dp
            Box(
                modifier = Modifier
                    .width(4.dp)
                    .height(heightDp)
                    .clip(RoundedCornerShape(4.dp))
                    .background(
                        Brush.verticalGradient(listOf(NeonBlue, NeonPurple))
                    )
            )
        }
    }
}
