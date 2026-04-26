const { withAndroidManifest, withDangerousMod, AndroidConfig } = require("@expo/config-plugins");
const { writeNativeSource, PKG } = require("./utils");

const SERVICE_KT = `package ${PKG}.audio

import android.app.*
import android.content.*
import android.graphics.BitmapFactory
import android.media.AudioAttributes
import android.media.AudioFocusRequest
import android.media.AudioManager
import android.net.Uri
import android.os.*
import android.util.Log
import androidx.core.app.NotificationCompat
import androidx.media3.common.AudioAttributes as M3AudioAttributes
import androidx.media3.common.MediaItem
import androidx.media3.common.Player
import androidx.media3.exoplayer.ExoPlayer
import ${PKG}.R

/**
 * Foreground audio service: plays a single ExoPlayer stream, handles audio-focus,
 * screen-off auto-pause, SCREEN_ON fade-in volume, and broadcasts state updates
 * that the JS layer + widgets subscribe to. Guarantees only ONE stream at a time.
 */
class RelaxAudioService : Service() {

    companion object {
        const val ACTION_PLAY = "${PKG}.audio.PLAY"
        const val ACTION_PAUSE = "${PKG}.audio.PAUSE"
        const val ACTION_TOGGLE = "${PKG}.audio.TOGGLE"
        const val ACTION_NEXT = "${PKG}.audio.NEXT"
        const val ACTION_PREV = "${PKG}.audio.PREV"
        const val ACTION_VOLUME = "${PKG}.audio.VOLUME"
        const val ACTION_STATE = "${PKG}.audio.STATE"
        const val ACTION_DUCK = "${PKG}.audio.DUCK"
        const val ACTION_UNDUCK = "${PKG}.audio.UNDUCK"
        const val ACTION_TOGGLE_REPEAT = "${PKG}.audio.TOGGLE_REPEAT"
        const val ACTION_RESUME = "${PKG}.audio.RESUME"
        const val EXTRA_URL = "url"
        const val EXTRA_TITLE = "title"
        const val EXTRA_VOLUME = "volume"
        const val EXTRA_GAPLESS = "gapless"
        const val CHANNEL_ID = "relax_audio_channel"
        const val NOTIF_ID = 4711
        const val TAG = "RelaxAudio"
    }

    private var player: ExoPlayer? = null
    private var audioManager: AudioManager? = null
    private var focusRequest: AudioFocusRequest? = null
    private var currentTitle: String = ""
    private var targetVolume: Float = 0.7f
    private var appVisible: Boolean = true
    private val handler = Handler(Looper.getMainLooper())

    private val screenReceiver = object : BroadcastReceiver() {
        override fun onReceive(ctx: Context, intent: Intent) {
            when (intent.action) {
                Intent.ACTION_SCREEN_OFF -> pauseInternal()
                Intent.ACTION_USER_PRESENT, Intent.ACTION_SCREEN_ON -> {
                    val wasPlaying = getSharedPreferences("relax_audio", MODE_PRIVATE)
                        .getBoolean("was_playing", false)
                    // On unlock we resume unconditionally if the user hadn't
                    // deliberately paused — we can't rely on appVisible here
                    // because the wallpaper engine's onVisibilityChanged(true)
                    // broadcast races with USER_PRESENT (and may never fire
                    // at all if the user hasn't installed the live wallpaper).
                    // If the user actually opens another app afterwards, the
                    // wallpaper visibility broadcast will pause us again.
                    if (wasPlaying) {
                        appVisible = true
                        fadeInAndResume()
                    }
                }
            }
        }
    }

    private val visibilityReceiver = object : BroadcastReceiver() {
        override fun onReceive(ctx: Context, intent: Intent) {
            appVisible = intent.getBooleanExtra("visible", true)
            if (!appVisible) pauseInternal() else if (getSharedPreferences("relax_audio", MODE_PRIVATE)
                    .getBoolean("was_playing", false)) fadeInAndResume()
        }
    }

    override fun onCreate() {
        super.onCreate()
        audioManager = getSystemService(Context.AUDIO_SERVICE) as AudioManager
        targetVolume = getSharedPreferences("relax_audio", MODE_PRIVATE).getFloat("vol", 0.7f)
        createChannel()
        registerReceiver(screenReceiver, IntentFilter().apply {
            addAction(Intent.ACTION_SCREEN_OFF)
            addAction(Intent.ACTION_SCREEN_ON)
            addAction(Intent.ACTION_USER_PRESENT)
        })
        if (Build.VERSION.SDK_INT >= 33)
            registerReceiver(visibilityReceiver, IntentFilter("${PKG}.WALLPAPER_VISIBILITY"), Context.RECEIVER_NOT_EXPORTED)
        else
            registerReceiver(visibilityReceiver, IntentFilter("${PKG}.WALLPAPER_VISIBILITY"))
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        // If started via startForegroundService (API 26+), we MUST call startForeground
        // within 5s — even for actions that don't start playback.
        try { startForeground(NOTIF_ID, buildNotification()) } catch (_: Throwable) {}
        when (intent?.action) {
            ACTION_PLAY -> {
                val url = intent.getStringExtra(EXTRA_URL) ?: return START_NOT_STICKY
                currentTitle = intent.getStringExtra(EXTRA_TITLE) ?: "Relax"
                val gapless = intent.getBooleanExtra(EXTRA_GAPLESS, false)
                play(url, gapless)
            }
            ACTION_PAUSE -> pauseInternal(userInitiated = true)
            ACTION_TOGGLE -> togglePlayPause()
            ACTION_RESUME -> {
                // Triggered by AudioWakeReceiver on USER_PRESENT/SCREEN_ON.
                // We don't toggle here — only resume if the user had music
                // playing before lock (was_playing=true).
                val prefs = getSharedPreferences("relax_audio", MODE_PRIVATE)
                if (prefs.getBoolean("was_playing", false)) fadeInAndResume()
            }
            ACTION_NEXT -> stepPlaylist(+1)
            ACTION_PREV -> stepPlaylist(-1)
            ACTION_DUCK -> duck()
            ACTION_UNDUCK -> unduck()
            ACTION_VOLUME -> {
                targetVolume = intent.getFloatExtra(EXTRA_VOLUME, 0.7f).coerceIn(0f, 1f)
                if (!ducked) player?.volume = targetVolume
                // Widget volume should also drive the wallpaper video's volume
                // (user expectation: one slider => one global volume). The
                // wallpaper engine re-reads this pref every frame tick.
                getSharedPreferences("relax_wallpaper_prefs", MODE_PRIVATE).edit()
                    .putFloat("wallpaper_video_volume", targetVolume).apply()
                sendBroadcast(Intent("${PKG}.WALLPAPER_VOLUME_CHANGED").setPackage(packageName).putExtra("volume", targetVolume))
                persistPrefs()
                broadcastState()
            }
            ACTION_TOGGLE_REPEAT -> {
                val prefs = getSharedPreferences("relax_audio", MODE_PRIVATE)
                val cur = prefs.getString("repeat_mode", "off") ?: "off"
                val next = when (cur) { "off" -> "all"; "all" -> "one"; else -> "off" }
                prefs.edit().putString("repeat_mode", next).apply()
                player?.repeatMode = when (next) {
                    "one" -> Player.REPEAT_MODE_ONE
                    "all" -> Player.REPEAT_MODE_ALL
                    else -> Player.REPEAT_MODE_OFF
                }
                broadcastState()
            }
        }
        return START_STICKY
    }

    /**
     * Walk the persisted playlist (written by JS via RelaxAudioModule.setPlaylist)
     * directly in native code so the widget/floating controls work even while
     * the RN layer is not running. Falls back to the legacy REQUEST broadcast if
     * we have no playlist yet, giving JS a chance to pick something.
     */
    private fun stepPlaylist(dir: Int) {
        val prefs = getSharedPreferences("relax_audio", MODE_PRIVATE)
        val raw = prefs.getString("playlist_json", null)
        if (raw.isNullOrBlank()) {
            val dirStr = if (dir > 0) "REQUEST_NEXT" else "REQUEST_PREV"
            sendBroadcast(Intent("${PKG}.audio.$dirStr").setPackage(packageName))
            return
        }
        try {
            val arr = org.json.JSONArray(raw)
            if (arr.length() == 0) return
            var idx = prefs.getInt("playlist_index", 0)
            idx = ((idx + dir) % arr.length() + arr.length()) % arr.length()
            val obj = arr.getJSONObject(idx)
            val url = obj.optString("uri", "")
            val title = obj.optString("title", "Relax")
            if (url.isBlank()) return
            prefs.edit().putInt("playlist_index", idx).apply()
            currentTitle = title
            // Track switch must feel instant — short fade-in (no perceived
            // pause). Caller (widget/app) explicitly chose to switch tracks.
            play(url, gapless = true)
            sendBroadcast(
                Intent("${PKG}.audio.TRACK_CHANGED").setPackage(packageName)
                    .putExtra("uri", url).putExtra("title", title).putExtra("index", idx)
            )
        } catch (t: Throwable) { Log.e(TAG, "stepPlaylist", t) }
    }

    /** Reduce volume to 20% of target (no focus release) for external video etc. */
    private var ducked: Boolean = false
    private fun duck() {
        ducked = true
        player?.volume = (targetVolume * 0.2f).coerceIn(0f, 1f)
    }
    private fun unduck() {
        ducked = false
        player?.volume = targetVolume
    }

    private fun requestFocus(): Boolean {
        val am = audioManager ?: return false
        val attrs = AudioAttributes.Builder()
            .setUsage(AudioAttributes.USAGE_MEDIA)
            .setContentType(AudioAttributes.CONTENT_TYPE_MUSIC)
            .build()
        focusRequest = AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN)
            .setAudioAttributes(attrs)
            .setWillPauseWhenDucked(true)
            .setOnAudioFocusChangeListener { change ->
                when (change) {
                    AudioManager.AUDIOFOCUS_LOSS,
                    AudioManager.AUDIOFOCUS_LOSS_TRANSIENT,
                    AudioManager.AUDIOFOCUS_LOSS_TRANSIENT_CAN_DUCK -> pauseInternal()
                    AudioManager.AUDIOFOCUS_GAIN -> fadeInAndResume()
                }
            }
            .build()
        return am.requestAudioFocus(focusRequest!!) == AudioManager.AUDIOFOCUS_REQUEST_GRANTED
    }

    private fun releaseFocus() {
        audioManager?.let { am -> focusRequest?.let { am.abandonAudioFocusRequest(it) } }
    }

    /**
     * Apply the standard audio attributes, persisted repeat mode, and
     * isPlaying/error listeners to a freshly built ExoPlayer.
     */
    private fun configurePlayer(p: ExoPlayer) {
        val repeat = getSharedPreferences("relax_audio", MODE_PRIVATE)
            .getString("repeat_mode", "off") ?: "off"
        p.setAudioAttributes(
            M3AudioAttributes.Builder()
                .setUsage(androidx.media3.common.C.USAGE_MEDIA)
                .setContentType(androidx.media3.common.C.AUDIO_CONTENT_TYPE_MUSIC)
                .build(), false
        )
        p.repeatMode = when (repeat) {
            "one" -> Player.REPEAT_MODE_ONE
            "all" -> Player.REPEAT_MODE_ALL
            else -> Player.REPEAT_MODE_OFF
        }
        p.addListener(object : Player.Listener {
            override fun onIsPlayingChanged(isPlaying: Boolean) { broadcastState() }
            override fun onPlayerError(error: androidx.media3.common.PlaybackException) {
                Log.e(TAG, "player error", error); pauseInternal()
            }
        })
    }

    private fun ensurePlayer() {
        if (player != null) return
        val p = ExoPlayer.Builder(this).build()
        configurePlayer(p)
        player = p
    }

    private fun play(url: String, gapless: Boolean = false) {
        if (!requestFocus()) return
        // Single-player gapless: stop the current stream, swap MediaItem
        // and prepare on the SAME ExoPlayer instance. Followed by a fast
        // 200 ms fade-in (vs the cold-start 2.5s ramp) so the user does
        // not perceive a noticeable pause between stations. The previous
        // dual-player crossfade caused two streams to overlap whenever
        // the user tapped a new station mid-fade — single player
        // eliminates that whole class of bugs.
        ensurePlayer()
        val p = player ?: return
        try { p.stop() } catch (_: Throwable) {}
        try { p.clearMediaItems() } catch (_: Throwable) {}
        p.setMediaItem(MediaItem.fromUri(Uri.parse(url)))
        p.prepare()
        p.volume = 0f
        p.playWhenReady = true
        fadeInVolume(quick = gapless)
        // Persist the last URL so fadeInAndResume() can restore playback even
        // after the service was killed and the player lost its media item.
        getSharedPreferences("relax_audio", MODE_PRIVATE).edit()
            .putBoolean("was_playing", true)
            .putString("last_url", url)
            .putString("last_title", currentTitle)
            .apply()
        startForeground(NOTIF_ID, buildNotification())
    }

    private fun togglePlayPause() {
        val p = player ?: return
        if (p.isPlaying) pauseInternal(userInitiated = true) else fadeInAndResume()
    }

    private fun pauseInternal(userInitiated: Boolean = false) {
        // Persist the "do not auto-resume" flag SYNCHRONOUSLY when the user
        // deliberately paused — the subsequent fade-out is async (~1.25s) and
        // can be cancelled by a re-entrant fadeOutAndPause from SCREEN_OFF /
        // focus-loss broadcasts, losing the deferred flag and causing unwanted
        // auto-resume on screen unlock.
        if (userInitiated) {
            getSharedPreferences("relax_audio", MODE_PRIVATE)
                .edit().putBoolean("was_playing", false).apply()
        }
        // Smooth volume fade-out then actually pause. releaseFocus() +
        // broadcastState() stay in the completion callback so we don't release
        // focus mid-fade (which would let other apps overlap audio) and don't
        // broadcast isPlaying=false while the player is still audibly playing.
        fadeOutAndPause {
            releaseFocus()
            broadcastState()
        }
    }

    private fun fadeOutAndPause(onComplete: (() -> Unit)? = null) {
        val p = player ?: run { onComplete?.invoke(); return }
        val steps = 16
        val durationMs = (getSharedPreferences("relax_audio", MODE_PRIVATE)
            .getInt("fade_ms", 2500) / 2).coerceAtLeast(300)
        val stepDelay = (durationMs / steps).toLong().coerceAtLeast(15L)
        fadeRunner?.let { handler.removeCallbacks(it) }
        val startVol = p.volume
        var i = 0
        val runner = object : Runnable {
            override fun run() {
                val pp = player ?: run { onComplete?.invoke(); return }
                i++
                val k = 1f - (i.toFloat() / steps)
                pp.volume = (startVol * k).coerceIn(0f, 1f)
                if (i < steps) {
                    handler.postDelayed(this, stepDelay)
                } else {
                    pp.pause()
                    pp.volume = startVol // restore for next play
                    fadeRunner = null
                    onComplete?.invoke()
                }
            }
        }
        fadeRunner = runner
        handler.post(runner)
    }

    private fun fadeInAndResume() {
        // pauseInternal() releases audio focus, so we must re-acquire it here
        // before resuming. Otherwise we'd play without holding focus — other
        // apps' audio wouldn't be ducked and no focus-change callbacks would
        // fire, leaving the service in an inconsistent state.
        if (!requestFocus()) return
        ensurePlayer()
        val p = player ?: return
        // If the service was killed (LMK/Doze) while the phone was locked, the
        // newly-built player has no media item. Re-hydrate from prefs so unlock
        // actually resumes playback instead of silently doing nothing.
        if (p.mediaItemCount == 0) {
            val prefs = getSharedPreferences("relax_audio", MODE_PRIVATE)
            val url = prefs.getString("last_url", null)
            val title = prefs.getString("last_title", "Relax") ?: "Relax"
            if (!url.isNullOrBlank()) {
                currentTitle = title
                p.setMediaItem(MediaItem.fromUri(Uri.parse(url)))
                p.prepare()
            } else {
                return
            }
        }
        if (!p.isPlaying) { p.volume = 0f; p.play() }
        fadeInVolume()
        // Make sure we're in the foreground so the system doesn't kill us
        // mid-resume (the first pauseInternal + fade can demote priority).
        try { startForeground(NOTIF_ID, buildNotification()) } catch (_: Throwable) {}
    }

    private var fadeRunner: Runnable? = null

    private fun fadeInVolume(quick: Boolean = false) {
        // For track switches we use a 200 ms ramp instead of the full
        // user-configured fade — the user wants the next track to start
        // playing without a perceived pause.
        val steps = if (quick) 4 else 20
        val durationMs =
            if (quick) 200
            else getSharedPreferences("relax_audio", MODE_PRIVATE).getInt("fade_ms", 2500)
        val stepDelay = (durationMs / steps).toLong().coerceAtLeast(20L)
        fadeRunner?.let { handler.removeCallbacks(it) }
        var i = 0
        val runner = object : Runnable {
            override fun run() {
                val p = player ?: return
                i++
                // Respect the duck flag so the wallpaper video's audio isn't
                // overridden when the wallpaper comes back into view and both
                // a DUCK intent + a visibility broadcast land in parallel.
                val cap = if (ducked) targetVolume * 0.2f else targetVolume
                p.volume = (cap * (i.toFloat() / steps)).coerceIn(0f, 1f)
                if (i < steps) handler.postDelayed(this, stepDelay) else fadeRunner = null
            }
        }
        fadeRunner = runner
        handler.post(runner)
    }

    private fun createChannel() {
        if (Build.VERSION.SDK_INT >= 26) {
            val nm = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            val ch = NotificationChannel(CHANNEL_ID, "Relax Audio", NotificationManager.IMPORTANCE_LOW)
            ch.setShowBadge(false)
            nm.createNotificationChannel(ch)
        }
    }

    private fun buildNotification(): Notification {
        val pauseIntent = PendingIntent.getService(
            this, 0, Intent(this, RelaxAudioService::class.java).setAction(ACTION_TOGGLE),
            PendingIntent.FLAG_IMMUTABLE
        )
        val icon = try { R.mipmap::class.java.getField("ic_launcher").getInt(null) }
            catch (_: Throwable) { android.R.drawable.ic_media_play }
        val b = NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle(currentTitle)
            .setContentText("Relax Sound Live Wallpapers")
            .setSmallIcon(icon)
            .setOngoing(true)
            .addAction(android.R.drawable.ic_media_pause, "Play/Pause", pauseIntent)
            .setPriority(NotificationCompat.PRIORITY_LOW)
        return b.build()
    }

    private fun persistPrefs() {
        getSharedPreferences("relax_audio", MODE_PRIVATE).edit()
            .putString("title", currentTitle)
            .putFloat("vol", targetVolume)
            // is_playing reflects the actual ExoPlayer state (false during
            // focus loss, screen off, etc) — separate from was_playing which
            // captures user intent for auto-resume. Widgets and the volume
            // broadcast read this rather than was_playing to avoid showing a
            // false "Pause" icon while the player is silent.
            .putBoolean("is_playing", player?.isPlaying == true)
            .apply()
    }

    private fun broadcastState() {
        persistPrefs()
        val repeat = getSharedPreferences("relax_audio", MODE_PRIVATE)
            .getString("repeat_mode", "off") ?: "off"
        val intent = Intent(ACTION_STATE).apply {
            setPackage(packageName)
            putExtra("title", currentTitle)
            putExtra("isPlaying", player?.isPlaying == true)
            putExtra("volume", targetVolume)
            putExtra("repeatMode", repeat)
        }
        sendBroadcast(intent)
    }

    override fun onBind(intent: Intent?): IBinder? = null
    override fun onDestroy() {
        try { unregisterReceiver(screenReceiver) } catch (_: Throwable) {}
        try { unregisterReceiver(visibilityReceiver) } catch (_: Throwable) {}
        player?.release(); player = null; releaseFocus()
        super.onDestroy()
    }
}
`;

const MODULE_KT = `package ${PKG}.native

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.os.Build
import com.facebook.react.bridge.*
import com.facebook.react.modules.core.DeviceEventManagerModule
import ${PKG}.audio.RelaxAudioService

class RelaxAudioModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {
    override fun getName() = "RelaxAudioModule"

    private val stateReceiver = object : BroadcastReceiver() {
        override fun onReceive(ctx: Context, intent: Intent) {
            try {
                when (intent.action) {
                    RelaxAudioService.ACTION_STATE -> {
                        val params = Arguments.createMap().apply {
                            putString("title", intent.getStringExtra("title") ?: "")
                            putBoolean("isPlaying", intent.getBooleanExtra("isPlaying", false))
                            putDouble("volume", intent.getFloatExtra("volume", 0.7f).toDouble())
                            putString("repeatMode", intent.getStringExtra("repeatMode") ?: "off")
                        }
                        reactApplicationContext
                            .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                            .emit("RelaxAudioState", params)
                    }
                    "${PKG}.audio.REQUEST_NEXT",
                    "${PKG}.audio.REQUEST_PREV" -> {
                        val dir = if (intent.action?.endsWith("NEXT") == true) "next" else "prev"
                        val params = Arguments.createMap().apply { putString("direction", dir) }
                        reactApplicationContext
                            .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                            .emit("RelaxAudioRequest", params)
                    }
                }
            } catch (_: Throwable) {}
        }
    }

    override fun initialize() {
        super.initialize()
        val filter = IntentFilter().apply {
            addAction(RelaxAudioService.ACTION_STATE)
            addAction("${PKG}.audio.REQUEST_NEXT")
            addAction("${PKG}.audio.REQUEST_PREV")
        }
        try {
            if (Build.VERSION.SDK_INT >= 33)
                reactApplicationContext.registerReceiver(stateReceiver, filter, Context.RECEIVER_NOT_EXPORTED)
            else
                reactApplicationContext.registerReceiver(stateReceiver, filter)
        } catch (_: Throwable) {}
    }

    override fun invalidate() {
        try { reactApplicationContext.unregisterReceiver(stateReceiver) } catch (_: Throwable) {}
        super.invalidate()
    }

    @ReactMethod
    fun play(url: String, title: String, promise: Promise) {
        playInternal(url, title, gapless = false, promise = promise)
    }

    /**
     * Switch to a different track without the long fade-in (req: next/prev
     * must not feel like the player paused). Used by JS nextTrack/prevTrack.
     */
    @ReactMethod
    fun playSwitch(url: String, title: String, promise: Promise) {
        playInternal(url, title, gapless = true, promise = promise)
    }

    private fun playInternal(url: String, title: String, gapless: Boolean, promise: Promise) {
        try {
            val ctx = reactApplicationContext
            val i = Intent(ctx, RelaxAudioService::class.java).apply {
                action = RelaxAudioService.ACTION_PLAY
                putExtra(RelaxAudioService.EXTRA_URL, url)
                putExtra(RelaxAudioService.EXTRA_TITLE, title)
                putExtra(RelaxAudioService.EXTRA_GAPLESS, gapless)
            }
            if (android.os.Build.VERSION.SDK_INT >= 26) ctx.startForegroundService(i) else ctx.startService(i)
            promise.resolve(true)
        } catch (t: Throwable) { promise.reject("PLAY_FAIL", t) }
    }

    @ReactMethod fun pause(promise: Promise) { action(RelaxAudioService.ACTION_PAUSE, promise) }
    @ReactMethod fun toggle(promise: Promise) { action(RelaxAudioService.ACTION_TOGGLE, promise) }

    @ReactMethod
    fun setVolume(vol: Double, promise: Promise) {
        try {
            val ctx = reactApplicationContext
            val v = vol.toFloat().coerceIn(0f, 1f)
            // Persist immediately so the widget/UI stay in sync even if the
            // service isn't running yet (API 31+ disallows plain startService
            // from background).
            ctx.getSharedPreferences("relax_audio", Context.MODE_PRIVATE)
                .edit().putFloat("vol", v).apply()
            // Broadcast ACTION_STATE right now (preserving the currently
            // persisted isPlaying + title + repeat) so widgets/floating/UI
            // all see the new volume in the next frame — not only after the
            // service eventually processes ACTION_VOLUME. This is what makes
            // the slider on one widget update every other widget in real
            // time.
            val prefs = ctx.getSharedPreferences("relax_audio", Context.MODE_PRIVATE)
            ctx.sendBroadcast(
                Intent(RelaxAudioService.ACTION_STATE)
                    .setPackage(ctx.packageName)
                    .putExtra("title", prefs.getString("title", "Relax Sound"))
                    // Use is_playing (real player state from broadcastState),
                    // not was_playing (user intent for auto-resume), so the
                    // UI doesn't briefly flash a Pause icon when adjusting
                    // volume during a focus-loss interruption.
                    .putExtra("isPlaying", prefs.getBoolean("is_playing", false))
                    .putExtra("volume", v)
                    .putExtra("repeatMode", prefs.getString("repeat_mode", "off"))
            )
            val i = Intent(ctx, RelaxAudioService::class.java).apply {
                action = RelaxAudioService.ACTION_VOLUME
                putExtra(RelaxAudioService.EXTRA_VOLUME, v)
            }
            if (Build.VERSION.SDK_INT >= 26) ctx.startForegroundService(i) else ctx.startService(i)
            promise.resolve(true)
        } catch (t: Throwable) { promise.reject("VOLUME_FAIL", t) }
    }

    @ReactMethod
    fun setFadeMs(ms: Int, promise: Promise) {
        reactApplicationContext.getSharedPreferences("relax_audio", Context.MODE_PRIVATE)
            .edit().putInt("fade_ms", ms.coerceIn(200, 15000)).apply()
        promise.resolve(true)
    }

    /**
     * Persist the playlist so the native service can step NEXT/PREV without
     * depending on the RN runtime being alive. JS passes an array of
     * { uri, title } objects and the current index.
     */
    @ReactMethod
    fun setPlaylist(items: ReadableArray, currentIndex: Int, promise: Promise) {
        try {
            val arr = org.json.JSONArray()
            for (i in 0 until items.size()) {
                val m = items.getMap(i) ?: continue
                arr.put(org.json.JSONObject().apply {
                    put("uri", m.getString("uri") ?: "")
                    put("title", m.getString("title") ?: "Relax")
                })
            }
            reactApplicationContext.getSharedPreferences("relax_audio", Context.MODE_PRIVATE)
                .edit()
                .putString("playlist_json", arr.toString())
                .putInt("playlist_index", currentIndex.coerceIn(0, (arr.length() - 1).coerceAtLeast(0)))
                .apply()
            promise.resolve(true)
        } catch (t: Throwable) { promise.reject("PLAYLIST_FAIL", t) }
    }

    @ReactMethod fun duck(promise: Promise) { action(RelaxAudioService.ACTION_DUCK, promise) }
    @ReactMethod fun unduck(promise: Promise) { action(RelaxAudioService.ACTION_UNDUCK, promise) }
    @ReactMethod fun toggleRepeat(promise: Promise) { action(RelaxAudioService.ACTION_TOGGLE_REPEAT, promise) }

    @ReactMethod
    fun setRepeatMode(mode: String, promise: Promise) {
        try {
            reactApplicationContext.getSharedPreferences("relax_audio", Context.MODE_PRIVATE)
                .edit().putString("repeat_mode", mode).apply()
            // Ask service to apply immediately if running
            val ctx = reactApplicationContext
            val i = Intent(ctx, RelaxAudioService::class.java).apply { action = RelaxAudioService.ACTION_TOGGLE_REPEAT }
            // Avoid toggle: use a dedicated action path via intent extra; service re-reads pref.
            // (Simpler: just persist — user-visible effect takes effect on next play.)
            promise.resolve(true)
        } catch (t: Throwable) { promise.reject("REPEAT_FAIL", t) }
    }

    private fun action(a: String, promise: Promise) {
        try {
            val ctx = reactApplicationContext
            val i = Intent(ctx, RelaxAudioService::class.java).apply { action = a }
            if (Build.VERSION.SDK_INT >= 26) ctx.startForegroundService(i) else ctx.startService(i)
            promise.resolve(true)
        } catch (t: Throwable) { promise.reject("ACTION_FAIL", t) }
    }

    @ReactMethod fun addListener(eventName: String) {}
    @ReactMethod fun removeListeners(count: Int) {}
}
`;

// Manifest-declared receiver that starts the audio service on USER_PRESENT
// (screen unlock) and BOOT_COMPLETED. Without a manifest receiver, an unlock
// after Doze/LowMemoryKiller killed the in-service screenReceiver would never
// resume music — req #17 ("music must auto-play on unlock"). USER_PRESENT and
// BOOT_COMPLETED are both still allowed in manifest on modern Android.
const WAKE_RECEIVER_KT = `package ${PKG}.audio

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build

class AudioWakeReceiver : BroadcastReceiver() {
    override fun onReceive(ctx: Context, intent: Intent) {
        when (intent.action) {
            Intent.ACTION_USER_PRESENT, Intent.ACTION_SCREEN_ON,
            Intent.ACTION_BOOT_COMPLETED, "android.intent.action.LOCKED_BOOT_COMPLETED" -> {
                val prefs = ctx.getSharedPreferences("relax_audio", Context.MODE_PRIVATE)
                val wasPlaying = prefs.getBoolean("was_playing", false)
                val lastUrl = prefs.getString("last_url", null)
                // Resume only if the user had something playing before lock —
                // a fresh boot with no last_url should not auto-blast audio.
                // (The first-launch default station is started from the JS
                // layer when AppContext hydrates, where the user is actually
                // looking at the app.)
                if (!wasPlaying || lastUrl.isNullOrBlank()) return
                val svc = Intent(ctx, RelaxAudioService::class.java).apply {
                    action = RelaxAudioService.ACTION_RESUME
                }
                try {
                    // USER_PRESENT, SCREEN_ON and BOOT_COMPLETED are all
                    // exempt from Android 12's foreground-service start
                    // restriction (BG_FGS_START_NOT_ALLOWED). Wrap in
                    // try/catch anyway — vendor ROMs sometimes still throw
                    // and a silent failure beats a crash on user unlock.
                    if (Build.VERSION.SDK_INT >= 26) ctx.startForegroundService(svc)
                    else ctx.startService(svc)
                } catch (_: Throwable) {
                    try { ctx.startService(svc) } catch (_: Throwable) {}
                }
            }
        }
    }
}
`;

const withAudioManifest = (config) =>
  withAndroidManifest(config, (config) => {
    const app = AndroidConfig.Manifest.getMainApplicationOrThrow(config.modResults);
    app["service"] = app["service"] || [];
    if (!app["service"].some((s) => s.$["android:name"] === ".audio.RelaxAudioService")) {
      app["service"].push({
        $: {
          "android:name": ".audio.RelaxAudioService",
          "android:exported": "false",
          "android:foregroundServiceType": "mediaPlayback"
        }
      });
    }
    app["receiver"] = app["receiver"] || [];
    if (!app["receiver"].some((r) => r.$["android:name"] === ".audio.AudioWakeReceiver")) {
      app["receiver"].push({
        $: { "android:name": ".audio.AudioWakeReceiver", "android:exported": "true" },
        "intent-filter": [
          { action: [{ $: { "android:name": "android.intent.action.USER_PRESENT" } }] },
          { action: [{ $: { "android:name": "android.intent.action.SCREEN_ON" } }] },
          { action: [{ $: { "android:name": "android.intent.action.BOOT_COMPLETED" } }] },
          { action: [{ $: { "android:name": "android.intent.action.LOCKED_BOOT_COMPLETED" } }] }
        ]
      });
    }
    return config;
  });

const withAudioFiles = (config) =>
  withDangerousMod(config, [
    "android",
    async (config) => {
      const root = config.modRequest.projectRoot;
      writeNativeSource(root, "audio/RelaxAudioService.kt", SERVICE_KT);
      writeNativeSource(root, "audio/AudioWakeReceiver.kt", WAKE_RECEIVER_KT);
      writeNativeSource(root, "native/RelaxAudioModule.kt", MODULE_KT);
      return config;
    }
  ]);

module.exports = (config) => withAudioFiles(withAudioManifest(config));
