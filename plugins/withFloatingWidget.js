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
        params.gravity = Gravity.TOP or Gravity.START
        params.x = 40; params.y = 400
        layoutParams = params
        wm?.addView(view, params)
        overlay = view
        wireUp(view)
    }

    private fun removeOverlay() {
        try { overlay?.let { wm?.removeView(it) } } catch (_: Throwable) {}
        overlay = null
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
            val i = Intent(this, RelaxAudioService::class.java).apply { action = RelaxAudioService.ACTION_TOGGLE }
            startService(i)
        }
        v.findViewById<View>(id("btn_close")).setOnClickListener {
            removeOverlay(); stopSelf()
        }

        val slider = v.findViewById<View>(id("volume_slider"))
        slider.setOnTouchListener(object : View.OnTouchListener {
            override fun onTouch(view: View, ev: MotionEvent): Boolean {
                when (ev.action) {
                    MotionEvent.ACTION_DOWN, MotionEvent.ACTION_MOVE -> {
                        val frac = (ev.x / view.width.toFloat()).coerceIn(0f, 1f)
                        val progress = (frac * 100).toInt()
                        v.findViewById<ProgressBar>(id("volume_bar")).progress = progress
                        val i = Intent(this@RelaxFloatingService, RelaxAudioService::class.java).apply {
                            action = RelaxAudioService.ACTION_VOLUME
                            putExtra(RelaxAudioService.EXTRA_VOLUME, frac)
                        }
                        startService(i)
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
                        p.x = ix + (ev.rawX - itx).toInt()
                        p.y = iy + (ev.rawY - ity).toInt()
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
    override fun onDestroy() { removeOverlay(); super.onDestroy() }
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
    <ImageView android:id="@+id/overlay_bubble"
        android:layout_width="56dp" android:layout_height="56dp"
        android:background="@drawable/bubble_background"
        android:padding="10dp"
        android:src="@android:drawable/ic_menu_compass"
        android:tint="#E8FFEF"
        android:visibility="gone"/>
    <LinearLayout android:id="@+id/overlay_expanded"
        android:layout_width="260dp" android:layout_height="wrap_content"
        android:orientation="vertical" android:padding="10dp"
        android:background="@drawable/bubble_background">
        <LinearLayout android:layout_width="match_parent" android:layout_height="wrap_content"
            android:orientation="horizontal" android:gravity="center_vertical">
            <ImageButton android:id="@+id/btn_toggle_play"
                android:layout_width="36dp" android:layout_height="36dp"
                android:background="@android:color/transparent"
                android:src="@android:drawable/ic_media_play" android:tint="#E8FFEF"/>
            <TextView android:layout_width="0dp" android:layout_weight="1"
                android:layout_height="wrap_content" android:paddingStart="6dp"
                android:text="Relax Sound" android:textColor="#E8FFEF" android:textSize="12sp"/>
            <ImageButton android:id="@+id/btn_collapse"
                android:layout_width="32dp" android:layout_height="32dp"
                android:background="@android:color/transparent"
                android:src="@android:drawable/arrow_down_float" android:tint="#9EE2B8"/>
            <ImageButton android:id="@+id/btn_close"
                android:layout_width="32dp" android:layout_height="32dp"
                android:background="@android:color/transparent"
                android:src="@android:drawable/ic_menu_close_clear_cancel" android:tint="#9EE2B8"/>
        </LinearLayout>
        <FrameLayout android:id="@+id/volume_slider"
            android:layout_width="match_parent" android:layout_height="24dp"
            android:layout_marginTop="6dp">
            <ProgressBar android:id="@+id/volume_bar"
                style="@android:style/Widget.ProgressBar.Horizontal"
                android:layout_width="match_parent" android:layout_height="12dp"
                android:layout_gravity="center_vertical"
                android:max="100" android:progress="70"/>
        </FrameLayout>
    </LinearLayout>
</FrameLayout>
`;

const BUBBLE_BG = `<?xml version="1.0" encoding="utf-8"?>
<shape xmlns:android="http://schemas.android.com/apk/res/android" android:shape="rectangle">
  <solid android:color="#E60b1f14"/>
  <corners android:radius="28dp"/>
  <stroke android:width="1dp" android:color="#88 11E3A1" />
</shape>
`.replace("#88 11", "#8811");

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
      return config;
    }
  ]);

module.exports = (config) => withFloatingFiles(withFloatingManifest(config));
