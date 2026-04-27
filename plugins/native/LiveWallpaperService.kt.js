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
        // Previous bitmap kept alive while a crossfade is running so old and
        // new wallpapers can both be drawn with opposing alphas. Produces a
        // smooth fade-in on auto-change / widget-shuffle instead of an abrupt
        // swap.
        private var prevBg: android.graphics.Bitmap? = null
        private var fadeStartMs: Long = 0
        private val fadeDurationMs: Long = 900
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
                } else if (type == "video" && mediaPlayer != null) {
                    // video -> video: release the old player so setupMedia
                    // re-binds the surface to the new URI. Without this the
                    // previous clip keeps playing even though prefs point to
                    // the new one.
                    try { mediaPlayer?.stop(); mediaPlayer?.release() } catch (_: Throwable) {}
                    mediaPlayer = null
                    setupMedia(surfaceHolder)
                } else if (type == "image" && mediaPlayer != null) {
                    try { mediaPlayer?.stop(); mediaPlayer?.release() } catch (_: Throwable) {}
                    mediaPlayer = null
                }
            } catch (t: Throwable) { Log.e(TAG, "autoswap", t) }
        }

        // Keep the last applied video volume so we only call setVolume() when
        // it actually changes — setVolume inside a running MediaPlayer hot
        // path would otherwise be called 30-60x per second.
        private var lastAppliedVideoVolume: Float = -1f
        private var cachedVideoUri: String? = null

        private val frameTick = object : Runnable {
            override fun run() {
                if (!visible) return
                maybeAutoSwap()
                // Keep wallpaper video volume in sync with the global volume
                // pref (written by widget/UI). Only re-apply on change.
                val curVol = prefs.getFloat("wallpaper_video_volume", 0.7f)
                if (mediaPlayer != null && curVol != lastAppliedVideoVolume) {
                    applyVideoVolume()
                    lastAppliedVideoVolume = curVol
                }
                // Detect widget-triggered video change: wallpaper_video_uri
                // may have been updated by the widget (cycle wallpaper) or
                // auto-swap. Rebuild the MediaPlayer so the new clip actually
                // plays instead of the old one looping forever.
                val newVideoUri = prefs.getString("wallpaper_video_uri", null)
                if (newVideoUri != cachedVideoUri) {
                    cachedVideoUri = newVideoUri
                    try { mediaPlayer?.stop(); mediaPlayer?.release() } catch (_: Throwable) {}
                    mediaPlayer = null
                    lastAppliedVideoVolume = -1f
                    if (!newVideoUri.isNullOrBlank()) setupMedia(surfaceHolder)
                }
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
                                bm = decodeSampled(newUri)
                            } catch (t: Throwable) { Log.e(TAG, "swap decode", t) }
                            // Publish the result back on the main handler so
                            // cachedBg reads/writes stay single-threaded with
                            // the draw loop.
                            handler.post {
                                // If another swap happened while we were
                                // decoding, drop this stale bitmap.
                                if (cachedBgUri == newUri) {
                                    // Start a crossfade: keep the old bitmap
                                    // as prevBg for fadeDurationMs; drawFrame
                                    // draws both with opposing alphas during
                                    // this window, producing a smooth swap.
                                    try { prevBg?.recycle() } catch (_: Throwable) {}
                                    prevBg = cachedBg
                                    cachedBg = bm
                                    fadeStartMs = System.currentTimeMillis()
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
                val fps = prefs.getInt("effect_fps", 30).coerceIn(10, 120)
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
            cachedVideoUri = null
            try { cachedBg?.recycle() } catch (_: Throwable) {}
            cachedBg = null
            cachedBgUri = null
            try { prevBg?.recycle() } catch (_: Throwable) {}
            prevBg = null
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
                    // Track user's global volume so widget volume affects the
                    // video audio too (req: "volume sync across all widgets").
                    val vol = if (audioEnabled)
                        prefs.getFloat("wallpaper_video_volume", 0.7f).coerceIn(0f, 1f)
                    else 0f
                    // Req #3: video\u2192photo\u2192video regression. When the user
                    // applies an image wallpaper after a video, the engine
                    // owned the Surface as a video producer; the new image
                    // path then drew via lockCanvas() (CPU producer). Going
                    // back to video would fail because MediaPlayer cannot
                    // bind to a Surface still claimed by a Canvas producer.
                    //
                    // The correct cure is to fully release any prior
                    // MediaPlayer (above), and bind via setDisplay(holder)
                    // \u2014 which goes through SurfaceHolder.addCallback paths
                    // and tolerates the producer-mode switch. We do NOT
                    // pre-clear with lockCanvas here \u2014 that would actively
                    // PUT the surface into CPU mode for fresh installs and
                    // break the basic case (user reported "video doesn't
                    // install at all").
                    try { mediaPlayer?.stop(); mediaPlayer?.release() } catch (_: Throwable) {}
                    mediaPlayer = null
                    // Surface might still be in CPU producer mode after the
                    // last drawFrame() (image wallpaper). Clear it once with
                    // an empty lockCanvas so the next setDisplay() can claim
                    // the producer slot cleanly. Wrapped in try so a fresh
                    // surface (no prior canvas use) doesn't fail.
                    try {
                        val c = holder.lockCanvas()
                        if (c != null) {
                            c.drawColor(0, android.graphics.PorterDuff.Mode.CLEAR)
                            holder.unlockCanvasAndPost(c)
                        }
                    } catch (_: Throwable) {}
                    Log.i(TAG, "video setup uri=$videoUri")
                    mediaPlayer = MediaPlayer().apply {
                        // Prefer a file descriptor for file:// paths — bypasses
                        // any URI permission quirks and works on every API.
                        var loaded = false
                        try {
                            val u = Uri.parse(videoUri)
                            val path = if (u.scheme == "file") u.path else null
                            if (path != null) {
                                val f = java.io.File(path)
                                if (f.exists() && f.length() > 0) {
                                    java.io.FileInputStream(f).use { fis ->
                                        setDataSource(fis.fd)
                                    }
                                    loaded = true
                                    Log.i(TAG, "video fd ok size=\${f.length()}")
                                }
                            }
                            if (!loaded) {
                                setDataSource(this@RelaxWallpaperService, u)
                                loaded = true
                            }
                        } catch (t: Throwable) {
                            Log.e(TAG, "video setDataSource failed", t)
                        }
                        if (!loaded) return@apply
                        isLooping = true
                        setVolume(vol, vol)
                        setDisplay(holder)
                        setOnPreparedListener {
                            try { it.start(); Log.i(TAG, "video started ok") }
                            catch (t: Throwable) { Log.e(TAG, "video start fail", t) }
                        }
                        setOnErrorListener { _, what, extra ->
                            Log.e(TAG, "MediaPlayer error what=$what extra=$extra uri=$videoUri")
                            true
                        }
                        try { prepareAsync() }
                        catch (t: Throwable) { Log.e(TAG, "prepareAsync failed", t) }
                    }
                    // Track that we've bound this URI so frameTick's change
                    // detector doesn't immediately tear the player down on
                    // the very next frame (Devin Review fix).
                    cachedVideoUri = videoUri
                    lastAppliedVideoVolume = vol
                } catch (t: Throwable) {
                    Log.e(TAG, "video init failed", t)
                    drawImage(holder, imageUri)
                }
            } else {
                drawImage(holder, imageUri)
            }
        }

        /**
         * Called when the user changes volume from any widget/UI. We re-apply it
         * to the wallpaper video MediaPlayer so all volume sliders are synced.
         */
        fun applyVideoVolume() {
            val mp = mediaPlayer ?: return
            val audioEnabled = prefs.getBoolean("wallpaper_video_audio", false)
            val vol = if (audioEnabled)
                prefs.getFloat("wallpaper_video_volume", 0.7f).coerceIn(0f, 1f)
            else 0f
            try { mp.setVolume(vol, vol) } catch (_: Throwable) {}
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

        /**
         * Decode an image URI at roughly screen resolution using
         * BitmapFactory.Options.inSampleSize. A 4K photo decoded at full
         * size is 60+ MB and takes 100-500 ms to copy to the surface every
         * frame — the user reported lag on the smooth wallpaper crossfade
         * (req #6). Downsampling to ~screen resolution keeps fades smooth.
         */
        private fun decodeSampled(uri: String): android.graphics.Bitmap? {
            return try {
                val targetW = (resources.displayMetrics.widthPixels.coerceAtLeast(720))
                val targetH = (resources.displayMetrics.heightPixels.coerceAtLeast(1280))
                val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
                contentResolver.openInputStream(Uri.parse(uri))?.use { input ->
                    BitmapFactory.decodeStream(input, null, bounds)
                }
                var sample = 1
                val w = bounds.outWidth.coerceAtLeast(1)
                val h = bounds.outHeight.coerceAtLeast(1)
                while (w / (sample * 2) >= targetW && h / (sample * 2) >= targetH) sample *= 2
                val opts = BitmapFactory.Options().apply {
                    inSampleSize = sample
                    inPreferredConfig = android.graphics.Bitmap.Config.ARGB_8888
                }
                contentResolver.openInputStream(Uri.parse(uri))?.use { input ->
                    BitmapFactory.decodeStream(input, null, opts)
                }
            } catch (t: Throwable) { Log.e(TAG, "decode sampled", t); null }
        }

        private fun drawImage(holder: SurfaceHolder, uri: String?) {
            if (uri != null) {
                try {
                    cachedBg = decodeSampled(uri)
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
                // Crossfade handling: when prevBg is non-null and fadeStartMs
                // is recent, blend old wallpaper out and new wallpaper in.
                val now = System.currentTimeMillis()
                val elapsed = now - fadeStartMs
                val fadeActive = prevBg != null && elapsed in 0..fadeDurationMs
                if (fadeActive) {
                    val t = (elapsed.toFloat() / fadeDurationMs).coerceIn(0f, 1f)
                    val paint = android.graphics.Paint()
                    prevBg?.let { pb ->
                        paint.alpha = ((1f - t) * 255).toInt().coerceIn(0, 255)
                        canvas.drawBitmap(pb, null, centerCropDst(pb.width, pb.height, canvas.width, canvas.height), paint)
                    }
                    cachedBg?.let { bmp ->
                        paint.alpha = (t * 255).toInt().coerceIn(0, 255)
                        canvas.drawBitmap(bmp, null, centerCropDst(bmp.width, bmp.height, canvas.width, canvas.height), paint)
                    }
                } else {
                    // Fade complete — release the old bitmap once.
                    if (prevBg != null && elapsed > fadeDurationMs) {
                        try { prevBg?.recycle() } catch (_: Throwable) {}
                        prevBg = null
                    }
                    cachedBg?.let { bmp ->
                        canvas.drawBitmap(bmp, null, centerCropDst(bmp.width, bmp.height, canvas.width, canvas.height), null)
                    }
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
