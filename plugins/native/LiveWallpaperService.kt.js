exports.liveWallpaperServiceKt = (pkg) => `package ${pkg}.wallpaper

import android.content.Context
import android.content.Intent
import android.content.SharedPreferences
import android.graphics.BitmapFactory
import android.graphics.Color
import android.graphics.Rect
import android.media.MediaPlayer
import android.net.Uri
import android.os.Handler
import android.os.Looper
import android.service.wallpaper.WallpaperService
import android.util.Log
import android.view.GestureDetector
import android.view.MotionEvent
import android.view.SurfaceHolder

/**
 * Live wallpaper service hosting the engine as an inner class (required since
 * WallpaperService.Engine is a non-static inner class of WallpaperService).
 *
 * Features:
 *  - static image backdrop and looping video playback (MediaPlayer -> surface)
 *  - overlay particle effects (Canvas + Paint) parameterized via SharedPreferences
 *  - onVisibilityChanged semantics: pause/resume media + broadcast to the audio service
 *  - double-tap gesture -> broadcast to AccessibilityService for screen lock
 */
class RelaxWallpaperService : WallpaperService() {

    companion object {
        const val TAG = "RelaxWallpaper"
        const val PREFS = "relax_wallpaper_prefs"
        const val ACTION_DOUBLE_TAP_LOCK = "${pkg}.DOUBLE_TAP_LOCK"
        const val ACTION_VISIBILITY = "${pkg}.WALLPAPER_VISIBILITY"
    }

    override fun onCreateEngine(): Engine {
        Log.i(TAG, "onCreateEngine")
        return RelaxEngine()
    }

    inner class RelaxEngine : Engine() {

        private val handler = Handler(Looper.getMainLooper())
        private val prefs: SharedPreferences =
            getSharedPreferences(PREFS, Context.MODE_PRIVATE)

        private var mediaPlayer: MediaPlayer? = null
        private var effectRenderer: EffectRenderer? = null
        private var visible = false

        private val frameTick = object : Runnable {
            override fun run() {
                if (!visible) return
                drawFrame()
                val fps = prefs.getInt("effect_fps", 30).coerceIn(10, 60)
                handler.postDelayed(this, 1000L / fps)
            }
        }

        private val gestureDetector = GestureDetector(
            this@RelaxWallpaperService,
            object : GestureDetector.SimpleOnGestureListener() {
                override fun onDoubleTap(e: MotionEvent): Boolean {
                    val i = Intent(ACTION_DOUBLE_TAP_LOCK)
                    i.setPackage(packageName)
                    sendBroadcast(i)
                    return true
                }
            }
        )

        override fun onVisibilityChanged(v: Boolean) {
            visible = v
            val broadcast = Intent(ACTION_VISIBILITY).apply {
                setPackage(packageName)
                putExtra("visible", v)
            }
            sendBroadcast(broadcast)
            if (v) {
                try { mediaPlayer?.start() } catch (_: Throwable) {}
                handler.post(frameTick)
            } else {
                try { mediaPlayer?.pause() } catch (_: Throwable) {}
                handler.removeCallbacks(frameTick)
            }
        }

        override fun onSurfaceCreated(holder: SurfaceHolder) {
            super.onSurfaceCreated(holder)
            setupMedia(holder)
            effectRenderer = EffectRenderer(this@RelaxWallpaperService, prefs)
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
                        setDataSource(this@RelaxWallpaperService, Uri.parse(videoUri))
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
                if (uri != null) {
                    try {
                        val input = contentResolver.openInputStream(Uri.parse(uri))
                        val bmp = BitmapFactory.decodeStream(input)
                        input?.close()
                        if (bmp != null) {
                            val rect = Rect(0, 0, canvas.width, canvas.height)
                            canvas.drawBitmap(bmp, null, rect, null)
                        }
                    } catch (t: Throwable) {
                        Log.e(TAG, "decode image failed", t)
                    }
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
                effectRenderer?.drawOverlay(
                    canvas,
                    effect,
                    intensity = prefs.getFloat("effect_intensity", 0.5f),
                    speed = prefs.getFloat("effect_speed", 1.0f)
                )
            } finally {
                try { holder.unlockCanvasAndPost(canvas) } catch (_: Throwable) {}
            }
        }
    }
}
`;
