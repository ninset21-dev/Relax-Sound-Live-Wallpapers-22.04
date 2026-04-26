exports.effectRendererKt = (pkg) => `package ${pkg}.wallpaper

import android.content.Context
import android.content.SharedPreferences
import android.graphics.*
import kotlin.math.*
import kotlin.random.Random

/**
 * Software particle renderer used by the wallpaper surface. Supports:
 *  snow, rain, bubbles, leaves, flowers, particles (generic sparks), fireflies,
 *  fog, frost, stars, aurora, and the new physics-aware effects:
 *  meteor (streaking shower), cherryblossom (pink petals with drift),
 *  plasma (glowing energy lines). All effects share a light physics pass
 *  (gravity + wind gust) so motion feels more organic than pure linear drift.
 */
class EffectRenderer(private val context: Context, private val prefs: SharedPreferences) {

    private data class Particle(
        var x: Float, var y: Float, var vx: Float, var vy: Float,
        var size: Float, var life: Float, var maxLife: Float, var phase: Float,
        var hue: Float = 0f
    )

    private val particles = mutableListOf<Particle>()
    private val paint = Paint(Paint.ANTI_ALIAS_FLAG)
    private val glowPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        maskFilter = BlurMaskFilter(8f, BlurMaskFilter.Blur.NORMAL)
    }
    private val rnd = Random(System.nanoTime())
    private var lastW = 0
    private var lastH = 0
    // World time accumulator (seconds) — drives global wind oscillation so
    // particles feel like they're in the same weather, not independent.
    private var worldT: Float = 0f

    private var lastFrameNs: Long = 0L

    // Touch-interaction state (req #1, #2): the live wallpaper engine
    // forwards onTouchEvent → notifyTouch() so particles in the renderer
    // see the user's finger as a moving repulsion source. Decays over
    // ~0.6s so a quick swipe still leaves a visible "wind gust" trail.
    @Volatile private var touchX: Float = -1f
    @Volatile private var touchY: Float = -1f
    @Volatile private var touchStrength: Float = 0f
    @Volatile private var touchVx: Float = 0f
    @Volatile private var touchVy: Float = 0f
    private var lastTouchNs: Long = 0L

    fun notifyTouch(x: Float, y: Float, action: Int) {
        val now = System.nanoTime()
        if (lastTouchNs > 0L && action == 2 /*MOVE*/) {
            val dt = ((now - lastTouchNs) / 1_000_000f).coerceAtLeast(1f)
            touchVx = (x - touchX) / dt * 1000f
            touchVy = (y - touchY) / dt * 1000f
        } else {
            touchVx = 0f; touchVy = 0f
        }
        touchX = x; touchY = y
        // Down/move = full strength; up = decay quickly.
        touchStrength = if (action == 1 /*UP*/ || action == 3 /*CANCEL*/) 0.4f else 1f
        lastTouchNs = now
    }

    fun drawOverlay(canvas: Canvas, effect: String, intensity: Float, speed: Float) {
        val w = canvas.width; val h = canvas.height
        if (w != lastW || h != lastH) { particles.clear(); lastW = w; lastH = h }
        val target = (intensity * 180).toInt().coerceIn(12, 260)
        while (particles.size < target) particles.add(spawn(effect, w, h))
        // Motion is now frame-rate independent — we use the wall-clock
        // delta between draws (capped at 50 ms to avoid huge jumps if the
        // engine paused, e.g. the user backgrounded the app). This removes
        // the user-visible "jerks" the user reported when the FPS swings
        // (req #5: equal motion).
        val now = System.nanoTime()
        val rawDelta = if (lastFrameNs == 0L) 0.016f else (now - lastFrameNs) / 1_000_000_000f
        lastFrameNs = now
        val deltaSec = rawDelta.coerceIn(0.001f, 0.05f)
        val step = deltaSec * speed.coerceIn(0.2f, 3f)
        worldT += step
        // Global wind (req #1): two-frequency oscillation + occasional
        // strong gust. Magnitude widened so wind visibly pushes particles
        // sideways instead of barely nudging them. Direction varies with
        // worldT so user sees particles drifting LEFT, then drifting
        // RIGHT, then strong gusts — matches the "ветер раздувает в
        // разные стороны" requirement.
        val baseWind = sin(worldT * 0.35f) * 1.5f + cos(worldT * 0.13f) * 0.9f
        val gust = (sin(worldT * 0.07f + cos(worldT * 0.23f) * 1.3f)).let { v ->
            // Rare strong gusts (~ once every 8-15s, ±2.5 magnitude).
            if (abs(v) > 0.85f) v * 2.5f else v * 0.4f
        }
        val wind = baseWind + gust
        // Vertical wind component — small, lets snow/blossoms occasionally
        // drift upward briefly when crosswinds shift, breaking monotony.
        val windY = sin(worldT * 0.21f) * 0.25f
        val gravity = gravityFor(effect)
        // Touch interaction decay — strength fades over ~0.6s after lift.
        if (touchStrength > 0f && lastTouchNs > 0L) {
            val sinceTouchSec = (System.nanoTime() - lastTouchNs) / 1_000_000_000f
            touchStrength = (touchStrength - sinceTouchSec * 0.0016f).coerceAtLeast(0f)
        }

        val it = particles.iterator()
        while (it.hasNext()) {
            val p = it.next()
            p.vx += wind * step * 1.2f
            p.vy += (gravity + windY * 6f) * step
            // Touch repulsion (req #2): particles within radius are pushed
            // radially away with strength scaling 1/distance. Plus a
            // velocity-aligned shove from the swipe direction so a quick
            // flick blows particles in the swipe direction.
            if (touchStrength > 0f && touchX >= 0f) {
                val dx = p.x - touchX
                val dy = p.y - touchY
                val d2 = dx*dx + dy*dy
                val radius = 240f
                if (d2 < radius * radius) {
                    val d = sqrt(d2).coerceAtLeast(1f)
                    val falloff = (1f - d / radius) * touchStrength
                    val ax = (dx / d) * falloff * 60f + touchVx * falloff * 0.0025f
                    val ay = (dy / d) * falloff * 60f + touchVy * falloff * 0.0025f
                    p.vx += ax * step
                    p.vy += ay * step
                }
            }
            // Mild drag so velocities don't run away.
            p.vx *= 0.992f
            p.vy *= if (effect == "bubbles") 0.997f else 0.998f
            p.x += p.vx * step * 60f
            p.y += p.vy * step * 60f
            p.life -= step
            p.phase += step * 2f
            if (p.life <= 0f ||
                p.y > h + 60 || p.y < -60 ||
                p.x < -120 || p.x > w + 120
            ) it.remove()
        }
        for (p in particles) drawParticle(canvas, p, effect)
    }

    private fun gravityFor(effect: String): Float = when (effect) {
        "rain", "meteor" -> 28f
        "snow" -> 4f
        "leaves", "flowers", "cherryblossom" -> 3.2f
        "bubbles" -> -3.5f       // upward buoyancy
        "fog", "stars", "fireflies", "frost", "aurora", "plasma" -> 0f
        else -> 6f
    }

    private fun spawn(effect: String, w: Int, h: Int): Particle {
        return when (effect) {
            "rain" -> Particle(rnd.nextFloat() * w, -10f, (rnd.nextFloat()-0.5f)*2f, (18f + rnd.nextFloat() * 10f), 2f + rnd.nextFloat()*2f, 4f, 4f, 0f)
            "snow" -> Particle(rnd.nextFloat() * w, -10f, (rnd.nextFloat()-0.5f)*1.5f, 1.2f + rnd.nextFloat() * 1.8f, 4f + rnd.nextFloat()*6f, 10f, 10f, rnd.nextFloat()*6f)
            "bubbles" -> Particle(rnd.nextFloat() * w, h + 10f, (rnd.nextFloat()-0.5f)*0.8f, -(1.5f+rnd.nextFloat()*1.8f), 10f+rnd.nextFloat()*18f, 8f, 8f, rnd.nextFloat()*6f)
            "leaves" -> Particle(rnd.nextFloat() * w, -20f, (rnd.nextFloat()-0.5f)*2.5f, 1.5f+rnd.nextFloat()*1.5f, 12f+rnd.nextFloat()*8f, 12f, 12f, rnd.nextFloat()*6f)
            "flowers" -> Particle(rnd.nextFloat() * w, -20f, (rnd.nextFloat()-0.5f)*1.8f, 1.2f+rnd.nextFloat()*1.2f, 14f+rnd.nextFloat()*10f, 14f, 14f, rnd.nextFloat()*6f)
            "fireflies" -> Particle(rnd.nextFloat() * w, rnd.nextFloat() * h, (rnd.nextFloat()-0.5f)*0.8f, (rnd.nextFloat()-0.5f)*0.8f, 4f+rnd.nextFloat()*4f, 6f, 6f, rnd.nextFloat()*6f)
            "fog" -> Particle(rnd.nextFloat() * w, rnd.nextFloat() * h, (rnd.nextFloat()-0.4f)*0.7f, (rnd.nextFloat()-0.5f)*0.15f, 80f+rnd.nextFloat()*100f, 14f, 14f, rnd.nextFloat()*6f)
            "frost" -> Particle(rnd.nextFloat() * w, rnd.nextFloat() * h, 0f, 0f, 8f+rnd.nextFloat()*14f, 18f, 18f, rnd.nextFloat()*6f)
            "stars" -> Particle(rnd.nextFloat() * w, rnd.nextFloat() * h, 0f, 0f, 1.5f+rnd.nextFloat()*3f, 20f, 20f, rnd.nextFloat()*6f)
            "aurora" -> Particle(rnd.nextFloat() * w, rnd.nextFloat() * h * 0.6f, (rnd.nextFloat()-0.5f)*0.4f, 0f, 60f+rnd.nextFloat()*120f, 16f, 16f, rnd.nextFloat()*6f)
            // NEW EFFECTS
            "meteor" -> {
                // streaking diagonal
                val fromLeft = rnd.nextBoolean()
                val x = if (fromLeft) -10f else w + 10f
                val vx = if (fromLeft) 18f + rnd.nextFloat()*10f else -(18f + rnd.nextFloat()*10f)
                Particle(x, rnd.nextFloat() * (h * 0.5f), vx, 22f + rnd.nextFloat()*10f, 2f + rnd.nextFloat()*2f, 3f, 3f, 0f, rnd.nextFloat())
            }
            "cherryblossom" -> Particle(rnd.nextFloat() * w, -20f, (rnd.nextFloat()-0.5f)*2.2f, 1.4f+rnd.nextFloat()*1.3f, 8f+rnd.nextFloat()*6f, 14f, 14f, rnd.nextFloat()*6f)
            "plasma" -> Particle(rnd.nextFloat() * w, rnd.nextFloat() * h, (rnd.nextFloat()-0.5f)*2f, (rnd.nextFloat()-0.5f)*2f, 20f+rnd.nextFloat()*30f, 10f, 10f, rnd.nextFloat()*6f, rnd.nextFloat())
            else -> Particle(rnd.nextFloat() * w, -10f, (rnd.nextFloat()-0.5f)*2f, 2f+rnd.nextFloat()*3f, 3f+rnd.nextFloat()*5f, 6f, 6f, rnd.nextFloat()*6f)
        }
    }

    private fun drawParticle(canvas: Canvas, p: Particle, effect: String) {
        val alpha = (255f * (p.life / p.maxLife)).toInt().coerceIn(30, 255)
        paint.alpha = alpha
        paint.style = Paint.Style.FILL
        when (effect) {
            "rain" -> {
                paint.color = Color.argb(alpha, 180, 220, 255)
                paint.strokeWidth = p.size
                canvas.drawLine(p.x, p.y, p.x - p.vx * 0.4f, p.y - p.vy * 0.4f, paint)
            }
            "snow" -> {
                paint.color = Color.argb(alpha, 245, 250, 255)
                canvas.drawCircle(p.x + sin(p.phase) * 2f, p.y, p.size, paint)
            }
            "bubbles" -> {
                paint.style = Paint.Style.STROKE
                paint.strokeWidth = 2f
                paint.color = Color.argb(alpha, 180, 220, 255)
                canvas.drawCircle(p.x + sin(p.phase) * 4f, p.y, p.size, paint)
                // small highlight
                paint.style = Paint.Style.FILL
                paint.color = Color.argb((alpha * 0.6f).toInt(), 220, 240, 255)
                canvas.drawCircle(p.x + sin(p.phase)*4f - p.size*0.35f, p.y - p.size*0.35f, p.size*0.18f, paint)
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
                // Soft bloom via blur mask paint for that "wow" glow.
                glowPaint.color = Color.argb(glow.toInt().coerceIn(20, 255), 200, 255, 120)
                canvas.drawCircle(p.x, p.y, p.size * 2.6f, glowPaint)
                paint.color = Color.argb(alpha, 255, 255, 180)
                canvas.drawCircle(p.x, p.y, p.size * 0.6f, paint)
            }
            "fog" -> {
                val a = (40f + sin(p.phase) * 20f).toInt().coerceIn(20, 80)
                paint.color = Color.argb(a, 200, 230, 210)
                canvas.drawCircle(p.x, p.y, p.size, paint)
            }
            "frost" -> {
                paint.color = Color.argb(alpha, 200, 240, 255)
                paint.strokeWidth = 1.8f
                paint.style = Paint.Style.STROKE
                for (i in 0 until 6) {
                    val a = i * (Math.PI / 3).toFloat() + p.phase * 0.2f
                    val dx = cos(a) * p.size
                    val dy = sin(a) * p.size
                    canvas.drawLine(p.x, p.y, p.x + dx, p.y + dy, paint)
                    // fractal branches
                    val mx = p.x + dx * 0.5f
                    val my = p.y + dy * 0.5f
                    val b = a + 0.6f
                    canvas.drawLine(mx, my, mx + cos(b)*p.size*0.3f, my + sin(b)*p.size*0.3f, paint)
                    canvas.drawLine(mx, my, mx + cos(a - 0.6f)*p.size*0.3f, my + sin(a - 0.6f)*p.size*0.3f, paint)
                }
                paint.style = Paint.Style.FILL
            }
            "stars" -> {
                val pulse = (sin(p.phase * 2f) * 0.5f + 0.5f)
                paint.color = Color.argb((alpha * pulse).toInt().coerceIn(30, 255), 255, 240, 200)
                canvas.drawCircle(p.x, p.y, p.size + pulse * 1.8f, paint)
                glowPaint.color = Color.argb(60, 255, 220, 180)
                canvas.drawCircle(p.x, p.y, p.size * 3.5f, glowPaint)
            }
            "aurora" -> {
                val hueR = (140 + sin(p.phase) * 60).toInt().coerceIn(60, 220)
                val hueG = (200 + cos(p.phase * 0.7f) * 50).toInt().coerceIn(120, 255)
                val hueB = (180 + sin(p.phase * 1.3f) * 60).toInt().coerceIn(100, 255)
                paint.color = Color.argb(48, hueR, hueG, hueB)
                canvas.drawOval(
                    RectF(p.x - p.size, p.y - p.size * 0.25f,
                          p.x + p.size, p.y + p.size * 0.25f), paint)
            }
            "meteor" -> {
                // Bright head with 8 long tail segments fading out.
                val headR = p.size + 1.5f
                for (i in 0 until 8) {
                    val k = i / 8f
                    val tx = p.x - p.vx * k * 0.55f
                    val ty = p.y - p.vy * k * 0.55f
                    val a = (alpha * (1 - k)).toInt().coerceIn(10, 255)
                    paint.color = Color.argb(a, 255, (220 - i*12).coerceAtLeast(120), (120 - i*8).coerceAtLeast(40))
                    canvas.drawCircle(tx, ty, headR * (1 - k * 0.7f), paint)
                }
                glowPaint.color = Color.argb(120, 255, 200, 120)
                canvas.drawCircle(p.x, p.y, headR * 3f, glowPaint)
            }
            "cherryblossom" -> {
                // 5-petal sakura with gentle rotation + color shifts pink->salmon
                val pink = Color.argb(alpha, 255, (190 + (sin(p.phase)*15).toInt()), 215)
                paint.color = pink
                canvas.save()
                canvas.rotate(p.phase * 30f, p.x, p.y)
                for (i in 0 until 5) {
                    val a = i * (Math.PI * 2 / 5).toFloat()
                    val px = p.x + cos(a) * p.size * 0.6f
                    val py = p.y + sin(a) * p.size * 0.6f
                    canvas.drawOval(RectF(px - p.size*0.5f, py - p.size*0.28f, px + p.size*0.5f, py + p.size*0.28f), paint)
                }
                paint.color = Color.argb(alpha, 255, 220, 140)
                canvas.drawCircle(p.x, p.y, p.size * 0.3f, paint)
                canvas.restore()
            }
            "plasma" -> {
                // Rotating hued blob with bright core
                val h = (p.hue * 360f + worldT * 30f) % 360f
                val hsv = floatArrayOf(h, 0.75f, 1f)
                val col = Color.HSVToColor(alpha.coerceAtMost(150), hsv)
                glowPaint.color = col
                canvas.drawCircle(p.x, p.y, p.size, glowPaint)
                paint.color = Color.argb(alpha.coerceAtMost(200), 255, 255, 255)
                canvas.drawCircle(p.x, p.y, p.size * 0.22f, paint)
            }
            else -> {
                paint.color = Color.argb(alpha, 160, 240, 200)
                canvas.drawCircle(p.x, p.y, p.size, paint)
            }
        }
    }
}
`;
