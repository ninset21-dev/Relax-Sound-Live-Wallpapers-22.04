exports.wallpaperEngineKt = (pkg) => `package ${pkg}.wallpaper

import android.content.Context
import android.content.SharedPreferences
import android.graphics.*
import android.media.MediaPlayer
import android.net.Uri
import android.opengl.GLSurfaceView
import android.os.Handler
import android.os.Looper
import android.service.wallpaper.WallpaperService
import android.util.Log
import android.view.GestureDetector
import android.view.MotionEvent
import android.view.SurfaceHolder
import android.view.accessibility.AccessibilityManager
import java.io.File
import java.lang.ref.WeakReference

/**
 * Wallpaper engine that supports:
 *  - static image backdrop
 *  - looping video playback (via MediaPlayer to a Surface)
 *  - overlay particle/fluid effects drawn with OpenGL ES 2.0 on a separate off-screen GLSurfaceView
 *    (for Live wallpapers we draw with Canvas for simplicity + broad device support,
 *     complex GL effects are handled inside the app and synchronized via SharedPreferences).
 *  - onVisibilityChanged pause/resume semantics (music service observes via broadcast).
 *  - double-tap gesture → broadcast to AccessibilityService for screen lock.
 */
class RelaxWallpaperEngine(private val service: WallpaperService) : WallpaperService.Engine() {

    private val handler = Handler(Looper.getMainLooper())
    private val prefs: SharedPreferences =
        service.getSharedPreferences("relax_wallpaper_prefs", Context.MODE_PRIVATE)

    private var mediaPlayer: MediaPlayer? = null
    private var effectRenderer: EffectRenderer? = null
    private var visible = false

    private val frameTick = object : Runnable {
        override fun run() {
            if (!visible) return
            drawFrame()
            val fps = prefs.getInt("effect_fps", 30).coerceIn(10, 60)
            handler.postDelayed(this, (1000L / fps))
        }
    }

    private val gestureDetector = GestureDetector(service, object : GestureDetector.SimpleOnGestureListener() {
        override fun onDoubleTap(e: MotionEvent): Boolean {
            val intent = android.content.Intent("${pkg}.DOUBLE_TAP_LOCK")
            intent.setPackage(service.packageName)
            service.sendBroadcast(intent)
            return true
        }
    })

    override fun onVisibilityChanged(v: Boolean) {
        visible = v
        val broadcast = android.content.Intent("${pkg}.WALLPAPER_VISIBILITY").apply {
            setPackage(service.packageName)
            putExtra("visible", v)
        }
        service.sendBroadcast(broadcast)
        if (v) {
            mediaPlayer?.start()
            handler.post(frameTick)
        } else {
            try { mediaPlayer?.pause() } catch (_: Throwable) {}
            handler.removeCallbacks(frameTick)
        }
    }

    override fun onSurfaceCreated(holder: SurfaceHolder) {
        super.onSurfaceCreated(holder)
        setupMedia(holder)
        effectRenderer = EffectRenderer(service, prefs)
    }

    override fun onSurfaceDestroyed(holder: SurfaceHolder) {
        handler.removeCallbacks(frameTick)
        try { mediaPlayer?.release() } catch (_: Throwable) {}
        mediaPlayer = null
        super.onSurfaceDestroyed(holder)
    }

    override fun onTouchEvent(event: MotionEvent) {
        gestureDetector.onTouchEvent(event)
    }

    private fun setupMedia(holder: SurfaceHolder) {
        val videoUri = prefs.getString("wallpaper_video_uri", null)
        val imageUri = prefs.getString("wallpaper_image_uri", null)
        if (!videoUri.isNullOrBlank()) {
            try {
                mediaPlayer = MediaPlayer().apply {
                    setDataSource(service, Uri.parse(videoUri))
                    isLooping = true
                    setVolume(0f, 0f)
                    setSurface(holder.surface)
                    prepare()
                    start()
                }
            } catch (t: Throwable) {
                Log.e(TAG, "video init failed", t)
                drawImage(holder, imageUri)
            }
        } else {
            drawImage(holder, imageUri)
        }
    }

    private fun drawImage(holder: SurfaceHolder, uri: String?) {
        val canvas = try { holder.lockCanvas() } catch (_: Throwable) { null } ?: return
        try {
            canvas.drawColor(Color.parseColor("#0b1f14"))
            uri?.let {
                try {
                    val input = service.contentResolver.openInputStream(Uri.parse(it))
                    val bmp = BitmapFactory.decodeStream(input)
                    input?.close()
                    if (bmp != null) {
                        val rect = Rect(0, 0, canvas.width, canvas.height)
                        canvas.drawBitmap(bmp, null, rect, null)
                    }
                } catch (t: Throwable) { Log.e(TAG, "decode image failed", t) }
            }
        } finally {
            try { holder.unlockCanvasAndPost(canvas) } catch (_: Throwable) {}
        }
    }

    private fun drawFrame() {
        val effect = prefs.getString("effect_type", "none") ?: "none"
        if (effect == "none") return
        val holder = surfaceHolder
        val canvas = try { holder.lockCanvas() } catch (_: Throwable) { null } ?: return
        try {
            effectRenderer?.drawOverlay(canvas, effect,
                intensity = prefs.getFloat("effect_intensity", 0.5f),
                speed = prefs.getFloat("effect_speed", 1.0f))
        } finally {
            try { holder.unlockCanvasAndPost(canvas) } catch (_: Throwable) {}
        }
    }

    companion object { const val TAG = "RelaxWallpaperEngine" }
}
`;
