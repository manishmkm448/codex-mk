package com.manishmeena.mkai.ui.components

import androidx.compose.animation.core.*
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.size
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.manishmeena.mkai.ui.theme.NeonBlue
import com.manishmeena.mkai.ui.theme.NeonPurple

@Composable
fun AiOrb(
    isListening: Boolean,
    isThinking: Boolean,
    isSpeaking: Boolean,
    audioLevel: Float,
    modifier: Modifier = Modifier,
    size: Dp = 132.dp
) {
    val infiniteTransition = rememberInfiniteTransition(label = "orb_transition")
    val pulse by infiniteTransition.animateFloat(
        initialValue = 0.94f,
        targetValue = 1.06f,
        animationSpec = infiniteRepeatable(
            animation = tween(if (isListening || isThinking) 900 else 2800, easing = FastOutSlowInEasing),
            repeatMode = RepeatMode.Reverse
        ),
        label = "orb_pulse"
    )
    val rotation by infiniteTransition.animateFloat(
        initialValue = 0f,
        targetValue = 360f,
        animationSpec = infiniteRepeatable(
            animation = tween(if (isThinking) 3000 else 12000, easing = LinearEasing)
        ),
        label = "orb_rotation"
    )

    val dynamicScale = pulse + (if (isListening) audioLevel * 0.18f else 0f)

    Canvas(modifier = modifier.size(size)) {
        val radius = (this.size.minDimension / 2f) * dynamicScale * 0.72f
        val center = Offset(this.size.width / 2f, this.size.height / 2f)

        drawCircle(
            brush = Brush.radialGradient(
                colors = listOf(
                    if (isListening) NeonBlue.copy(alpha = 0.45f) else NeonPurple.copy(alpha = 0.35f),
                    Color.Transparent
                ),
                center = center,
                radius = radius * 1.55f
            ),
            radius = radius * 1.55f,
            center = center
        )

        drawCircle(
            brush = Brush.sweepGradient(
                colors = listOf(NeonPurple, NeonBlue, NeonPurple),
                center = center
            ),
            radius = radius,
            center = center,
            style = Stroke(width = if (isListening || isSpeaking) 5f else 3f)
        )

        val innerOffset = Offset(
            center.x + kotlin.math.cos(Math.toRadians(rotation.toDouble())).toFloat() * (radius * 0.16f),
            center.y + kotlin.math.sin(Math.toRadians(rotation.toDouble())).toFloat() * (radius * 0.16f)
        )

        drawCircle(
            brush = Brush.radialGradient(
                colors = listOf(
                    NeonBlue.copy(alpha = 0.85f),
                    NeonPurple.copy(alpha = 0.65f),
                    Color(0xFF0A0516)
                ),
                center = innerOffset,
                radius = radius * 0.82f
            ),
            radius = radius * 0.78f,
            center = center
        )
    }
}
