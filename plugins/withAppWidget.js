const { withAndroidManifest, withDangerousMod, AndroidConfig } = require("@expo/config-plugins");
const { writeNativeSource, writeResource, PKG } = require("./utils");

const PROVIDER_KT = `package ${PKG}.widget

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.SharedPreferences
import android.widget.RemoteViews
import ${PKG}.R
import ${PKG}.audio.RelaxAudioService

open class RelaxWidgetBase(private val size: String) : AppWidgetProvider() {

    override fun onUpdate(ctx: Context, mgr: AppWidgetManager, ids: IntArray) {
        ids.forEach { id -> updateWidget(ctx, mgr, id, size) }
    }

    override fun onReceive(ctx: Context, intent: Intent) {
        super.onReceive(ctx, intent)
        when (intent.action) {
            ACTION_TOGGLE -> startAudio(ctx, RelaxAudioService.ACTION_TOGGLE)
            ACTION_NEXT -> startAudio(ctx, RelaxAudioService.ACTION_NEXT)
            ACTION_PREV -> startAudio(ctx, RelaxAudioService.ACTION_PREV)
            ACTION_CYCLE_MODE -> {
                val prefs = ctx.getSharedPreferences("relax_widget", Context.MODE_PRIVATE)
                val order = listOf("video", "audio", "photo", "effects")
                val cur = prefs.getString("mode", "video") ?: "video"
                val next = order[(order.indexOf(cur) + 1) % order.size]
                prefs.edit().putString("mode", next).apply()
                refreshAll(ctx)
            }
            ACTION_CHANGE_WALLPAPER -> {
                val i = Intent("${PKG}.SHUFFLE_WALLPAPER").setPackage(ctx.packageName)
                ctx.sendBroadcast(i)
            }
            ACTION_VOL_UP -> adjustVolume(ctx, +0.08f)
            ACTION_VOL_DOWN -> adjustVolume(ctx, -0.08f)
            RelaxAudioService.ACTION_STATE -> refreshAll(ctx)
        }
    }

    private fun adjustVolume(ctx: Context, delta: Float) {
        val prefs = ctx.getSharedPreferences("relax_audio", Context.MODE_PRIVATE)
        val v = (prefs.getFloat("vol", 0.7f) + delta).coerceIn(0f, 1f)
        prefs.edit().putFloat("vol", v).apply()
        val i = Intent(ctx, RelaxAudioService::class.java).apply {
            action = RelaxAudioService.ACTION_VOLUME
            putExtra(RelaxAudioService.EXTRA_VOLUME, v)
        }
        if (android.os.Build.VERSION.SDK_INT >= 26) ctx.startForegroundService(i) else ctx.startService(i)
        refreshAll(ctx)
    }

    private fun startAudio(ctx: Context, action: String) {
        val i = Intent(ctx, RelaxAudioService::class.java).apply { this.action = action }
        if (android.os.Build.VERSION.SDK_INT >= 26) ctx.startForegroundService(i) else ctx.startService(i)
    }

    private fun refreshAll(ctx: Context) {
        val mgr = AppWidgetManager.getInstance(ctx)
        listOf(RelaxWidgetSmall::class.java, RelaxWidgetMedium::class.java, RelaxWidgetLarge::class.java)
            .forEach { clz ->
                val ids = mgr.getAppWidgetIds(ComponentName(ctx, clz))
                val sz = when (clz.simpleName) { "RelaxWidgetSmall" -> "small"; "RelaxWidgetLarge" -> "large"; else -> "medium" }
                ids.forEach { id -> updateWidget(ctx, mgr, id, sz) }
            }
    }

    companion object {
        const val ACTION_TOGGLE = "${PKG}.widget.TOGGLE"
        const val ACTION_NEXT = "${PKG}.widget.NEXT"
        const val ACTION_PREV = "${PKG}.widget.PREV"
        const val ACTION_CYCLE_MODE = "${PKG}.widget.CYCLE_MODE"
        const val ACTION_CHANGE_WALLPAPER = "${PKG}.widget.CHANGE_WP"
        const val ACTION_VOL_UP = "${PKG}.widget.VOL_UP"
        const val ACTION_VOL_DOWN = "${PKG}.widget.VOL_DOWN"

        fun updateWidget(ctx: Context, mgr: AppWidgetManager, id: Int, size: String) {
            val layout = when (size) {
                "small" -> R.layout::class.java.getField("relax_widget_small").getInt(null)
                "large" -> R.layout::class.java.getField("relax_widget_large").getInt(null)
                else -> R.layout::class.java.getField("relax_widget_medium").getInt(null)
            }
            val views = RemoteViews(ctx.packageName, layout)
            val audioPrefs = ctx.getSharedPreferences("relax_audio", Context.MODE_PRIVATE)
            val widgetPrefs = ctx.getSharedPreferences("relax_widget", Context.MODE_PRIVATE)
            val title = audioPrefs.getString("title", "Relax Sound") ?: "Relax Sound"
            val vol = audioPrefs.getFloat("vol", 0.7f)
            val mode = widgetPrefs.getString("mode", "video") ?: "video"

            try { views.setTextViewText(R.id::class.java.getField("title").getInt(null), title) } catch (_: Throwable) {}
            try { views.setTextViewText(R.id::class.java.getField("mode_label").getInt(null), mode.uppercase()) } catch (_: Throwable) {}
            try { views.setProgressBar(R.id::class.java.getField("vol_bar").getInt(null), 100, (vol * 100).toInt(), false) } catch (_: Throwable) {}

            // Always target ONE concrete receiver (Small) so the action is
            // delivered exactly once — otherwise all 3 widget receivers would
            // handle it (volume 3×delta, cycle 3 positions, etc).
            val pi = { action: String ->
                val i = Intent(ctx, RelaxWidgetSmall::class.java).apply { this.action = action }
                PendingIntent.getBroadcast(ctx, action.hashCode(), i, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
            }

            listOf(
                "btn_toggle" to ACTION_TOGGLE,
                "btn_next" to ACTION_NEXT,
                "btn_prev" to ACTION_PREV,
                "btn_mode" to ACTION_CYCLE_MODE,
                "btn_change_wp" to ACTION_CHANGE_WALLPAPER,
                "btn_vol_up" to ACTION_VOL_UP,
                "btn_vol_down" to ACTION_VOL_DOWN
            ).forEach { (viewName, action) ->
                try {
                    val vid = R.id::class.java.getField(viewName).getInt(null)
                    views.setOnClickPendingIntent(vid, pi(action))
                } catch (_: Throwable) {}
            }

            mgr.updateAppWidget(id, views)
        }
    }
}

class RelaxWidgetSmall : RelaxWidgetBase("small")
class RelaxWidgetMedium : RelaxWidgetBase("medium")
class RelaxWidgetLarge : RelaxWidgetBase("large")
`;

const MODULE_KT = `package ${PKG}.native

import android.appwidget.AppWidgetManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import com.facebook.react.bridge.*
import ${PKG}.widget.*

class RelaxWidgetModule(ctx: ReactApplicationContext) : ReactContextBaseJavaModule(ctx) {
    override fun getName() = "RelaxWidgetModule"

    @ReactMethod
    fun updateWidgetState(title: String, volume: Double, mode: String, promise: Promise) {
        val c = reactApplicationContext
        c.getSharedPreferences("relax_audio", Context.MODE_PRIVATE).edit()
            .putString("title", title).putFloat("vol", volume.toFloat()).apply()
        c.getSharedPreferences("relax_widget", Context.MODE_PRIVATE).edit()
            .putString("mode", mode).apply()
        val mgr = AppWidgetManager.getInstance(c)
        listOf(RelaxWidgetSmall::class.java, RelaxWidgetMedium::class.java, RelaxWidgetLarge::class.java)
            .forEach { clz ->
                val ids = mgr.getAppWidgetIds(ComponentName(c, clz))
                val sz = when (clz.simpleName) { "RelaxWidgetSmall" -> "small"; "RelaxWidgetLarge" -> "large"; else -> "medium" }
                ids.forEach { id -> RelaxWidgetBase.updateWidget(c, mgr, id, sz) }
            }
        promise.resolve(true)
    }

    @ReactMethod fun addListener(n: String) {}
    @ReactMethod fun removeListeners(n: Int) {}
}
`;

const widgetLayout = (variant) => {
  const showPrevNext = variant !== "small";
  const showVol = variant !== "small";
  const showMode = variant === "large" || variant === "medium";
  return `<?xml version="1.0" encoding="utf-8"?>
<LinearLayout xmlns:android="http://schemas.android.com/apk/res/android"
    android:layout_width="match_parent" android:layout_height="match_parent"
    android:padding="10dp" android:orientation="vertical"
    android:background="@drawable/widget_background">
    <TextView android:id="@+id/title"
        android:layout_width="match_parent" android:layout_height="wrap_content"
        android:text="Relax Sound"
        android:textColor="#E8FFEF" android:textSize="14sp" android:singleLine="true"/>
    ${showMode ? `<TextView android:id="@+id/mode_label"
        android:layout_width="match_parent" android:layout_height="wrap_content"
        android:text="VIDEO" android:textColor="#9EE2B8" android:textSize="10sp"/>` : ""}
    <LinearLayout android:layout_width="match_parent" android:layout_height="wrap_content"
        android:orientation="horizontal" android:layout_marginTop="6dp">
        ${showPrevNext ? `<ImageButton android:id="@+id/btn_prev"
            android:layout_width="36dp" android:layout_height="36dp"
            android:background="@android:color/transparent"
            android:src="@android:drawable/ic_media_previous" android:tint="#E8FFEF"/>` : ""}
        <ImageButton android:id="@+id/btn_toggle"
            android:layout_width="36dp" android:layout_height="36dp"
            android:background="@android:color/transparent"
            android:src="@android:drawable/ic_media_play" android:tint="#E8FFEF"/>
        ${showPrevNext ? `<ImageButton android:id="@+id/btn_next"
            android:layout_width="36dp" android:layout_height="36dp"
            android:background="@android:color/transparent"
            android:src="@android:drawable/ic_media_next" android:tint="#E8FFEF"/>` : ""}
        <ImageButton android:id="@+id/btn_mode"
            android:layout_width="36dp" android:layout_height="36dp"
            android:background="@android:color/transparent"
            android:src="@android:drawable/ic_menu_rotate" android:tint="#9EE2B8"/>
        <ImageButton android:id="@+id/btn_change_wp"
            android:layout_width="36dp" android:layout_height="36dp"
            android:background="@android:color/transparent"
            android:src="@android:drawable/ic_menu_gallery" android:tint="#9EE2B8"/>
    </LinearLayout>
    ${showVol ? `<LinearLayout android:layout_width="match_parent" android:layout_height="wrap_content"
        android:orientation="horizontal" android:layout_marginTop="6dp" android:gravity="center_vertical">
        <ImageButton android:id="@+id/btn_vol_down"
            android:layout_width="32dp" android:layout_height="32dp"
            android:background="@android:color/transparent"
            android:src="@android:drawable/ic_lock_silent_mode" android:tint="#E8FFEF"/>
        <ProgressBar android:id="@+id/vol_bar"
            style="@android:style/Widget.ProgressBar.Horizontal"
            android:layout_width="0dp" android:layout_weight="1" android:layout_height="8dp"
            android:layout_marginStart="6dp" android:layout_marginEnd="6dp"
            android:max="100" android:progress="70"/>
        <ImageButton android:id="@+id/btn_vol_up"
            android:layout_width="32dp" android:layout_height="32dp"
            android:background="@android:color/transparent"
            android:src="@android:drawable/ic_lock_silent_mode_off" android:tint="#E8FFEF"/>
    </LinearLayout>` : ""}
</LinearLayout>
`;
};

const widgetInfo = (variant) => {
  const [minW, minH, cellW, cellH] = variant === "small"
    ? [110, 40, 2, 1]
    : variant === "large"
      ? [250, 180, 4, 3]
      : [180, 110, 3, 2];
  return `<?xml version="1.0" encoding="utf-8"?>
<appwidget-provider xmlns:android="http://schemas.android.com/apk/res/android"
    android:minWidth="${minW}dp"
    android:minHeight="${minH}dp"
    android:targetCellWidth="${cellW}"
    android:targetCellHeight="${cellH}"
    android:updatePeriodMillis="0"
    android:initialLayout="@layout/relax_widget_${variant}"
    android:resizeMode="horizontal|vertical"
    android:widgetCategory="home_screen|keyguard"
    android:description="@string/app_name"/>
`;
};

const WIDGET_BG = `<?xml version="1.0" encoding="utf-8"?>
<shape xmlns:android="http://schemas.android.com/apk/res/android" android:shape="rectangle">
  <solid android:color="#D00b1f14"/>
  <corners android:radius="24dp"/>
  <stroke android:width="1dp" android:color="#6611E3A1"/>
</shape>
`;

const withAppWidgetManifest = (config) =>
  withAndroidManifest(config, (config) => {
    const app = AndroidConfig.Manifest.getMainApplicationOrThrow(config.modResults);
    app["receiver"] = app["receiver"] || [];
    [["small", "RelaxWidgetSmall"], ["medium", "RelaxWidgetMedium"], ["large", "RelaxWidgetLarge"]].forEach(
      ([size, cls]) => {
        if (!app["receiver"].some((r) => r.$["android:name"] === `.widget.${cls}`)) {
          app["receiver"].push({
            $: { "android:name": `.widget.${cls}`, "android:exported": "true" },
            "intent-filter": [
              { action: [{ $: { "android:name": "android.appwidget.action.APPWIDGET_UPDATE" } }] },
              { action: [{ $: { "android:name": "com.relaxsound.livewallpapers.widget.TOGGLE" } }] },
              { action: [{ $: { "android:name": "com.relaxsound.livewallpapers.widget.NEXT" } }] },
              { action: [{ $: { "android:name": "com.relaxsound.livewallpapers.widget.PREV" } }] },
              { action: [{ $: { "android:name": "com.relaxsound.livewallpapers.widget.CYCLE_MODE" } }] },
              { action: [{ $: { "android:name": "com.relaxsound.livewallpapers.widget.CHANGE_WP" } }] },
              { action: [{ $: { "android:name": "com.relaxsound.livewallpapers.widget.VOL_UP" } }] },
              { action: [{ $: { "android:name": "com.relaxsound.livewallpapers.widget.VOL_DOWN" } }] }
            ],
            "meta-data": [
              {
                $: {
                  "android:name": "android.appwidget.provider",
                  "android:resource": `@xml/relax_widget_${size}_info`
                }
              }
            ]
          });
        }
      }
    );
    return config;
  });

const withAppWidgetFiles = (config) =>
  withDangerousMod(config, [
    "android",
    async (config) => {
      const root = config.modRequest.projectRoot;
      writeNativeSource(root, "widget/RelaxWidget.kt", PROVIDER_KT);
      writeNativeSource(root, "native/RelaxWidgetModule.kt", MODULE_KT);
      ["small", "medium", "large"].forEach((v) => {
        writeResource(root, `layout/relax_widget_${v}.xml`, widgetLayout(v));
        writeResource(root, `xml/relax_widget_${v}_info.xml`, widgetInfo(v));
      });
      writeResource(root, "drawable/widget_background.xml", WIDGET_BG);
      return config;
    }
  ]);

module.exports = (config) => withAppWidgetFiles(withAppWidgetManifest(config));
