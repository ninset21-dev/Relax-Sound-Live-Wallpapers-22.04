exports.effectRendererKt = (pkg) => `package ${pkg}.wallpaper

import android.content.Context
import android.content.SharedPreferences
import android.graphics.*
import kotlin.math.*
import kotlin.random.Random

/**
 * Software particle renderer used by the wallpaper surface. Supports:
 *  snow, rain, bubbles, leaves, flowers, particles (generic sparks), fireflies.
 *  Kept in Canvas/Paint for maximum device compatibility. The same effect
 *  parameters (intensity, speed) are mirrored in SharedPreferences so the
 *  in-app WebGL/Canvas renderer produces visually identical output.
 */
class EffectRenderer(private val context: Context, private val prefs: SharedPreferences) {

    private data class Particle(
        var x: Float, var y: Float, var vx: Float, var vy: Float,
        var size: Float, var life: Float, var maxLife: Float, var phase: Float
    )

    private val particles = mutableListOf<Particle>()
    private val paint = Paint(Paint.ANTI_ALIAS_FLAG)
    private val rnd = Random(System.nanoTime())
    private var lastW = 0
    private var lastH = 0

    fun drawOverlay(canvas: Canvas, effect: String, intensity: Float, speed: Float) {
        val w = canvas.width; val h = canvas.height
        if (w != lastW || h != lastH) { particles.clear(); lastW = w; lastH = h }
        val target = (intensity * 160).toInt().coerceIn(12, 220)
        while (particles.size < target) particles.add(spawn(effect, w, h))
        val step = 0.016f * speed.coerceIn(0.2f, 3f)
        val it = particles.iterator()
        while (it.hasNext()) {
            val p = it.next()
            p.x += p.vx * step * 60f
            p.y += p.vy * step * 60f
            p.life -= step
            p.phase += step * 2f
            if (p.life <= 0f || p.y > h + 40 || p.x < -40 || p.x > w + 40) {
                it.remove()
            }
        }
        for (p in particles) drawParticle(canvas, p, effect)
    }

    private fun spawn(effect: String, w: Int, h: Int): Particle {
        return when (effect) {
            "rain" -> Particle(rnd.nextFloat() * w, -10f, 0f, (18f + rnd.nextFloat() * 10f), 2f + rnd.nextFloat()*2f, 4f, 4f, 0f)
            "snow" -> Particle(rnd.nextFloat() * w, -10f, (rnd.nextFloat()-0.5f)*1.5f, 1.2f + rnd.nextFloat() * 1.8f, 4f + rnd.nextFloat()*6f, 10f, 10f, rnd.nextFloat()*6f)
            "bubbles" -> Particle(rnd.nextFloat() * w, h + 10f, (rnd.nextFloat()-0.5f)*0.8f, -(1.5f+rnd.nextFloat()*1.8f), 10f+rnd.nextFloat()*18f, 8f, 8f, rnd.nextFloat()*6f)
            "leaves" -> Particle(rnd.nextFloat() * w, -20f, (rnd.nextFloat()-0.5f)*2.5f, 1.5f+rnd.nextFloat()*1.5f, 12f+rnd.nextFloat()*8f, 12f, 12f, rnd.nextFloat()*6f)
            "flowers" -> Particle(rnd.nextFloat() * w, -20f, (rnd.nextFloat()-0.5f)*1.8f, 1.2f+rnd.nextFloat()*1.2f, 14f+rnd.nextFloat()*10f, 14f, 14f, rnd.nextFloat()*6f)
            "fireflies" -> Particle(rnd.nextFloat() * w, rnd.nextFloat() * h, (rnd.nextFloat()-0.5f)*0.8f, (rnd.nextFloat()-0.5f)*0.8f, 4f+rnd.nextFloat()*4f, 6f, 6f, rnd.nextFloat()*6f)
            // New effects
            "fog" -> Particle(rnd.nextFloat() * w, rnd.nextFloat() * h, (rnd.nextFloat()-0.4f)*0.7f, (rnd.nextFloat()-0.5f)*0.15f, 80f+rnd.nextFloat()*100f, 14f, 14f, rnd.nextFloat()*6f)
            "frost" -> Particle(rnd.nextFloat() * w, rnd.nextFloat() * h, 0f, 0f, 8f+rnd.nextFloat()*14f, 18f, 18f, rnd.nextFloat()*6f)
            "stars" -> Particle(rnd.nextFloat() * w, rnd.nextFloat() * h, 0f, 0f, 1.5f+rnd.nextFloat()*3f, 20f, 20f, rnd.nextFloat()*6f)
            "aurora" -> Particle(rnd.nextFloat() * w, rnd.nextFloat() * h * 0.6f, (rnd.nextFloat()-0.5f)*0.4f, 0f, 60f+rnd.nextFloat()*120f, 16f, 16f, rnd.nextFloat()*6f)
            else -> Particle(rnd.nextFloat() * w, -10f, (rnd.nextFloat()-0.5f)*2f, 2f+rnd.nextFloat()*3f, 3f+rnd.nextFloat()*5f, 6f, 6f, rnd.nextFloat()*6f)
        }
    }

    private fun drawParticle(canvas: Canvas, p: Particle, effect: String) {
        val alpha = (255f * (p.life / p.maxLife)).toInt().coerceIn(30, 255)
        paint.alpha = alpha
        when (effect) {
            "rain" -> {
                paint.color = Color.argb(alpha, 180, 220, 255)
                paint.strokeWidth = p.size
                canvas.drawLine(p.x, p.y, p.x, p.y + 14f, paint)
            }
            "snow" -> {
                paint.color = Color.argb(alpha, 255, 255, 255)
                canvas.drawCircle(p.x + sin(p.phase) * 2f, p.y, p.size, paint)
            }
            "bubbles" -> {
                paint.style = Paint.Style.STROKE
                paint.strokeWidth = 2f
                paint.color = Color.argb(alpha, 180, 220, 255)
                canvas.drawCircle(p.x + sin(p.phase) * 4f, p.y, p.size, paint)
                paint.style = Paint.Style.FILL
            }
            "leaves" -> {
                paint.color = Color.argb(alpha, 120 + (sin(p.phase)*40).toInt(), 180, 80)
                canvas.save()
                canvas.rotate(p.phase * 20f, p.x, p.y)
                canvas.drawOval(RectF(p.x - p.size, p.y - p.size*0.4f, p.x + p.size, p.y + p.size*0.4f), paint)
                canvas.restore()
            }
            "flowers" -> {
                paint.color = Color.argb(alpha, 240, 180, 220)
                val petals = 5
                for (i in 0 until petals) {
                    val a = i * (Math.PI * 2 / petals).toFloat() + p.phase
                    val px = p.x + cos(a) * p.size * 0.6f
                    val py = p.y + sin(a) * p.size * 0.6f
                    canvas.drawCircle(px, py, p.size * 0.5f, paint)
                }
                paint.color = Color.argb(alpha, 255, 230, 120)
                canvas.drawCircle(p.x, p.y, p.size * 0.35f, paint)
            }
            "fireflies" -> {
                val glow = (sin(p.phase*3f) * 0.5f + 0.5f) * 255f
                paint.color = Color.argb(glow.toInt(), 200, 255, 120)
                canvas.drawCircle(p.x, p.y, p.size * 1.6f, paint)
                paint.color = Color.argb(alpha, 255, 255, 180)
                canvas.drawCircle(p.x, p.y, p.size * 0.6f, paint)
            }
            "fog" -> {
                // Soft animated fog bands using radial gradient via nested alphas
                val a = (40f + sin(p.phase) * 20f).toInt().coerceIn(20, 80)
                paint.color = Color.argb(a, 200, 230, 210)
                canvas.drawCircle(p.x, p.y, p.size, paint)
            }
            "frost" -> {
                // Crystalline 6-arm snowflake pattern
                paint.color = Color.argb(alpha, 200, 240, 255)
                paint.strokeWidth = 1.8f
                paint.style = Paint.Style.STROKE
                for (i in 0 until 6) {
                    val a = i * (Math.PI / 3).toFloat() + p.phase * 0.2f
                    val dx = cos(a) * p.size
                    val dy = sin(a) * p.size
                    canvas.drawLine(p.x, p.y, p.x + dx, p.y + dy, paint)
                }
                paint.style = Paint.Style.FILL
            }
            "stars" -> {
                // Twinkling stars with pulsing glow
                val pulse = (sin(p.phase * 2f) * 0.5f + 0.5f)
                paint.color = Color.argb((alpha * pulse).toInt().coerceIn(30, 255), 255, 240, 200)
                canvas.drawCircle(p.x, p.y, p.size + pulse * 1.8f, paint)
                paint.color = Color.argb(80, 255, 220, 180)
                canvas.drawCircle(p.x, p.y, p.size * 3f, paint)
            }
            "aurora" -> {
                // Wide gradient ribbons weaving in the upper half
                val hueR = (140 + sin(p.phase) * 60).toInt().coerceIn(60, 220)
                val hueG = (200 + cos(p.phase * 0.7f) * 50).toInt().coerceIn(120, 255)
                val hueB = (180 + sin(p.phase * 1.3f) * 60).toInt().coerceIn(100, 255)
                paint.color = Color.argb(48, hueR, hueG, hueB)
                canvas.drawOval(
                    RectF(p.x - p.size, p.y - p.size * 0.25f,
                          p.x + p.size, p.y + p.size * 0.25f), paint)
            }
            else -> {
                paint.color = Color.argb(alpha, 160, 240, 200)
                canvas.drawCircle(p.x, p.y, p.size, paint)
            }
        }
    }
}
`;
