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
        // Dedicated background thread for bitmap decoding. BitmapFactory on
        // 4K wallpaper images can take 100-500ms which would freeze frameTick
        // and trigger ANRs if done on the main handler.
        private val decodeThread = android.os.HandlerThread("relax-wp-decode").apply { start() }
        private val decodeHandler = Handler(decodeThread.looper)
        @Volatile private var decodingUri: String? = null
        private val prefs: SharedPreferences =
            getSharedPreferences(PREFS, Context.MODE_PRIVATE)

        private var mediaPlayer: MediaPlayer? = null
        private var effectRenderer: EffectRenderer? = null
        private var visible = false
        private var cachedBg: android.graphics.Bitmap? = null
        private var cachedBgUri: String? = null
        // Start the auto-swap "clock" from engine creation so the first swap
        // fires after the user's configured interval instead of immediately
        // on device boot / wallpaper reload.
        private var lastAutoSwapMs: Long = System.currentTimeMillis()
        private var autoSwapIndex: Int = 0

        private fun maybeAutoSwap() {
            val widgetPrefs = getSharedPreferences("relax_widget", Context.MODE_PRIVATE)
            val enabled = widgetPrefs.getBoolean("autochange_enabled", false)
            if (!enabled) return
            val intervalSec = widgetPrefs.getInt("autochange_sec", 60).coerceAtLeast(10)
            val now = System.currentTimeMillis()
            if (now - lastAutoSwapMs < intervalSec * 1000L) return
            val raw = widgetPrefs.getString("wallpaper_library_json", null) ?: return
            try {
                val arr = org.json.JSONArray(raw)
                if (arr.length() < 2) return
                autoSwapIndex = (autoSwapIndex + 1) % arr.length()
                val item = arr.getJSONObject(autoSwapIndex)
                val uri = item.optString("uri", "")
                val type = item.optString("type", "image")
                if (uri.isBlank()) return
                val key = if (type == "video") "wallpaper_video_uri" else "wallpaper_image_uri"
                val clearKey = if (type == "video") "wallpaper_image_uri" else "wallpaper_video_uri"
                prefs.edit().putString(key, uri).remove(clearKey).apply()
                lastAutoSwapMs = now
                // If we just switched to a video but currently have no player,
                // tear down the engine and force setupMedia() next frame by
                // nulling cache.
                if (type == "video" && mediaPlayer == null) {
                    setupMedia(surfaceHolder)
                } else if (type == "image" && mediaPlayer != null) {
                    try { mediaPlayer?.stop(); mediaPlayer?.release() } catch (_: Throwable) {}
                    mediaPlayer = null
                }
            } catch (t: Throwable) { Log.e(TAG, "autoswap", t) }
        }

        private val frameTick = object : Runnable {
            override fun run() {
                if (!visible) return
                maybeAutoSwap()
                // React to wallpaper swap (auto-change / widget shuffle): if the
                // stored imageUri changed, decode the new bitmap OFF the frame
                // thread. We keep drawing the old cachedBg while the new one
                // is being decoded so frames never stall.
                val newUri = prefs.getString("wallpaper_image_uri", null)
                if (newUri != cachedBgUri && newUri != decodingUri) {
                    cachedBgUri = newUri
                    decodingUri = newUri
                    if (newUri.isNullOrBlank()) {
                        val old = cachedBg
                        cachedBg = null
                        try { old?.recycle() } catch (_: Throwable) {}
                    } else {
                        decodeHandler.post {
                            var bm: android.graphics.Bitmap? = null
                            try {
                                contentResolver.openInputStream(Uri.parse(newUri))?.use { input ->
                                    bm = BitmapFactory.decodeStream(input)
                                }
                            } catch (t: Throwable) { Log.e(TAG, "swap decode", t) }
                            // Publish the result back on the main handler so
                            // cachedBg reads/writes stay single-threaded with
                            // the draw loop.
                            handler.post {
                                // If another swap happened while we were
                                // decoding, drop this stale bitmap.
                                if (cachedBgUri == newUri) {
                                    val old = cachedBg
                                    cachedBg = bm
                                    try { old?.recycle() } catch (_: Throwable) {}
                                } else {
                                    try { bm?.recycle() } catch (_: Throwable) {}
                                }
                                if (decodingUri == newUri) decodingUri = null
                            }
                        }
                    }
                }
                // Skip Canvas-based overlay while MediaPlayer owns the surface
                // (locking the canvas on a surface attached to MediaPlayer would
                // throw IllegalStateException / clobber video frames).
                if (mediaPlayer == null) drawFrame()
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
            // If the wallpaper has sound-enabled video, ask the audio service to
            // duck (dim) its stream while the video is visible, un-duck otherwise.
            if (mediaPlayer != null && prefs.getBoolean("wallpaper_video_audio", false)) {
                val ctx = this@RelaxWallpaperService
                val cls = Class.forName("${pkg}.audio.RelaxAudioService")
                val i = Intent(ctx, cls).apply {
                    action = if (v) "${pkg}.audio.DUCK" else "${pkg}.audio.UNDUCK"
                }
                try {
                    if (android.os.Build.VERSION.SDK_INT >= 26) ctx.startForegroundService(i) else ctx.startService(i)
                } catch (_: Throwable) {}
            }
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
            try { cachedBg?.recycle() } catch (_: Throwable) {}
            cachedBg = null
            super.onSurfaceDestroyed(holder)
        }

        override fun onDestroy() {
            try { decodeThread.quitSafely() } catch (_: Throwable) {}
            super.onDestroy()
        }

        override fun onTouchEvent(event: MotionEvent) {
            gestureDetector.onTouchEvent(event)
        }

        private fun setupMedia(holder: SurfaceHolder) {
            val videoUri = prefs.getString("wallpaper_video_uri", null)
            val imageUri = prefs.getString("wallpaper_image_uri", null)
            if (!videoUri.isNullOrBlank()) {
                try {
                    val audioEnabled = prefs.getBoolean("wallpaper_video_audio", false)
                    mediaPlayer = MediaPlayer().apply {
                        setDataSource(this@RelaxWallpaperService, Uri.parse(videoUri))
                        isLooping = true
                        setVolume(if (audioEnabled) 1f else 0f, if (audioEnabled) 1f else 0f)
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

        /**
         * Compute a centre-crop destination rect so wallpapers keep their aspect
         * ratio instead of being stretched. Android's default Rect(0,0,w,h)
         * stretches; we shrink/enlarge the source to fully cover the surface.
         */
        private fun centerCropDst(bmpW: Int, bmpH: Int, canW: Int, canH: Int): Rect {
            if (bmpW == 0 || bmpH == 0) return Rect(0, 0, canW, canH)
            val scale = maxOf(canW.toFloat() / bmpW, canH.toFloat() / bmpH)
            val dstW = (bmpW * scale).toInt()
            val dstH = (bmpH * scale).toInt()
            val dx = (canW - dstW) / 2
            val dy = (canH - dstH) / 2
            return Rect(dx, dy, dx + dstW, dy + dstH)
        }

        private fun drawImage(holder: SurfaceHolder, uri: String?) {
            if (uri != null) {
                try {
                    contentResolver.openInputStream(Uri.parse(uri))?.use { input ->
                        cachedBg = BitmapFactory.decodeStream(input)
                    }
                    cachedBgUri = uri
                } catch (t: Throwable) {
                    Log.e(TAG, "decode image failed", t)
                }
            }
            val canvas = try { holder.lockCanvas() } catch (_: Throwable) { null } ?: return
            try {
                canvas.drawColor(Color.parseColor("#0b1f14"))
                cachedBg?.let { bmp ->
                    canvas.drawBitmap(bmp, null, centerCropDst(bmp.width, bmp.height, canvas.width, canvas.height), null)
                }
            } finally {
                try { holder.unlockCanvasAndPost(canvas) } catch (_: Throwable) {}
            }
        }

        private fun drawFrame() {
            val effect = prefs.getString("effect_type", "none") ?: "none"
            val holder = surfaceHolder
            val canvas = try { holder.lockCanvas() } catch (_: Throwable) { null } ?: return
            try {
                // Always repaint the backdrop first — lockCanvas returns a fresh buffer
                // so without this the screen would flash black between effect frames.
                canvas.drawColor(Color.parseColor("#0b1f14"))
                cachedBg?.let { bmp ->
                    canvas.drawBitmap(bmp, null, centerCropDst(bmp.width, bmp.height, canvas.width, canvas.height), null)
                }
                if (effect != "none") {
                    effectRenderer?.drawOverlay(
                        canvas,
                        effect,
                        intensity = prefs.getFloat("effect_intensity", 0.5f),
                        speed = prefs.getFloat("effect_speed", 1.0f)
                    )
                }
            } finally {
                try { holder.unlockCanvasAndPost(canvas) } catch (_: Throwable) {}
            }
        }
    }
}
`;
