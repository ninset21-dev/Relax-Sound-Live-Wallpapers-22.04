const { withAndroidManifest, withDangerousMod, AndroidConfig } = require("@expo/config-plugins");
const { writeNativeSource, writeResource, PKG } = require("./utils");

const SERVICE_KT = `package ${PKG}.floating

import android.app.*
import android.content.*
import android.graphics.PixelFormat
import android.os.*
import android.view.*
import android.view.animation.AccelerateDecelerateInterpolator
import android.widget.*
import androidx.core.app.NotificationCompat
import ${PKG}.R
import ${PKG}.audio.RelaxAudioService

/**
 * Floating bubble widget that sits on top of all apps (TYPE_APPLICATION_OVERLAY).
 * Expanded: play/pause, next, prev, change-wallpaper, volume slider (swipe).
 * Collapsed: single bubble with the app logo, tap or toggle button to expand/collapse.
 */
class RelaxFloatingService : Service() {

    companion object {
        const val CHANNEL = "relax_overlay"
        const val ACTION_SHOW = "${PKG}.floating.SHOW"
        const val ACTION_HIDE = "${PKG}.floating.HIDE"
        const val ACTION_TOGGLE = "${PKG}.floating.TOGGLE"
    }

    private var wm: WindowManager? = null
    private var overlay: View? = null
    private var collapsed: Boolean = false
    private var layoutParams: WindowManager.LayoutParams? = null

    private val stateReceiver = object : BroadcastReceiver() {
        override fun onReceive(ctx: Context, intent: Intent) {
            if (intent.action == RelaxAudioService.ACTION_STATE) {
                val vol = intent.getFloatExtra("volume", 0.7f)
                val title = intent.getStringExtra("title") ?: "Relax Sound"
                val isPlaying = intent.getBooleanExtra("isPlaying", false)
                overlay?.let { v ->
                    try {
                        val barId = R.id::class.java.getField("volume_bar").getInt(null)
                        v.findViewById<ProgressBar>(barId).progress = (vol * 100).toInt()
                        val titleId = R.id::class.java.getField("overlay_title").getInt(null)
                        v.findViewById<TextView>(titleId).text = title
                        val playId = R.id::class.java.getField("btn_toggle_play").getInt(null)
                        v.findViewById<ImageButton>(playId).setImageResource(
                            if (isPlaying) android.R.drawable.ic_media_pause else android.R.drawable.ic_media_play
                        )
                    } catch (_: Throwable) {}
                }
            }
        }
    }

    override fun onCreate() {
        super.onCreate()
        wm = getSystemService(Context.WINDOW_SERVICE) as WindowManager
        createChannel()
        startForeground(4712, NotificationCompat.Builder(this, CHANNEL)
            .setContentTitle("Relax Sound overlay")
            .setContentText("Плавающий виджет активен")
            .setSmallIcon(android.R.drawable.ic_menu_view)
            .setPriority(NotificationCompat.PRIORITY_MIN)
            .setOngoing(true)
            .build())
        try {
            val filter = IntentFilter(RelaxAudioService.ACTION_STATE)
            if (Build.VERSION.SDK_INT >= 33)
                registerReceiver(stateReceiver, filter, Context.RECEIVER_NOT_EXPORTED)
            else
                registerReceiver(stateReceiver, filter)
        } catch (_: Throwable) {}
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_SHOW -> showOverlay()
            ACTION_HIDE -> { removeOverlay(); stopSelf() }
            ACTION_TOGGLE -> toggleCollapsed()
        }
        return START_STICKY
    }

    private fun showOverlay() {
        if (overlay != null) return
        val inflater = getSystemService(Context.LAYOUT_INFLATER_SERVICE) as LayoutInflater
        val view = inflater.inflate(
            R.layout::class.java.getField("relax_floating_overlay").getInt(null), null
        )
        val params = WindowManager.LayoutParams(
            WindowManager.LayoutParams.WRAP_CONTENT,
            WindowManager.LayoutParams.WRAP_CONTENT,
            if (Build.VERSION.SDK_INT >= 26) WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
            else WindowManager.LayoutParams.TYPE_PHONE,
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or
                WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN,
            PixelFormat.TRANSLUCENT
        )
        // Default position: bottom-right corner with a small inset so the
        // bubble doesn't kiss the navigation bar / screen edge.
        params.gravity = Gravity.BOTTOM or Gravity.END
        params.x = 24; params.y = 160
        layoutParams = params
        wm?.addView(view, params)
        overlay = view
        wireUp(view)
    }

    private fun removeOverlay() {
        try { overlay?.let { wm?.removeView(it) } } catch (_: Throwable) {}
        overlay = null
    }

    private fun startAudio(action: String) {
        val i = Intent(this, RelaxAudioService::class.java).apply { this.action = action }
        try {
            if (Build.VERSION.SDK_INT >= 26) startForegroundService(i) else startService(i)
        } catch (_: Throwable) {}
    }

    private fun toggleCollapsed() {
        val v = overlay ?: return
        collapsed = !collapsed
        val expanded = v.findViewById<View>(R.id::class.java.getField("overlay_expanded").getInt(null))
        val bubble = v.findViewById<View>(R.id::class.java.getField("overlay_bubble").getInt(null))
        expanded.visibility = if (collapsed) View.GONE else View.VISIBLE
        bubble.visibility = if (collapsed) View.VISIBLE else View.GONE
    }

    private fun wireUp(v: View) {
        fun id(name: String) = R.id::class.java.getField(name).getInt(null)

        v.findViewById<View>(id("btn_collapse")).setOnClickListener { toggleCollapsed() }
        v.findViewById<View>(id("overlay_bubble")).setOnClickListener { toggleCollapsed() }
        v.findViewById<View>(id("btn_toggle_play")).setOnClickListener {
            startAudio(RelaxAudioService.ACTION_TOGGLE)
        }
        // New: explicit track navigation buttons on the floating widget.
        try { v.findViewById<View>(id("btn_prev_track")).setOnClickListener { startAudio(RelaxAudioService.ACTION_PREV) } } catch (_: Throwable) {}
        try { v.findViewById<View>(id("btn_next_track")).setOnClickListener { startAudio(RelaxAudioService.ACTION_NEXT) } } catch (_: Throwable) {}
        v.findViewById<View>(id("btn_close")).setOnClickListener {
            removeOverlay(); stopSelf()
        }

        // Vertical swipe slider: the bar is taller than wide, so drive volume
        // from (1 - y/height). Tap anywhere on it also snaps to that value.
        val slider = v.findViewById<View>(id("volume_slider"))
        slider.setOnTouchListener(object : View.OnTouchListener {
            override fun onTouch(view: View, ev: MotionEvent): Boolean {
                when (ev.action) {
                    MotionEvent.ACTION_DOWN, MotionEvent.ACTION_MOVE -> {
                        val frac = (1f - (ev.y / view.height.toFloat())).coerceIn(0f, 1f)
                        val progress = (frac * 100).toInt()
                        v.findViewById<ProgressBar>(id("volume_bar")).progress = progress
                        val i = Intent(this@RelaxFloatingService, RelaxAudioService::class.java).apply {
                            action = RelaxAudioService.ACTION_VOLUME
                            putExtra(RelaxAudioService.EXTRA_VOLUME, frac)
                        }
                        if (Build.VERSION.SDK_INT >= 26) startForegroundService(i) else startService(i)
                        return true
                    }
                }
                return false
            }
        })

        // drag
        var ix = 0; var iy = 0; var itx = 0f; var ity = 0f
        val bubble = v.findViewById<View>(id("overlay_bubble"))
        bubble.setOnTouchListener(object : View.OnTouchListener {
            override fun onTouch(view: View, ev: MotionEvent): Boolean {
                val p = layoutParams ?: return false
                when (ev.action) {
                    MotionEvent.ACTION_DOWN -> { ix = p.x; iy = p.y; itx = ev.rawX; ity = ev.rawY }
                    MotionEvent.ACTION_MOVE -> {
                        // Gravity is BOTTOM|END so x increases toward the LEFT
                        // and y increases toward the TOP. Invert the raw deltas
                        // so dragging the bubble feels natural.
                        p.x = (ix - (ev.rawX - itx).toInt()).coerceAtLeast(0)
                        p.y = (iy - (ev.rawY - ity).toInt()).coerceAtLeast(0)
                        wm?.updateViewLayout(v, p)
                    }
                }
                return false
            }
        })
    }

    private fun createChannel() {
        if (Build.VERSION.SDK_INT >= 26) {
            val nm = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            nm.createNotificationChannel(
                NotificationChannel(CHANNEL, "Overlay", NotificationManager.IMPORTANCE_MIN)
            )
        }
    }

    override fun onBind(intent: Intent?): IBinder? = null
    override fun onDestroy() {
        try { unregisterReceiver(stateReceiver) } catch (_: Throwable) {}
        removeOverlay(); super.onDestroy()
    }
}
`;

const MODULE_KT = `package ${PKG}.native

import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import com.facebook.react.bridge.*
import ${PKG}.floating.RelaxFloatingService

class RelaxFloatingModule(ctx: ReactApplicationContext) : ReactContextBaseJavaModule(ctx) {
    override fun getName() = "RelaxFloatingModule"

    @ReactMethod
    fun hasOverlayPermission(promise: Promise) {
        val ok = Build.VERSION.SDK_INT < 23 || Settings.canDrawOverlays(reactApplicationContext)
        promise.resolve(ok)
    }

    @ReactMethod
    fun requestOverlayPermission(promise: Promise) {
        try {
            val i = Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                Uri.parse("package:" + reactApplicationContext.packageName))
            i.flags = Intent.FLAG_ACTIVITY_NEW_TASK
            reactApplicationContext.startActivity(i); promise.resolve(true)
        } catch (t: Throwable) { promise.reject("OVERLAY_REQ_FAIL", t) }
    }

    @ReactMethod
    fun show(promise: Promise) {
        try {
            val i = Intent(reactApplicationContext, RelaxFloatingService::class.java).apply { action = RelaxFloatingService.ACTION_SHOW }
            if (Build.VERSION.SDK_INT >= 26) reactApplicationContext.startForegroundService(i)
            else reactApplicationContext.startService(i)
            promise.resolve(true)
        } catch (t: Throwable) { promise.reject("OVERLAY_SHOW_FAIL", t) }
    }

    @ReactMethod
    fun hide(promise: Promise) {
        try {
            val i = Intent(reactApplicationContext, RelaxFloatingService::class.java).apply { action = RelaxFloatingService.ACTION_HIDE }
            reactApplicationContext.startService(i); promise.resolve(true)
        } catch (t: Throwable) { promise.reject("OVERLAY_HIDE_FAIL", t) }
    }

    @ReactMethod fun addListener(n: String) {}
    @ReactMethod fun removeListeners(n: Int) {}
}
`;

const OVERLAY_LAYOUT = `<?xml version="1.0" encoding="utf-8"?>
<FrameLayout xmlns:android="http://schemas.android.com/apk/res/android"
    android:layout_width="wrap_content" android:layout_height="wrap_content">
    <!-- Collapsed: a minimal semi-transparent dot, no picture. Tap to expand. -->
    <View android:id="@+id/overlay_bubble"
        android:layout_width="28dp" android:layout_height="28dp"
        android:background="@drawable/bubble_dot"
        android:visibility="gone"/>
    <LinearLayout android:id="@+id/overlay_expanded"
        android:layout_width="78dp" android:layout_height="wrap_content"
        android:orientation="vertical" android:padding="8dp"
        android:gravity="center_horizontal"
        android:background="@drawable/bubble_background">
        <!-- Close button FIRST (top). User request: "кнопка удаления виджета
             должна находиться сверху". -->
        <ImageButton android:id="@+id/btn_close"
            android:layout_width="28dp" android:layout_height="28dp"
            android:background="@android:color/transparent"
            android:src="@android:drawable/ic_menu_close_clear_cancel" android:tint="#FFB4B4"/>
        <TextView android:id="@+id/overlay_title"
            android:layout_width="match_parent" android:layout_height="wrap_content"
            android:text="Relax"
            android:gravity="center"
            android:maxLines="2"
            android:layout_marginTop="4dp"
            android:ellipsize="end"
            android:textColor="#E8FFEF" android:textSize="10sp"/>
        <ImageButton android:id="@+id/btn_prev_track"
            android:layout_width="40dp" android:layout_height="40dp"
            android:layout_marginTop="6dp"
            android:background="@android:color/transparent"
            android:src="@android:drawable/ic_media_previous" android:tint="#9EE2B8"/>
        <ImageButton android:id="@+id/btn_toggle_play"
            android:layout_width="44dp" android:layout_height="44dp"
            android:layout_marginTop="2dp"
            android:background="@android:color/transparent"
            android:src="@android:drawable/ic_media_play" android:tint="#E8FFEF"/>
        <ImageButton android:id="@+id/btn_next_track"
            android:layout_width="40dp" android:layout_height="40dp"
            android:layout_marginTop="2dp"
            android:background="@android:color/transparent"
            android:src="@android:drawable/ic_media_next" android:tint="#9EE2B8"/>
        <FrameLayout android:id="@+id/volume_slider"
            android:layout_width="20dp" android:layout_height="110dp"
            android:layout_marginTop="8dp">
            <ProgressBar android:id="@+id/volume_bar"
                style="@android:style/Widget.ProgressBar.Horizontal"
                android:layout_width="110dp" android:layout_height="12dp"
                android:layout_gravity="center"
                android:rotation="270"
                android:max="100" android:progress="70"/>
        </FrameLayout>
        <!-- Collapse (minimize) at the bottom — keeps the dangerous "close" up top. -->
        <ImageButton android:id="@+id/btn_collapse"
            android:layout_width="28dp" android:layout_height="28dp"
            android:layout_marginTop="6dp"
            android:background="@android:color/transparent"
            android:src="@android:drawable/arrow_down_float" android:tint="#9EE2B8"/>
    </LinearLayout>
</FrameLayout>
`;

// Floating expanded panel — translucent forest gradient with a glassmorphic
// accent ring (req #2 + req #8: matches in-app GlassCard look).
const BUBBLE_BG = `<?xml version="1.0" encoding="utf-8"?>
<layer-list xmlns:android="http://schemas.android.com/apk/res/android">
  <item>
    <shape android:shape="rectangle">
      <solid android:color="#3322c55e"/>
      <corners android:radius="30dp"/>
    </shape>
  </item>
  <item android:left="2dp" android:top="2dp" android:right="2dp" android:bottom="2dp">
    <shape android:shape="rectangle">
      <gradient
        android:startColor="#B30b1f14"
        android:endColor="#800b1f14"
        android:angle="270"/>
      <corners android:radius="28dp"/>
      <stroke android:width="1dp" android:color="#5522c55e"/>
    </shape>
  </item>
</layer-list>
`;

// Collapsed bubble: a small translucent green dot with soft ring.
// User asked for transparent / no picture.
const BUBBLE_DOT = `<?xml version="1.0" encoding="utf-8"?>
<shape xmlns:android="http://schemas.android.com/apk/res/android" android:shape="oval">
  <solid android:color="#3322c55e"/>
  <stroke android:width="1dp" android:color="#9922c55e"/>
</shape>
`;

const withFloatingManifest = (config) =>
  withAndroidManifest(config, (config) => {
    const app = AndroidConfig.Manifest.getMainApplicationOrThrow(config.modResults);
    app["service"] = app["service"] || [];
    if (!app["service"].some((s) => s.$["android:name"] === ".floating.RelaxFloatingService")) {
      app["service"].push({
        $: {
          "android:name": ".floating.RelaxFloatingService",
          "android:exported": "false",
          "android:foregroundServiceType": "specialUse"
        },
        "property": [
          {
            $: {
              "android:name": "android.app.PROPERTY_SPECIAL_USE_FGS_SUBTYPE",
              "android:value": "floating_widget"
            }
          }
        ]
      });
    }
    return config;
  });

const withFloatingFiles = (config) =>
  withDangerousMod(config, [
    "android",
    async (config) => {
      const root = config.modRequest.projectRoot;
      writeNativeSource(root, "floating/RelaxFloatingService.kt", SERVICE_KT);
      writeNativeSource(root, "native/RelaxFloatingModule.kt", MODULE_KT);
      writeResource(root, "layout/relax_floating_overlay.xml", OVERLAY_LAYOUT);
      writeResource(root, "drawable/bubble_background.xml", BUBBLE_BG);
      writeResource(root, "drawable/bubble_dot.xml", BUBBLE_DOT);
      return config;
    }
  ]);

module.exports = (config) => withFloatingFiles(withFloatingManifest(config));
