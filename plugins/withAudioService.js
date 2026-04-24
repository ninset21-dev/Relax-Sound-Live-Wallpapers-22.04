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
        const val EXTRA_URL = "url"
        const val EXTRA_TITLE = "title"
        const val EXTRA_VOLUME = "volume"
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
                    if (wasPlaying && appVisible) fadeInAndResume()
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
                play(url)
            }
            ACTION_PAUSE -> pauseInternal(userInitiated = true)
            ACTION_TOGGLE -> togglePlayPause()
            ACTION_NEXT -> sendBroadcast(Intent("${PKG}.audio.REQUEST_NEXT").setPackage(packageName))
            ACTION_PREV -> sendBroadcast(Intent("${PKG}.audio.REQUEST_PREV").setPackage(packageName))
            ACTION_VOLUME -> {
                targetVolume = intent.getFloatExtra(EXTRA_VOLUME, 0.7f).coerceIn(0f, 1f)
                player?.volume = targetVolume
                persistPrefs()
                broadcastState()
            }
        }
        return START_STICKY
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

    private fun ensurePlayer() {
        if (player != null) return
        player = ExoPlayer.Builder(this).build().apply {
            setAudioAttributes(
                M3AudioAttributes.Builder()
                    .setUsage(androidx.media3.common.C.USAGE_MEDIA)
                    .setContentType(androidx.media3.common.C.AUDIO_CONTENT_TYPE_MUSIC)
                    .build(), false
            )
            addListener(object : Player.Listener {
                override fun onIsPlayingChanged(isPlaying: Boolean) { broadcastState() }
                override fun onPlayerError(error: androidx.media3.common.PlaybackException) {
                    Log.e(TAG, "player error", error); pauseInternal()
                }
            })
        }
    }

    private fun play(url: String) {
        if (!requestFocus()) return
        ensurePlayer()
        player?.apply {
            stop()
            clearMediaItems()
            setMediaItem(MediaItem.fromUri(Uri.parse(url)))
            prepare()
            volume = 0f
            playWhenReady = true
        }
        fadeInVolume()
        getSharedPreferences("relax_audio", MODE_PRIVATE).edit().putBoolean("was_playing", true).apply()
        startForeground(NOTIF_ID, buildNotification())
    }

    private fun togglePlayPause() {
        val p = player ?: return
        if (p.isPlaying) pauseInternal(userInitiated = true) else fadeInAndResume()
    }

    private fun pauseInternal(userInitiated: Boolean = false) {
        player?.pause()
        releaseFocus()
        if (userInitiated) {
            // Clear the resume flag so SCREEN_ON / visibility broadcasts don't
            // auto-restart playback that the user deliberately stopped.
            getSharedPreferences("relax_audio", MODE_PRIVATE)
                .edit().putBoolean("was_playing", false).apply()
        }
        broadcastState()
    }

    private fun fadeInAndResume() {
        // pauseInternal() releases audio focus, so we must re-acquire it here
        // before resuming. Otherwise we'd play without holding focus — other
        // apps' audio wouldn't be ducked and no focus-change callbacks would
        // fire, leaving the service in an inconsistent state.
        if (!requestFocus()) return
        ensurePlayer()
        val p = player ?: return
        if (!p.isPlaying) { p.volume = 0f; p.play() }
        fadeInVolume()
    }

    private var fadeRunner: Runnable? = null

    private fun fadeInVolume() {
        val steps = 20
        val durationMs = getSharedPreferences("relax_audio", MODE_PRIVATE).getInt("fade_ms", 2500)
        val stepDelay = (durationMs / steps).toLong().coerceAtLeast(20L)
        fadeRunner?.let { handler.removeCallbacks(it) }
        var i = 0
        val runner = object : Runnable {
            override fun run() {
                val p = player ?: return
                i++
                p.volume = (targetVolume * (i.toFloat() / steps)).coerceIn(0f, 1f)
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
            .apply()
    }

    private fun broadcastState() {
        persistPrefs()
        val intent = Intent(ACTION_STATE).apply {
            setPackage(packageName)
            putExtra("title", currentTitle)
            putExtra("isPlaying", player?.isPlaying == true)
            putExtra("volume", targetVolume)
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
        try {
            val ctx = reactApplicationContext
            val i = Intent(ctx, RelaxAudioService::class.java).apply {
                action = RelaxAudioService.ACTION_PLAY
                putExtra(RelaxAudioService.EXTRA_URL, url)
                putExtra(RelaxAudioService.EXTRA_TITLE, title)
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
            val i = Intent(ctx, RelaxAudioService::class.java).apply {
                action = RelaxAudioService.ACTION_VOLUME
                putExtra(RelaxAudioService.EXTRA_VOLUME, vol.toFloat())
            }
            // Persist immediately so the widget/UI stay in sync even if the service
            // isn't running yet (API 31+ disallows plain startService from background).
            ctx.getSharedPreferences("relax_audio", Context.MODE_PRIVATE)
                .edit().putFloat("vol", vol.toFloat()).apply()
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
    return config;
  });

const withAudioFiles = (config) =>
  withDangerousMod(config, [
    "android",
    async (config) => {
      const root = config.modRequest.projectRoot;
      writeNativeSource(root, "audio/RelaxAudioService.kt", SERVICE_KT);
      writeNativeSource(root, "native/RelaxAudioModule.kt", MODULE_KT);
      return config;
    }
  ]);

module.exports = (config) => withAudioFiles(withAudioManifest(config));
