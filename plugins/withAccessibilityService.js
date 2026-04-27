const { withAndroidManifest, withDangerousMod, AndroidConfig } = require("@expo/config-plugins");
const { writeNativeSource, writeResource, PKG } = require("./utils");

const SERVICE_KT = `package ${PKG}.a11y

import android.accessibilityservice.AccessibilityService
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.os.Build
import android.view.accessibility.AccessibilityEvent

/**
 * Listens for broadcasts from the wallpaper engine's double-tap gesture and
 * performs GLOBAL_ACTION_LOCK_SCREEN (Android 9+) to turn the display off.
 */
class DoubleTapLockService : AccessibilityService() {

    private val receiver = object : BroadcastReceiver() {
        override fun onReceive(ctx: Context, intent: Intent) {
            if (Build.VERSION.SDK_INT >= 28) {
                performGlobalAction(GLOBAL_ACTION_LOCK_SCREEN)
            }
        }
    }

    override fun onServiceConnected() {
        super.onServiceConnected()
        val filter = IntentFilter("${PKG}.DOUBLE_TAP_LOCK")
        if (Build.VERSION.SDK_INT >= 33)
            registerReceiver(receiver, filter, Context.RECEIVER_NOT_EXPORTED)
        else
            registerReceiver(receiver, filter)
    }

    override fun onAccessibilityEvent(event: AccessibilityEvent?) {}
    override fun onInterrupt() {}
    override fun onDestroy() {
        try { unregisterReceiver(receiver) } catch (_: Throwable) {}
        super.onDestroy()
    }
}
`;

const MODULE_KT = `package ${PKG}.native

import android.content.Intent
import android.provider.Settings
import com.facebook.react.bridge.*

class RelaxAccessibilityModule(ctx: ReactApplicationContext) : ReactContextBaseJavaModule(ctx) {
    override fun getName() = "RelaxAccessibilityModule"

    @ReactMethod
    fun isEnabled(promise: Promise) {
        try {
            val enabled = Settings.Secure.getString(
                reactApplicationContext.contentResolver,
                Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES
            ) ?: ""
            promise.resolve(enabled.contains("DoubleTapLockService"))
        } catch (_: Throwable) { promise.resolve(false) }
    }

    @ReactMethod
    fun openAccessibilitySettings(promise: Promise) {
        try {
            val ctx = reactApplicationContext
            // Prefer the per-service "Installed services" detail page so the
            // user lands directly on our DoubleTapLockService toggle (req #4).
            // EXTRA_COMPONENT_NAME accepts a flattenToString of the component.
            val component = android.content.ComponentName(
                ctx.packageName,
                "\${ctx.packageName}.a11y.DoubleTapLockService"
            )
            val direct = Intent("android.settings.ACCESSIBILITY_DETAILS_SETTINGS").apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                putExtra(":settings:fragment_args_key", component.flattenToString())
                val args = android.os.Bundle()
                args.putString(":settings:fragment_args_key", component.flattenToString())
                putExtra(":settings:show_fragment_args", args)
            }
            val resolved = direct.resolveActivity(ctx.packageManager) != null
            if (resolved) {
                ctx.startActivity(direct)
            } else {
                // Fallback: Installed Services list (some OEMs).
                val list = Intent("com.android.settings.ACCESSIBILITY_INSTALLED_SERVICES_SETTINGS")
                    .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                if (list.resolveActivity(ctx.packageManager) != null) {
                    ctx.startActivity(list)
                } else {
                    val i = Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS)
                        .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                    ctx.startActivity(i)
                }
            }
            promise.resolve(true)
        } catch (t: Throwable) { promise.reject("A11Y_OPEN_FAIL", t) }
    }

    @ReactMethod fun addListener(n: String) {}
    @ReactMethod fun removeListeners(n: Int) {}
}
`;

// android:description / android:summary surface inside Settings >
// Accessibility so the user knows what the service does and why it
// needs to be enabled (req #4 — Google Play requires a clear
// rationale for accessibility usage).
const CONFIG_XML = `<?xml version="1.0" encoding="utf-8"?>
<accessibility-service xmlns:android="http://schemas.android.com/apk/res/android"
    android:accessibilityEventTypes="typeAllMask"
    android:accessibilityFeedbackType="feedbackGeneric"
    android:accessibilityFlags="flagDefault"
    android:notificationTimeout="100"
    android:canPerformGestures="true"
    android:description="@string/a11y_double_tap_description"
    android:summary="@string/a11y_double_tap_summary"
    android:canRetrieveWindowContent="false"/>
`;

const STRINGS_XML = `<?xml version="1.0" encoding="utf-8"?>
<resources xmlns:tools="http://schemas.android.com/tools" tools:ignore="MissingTranslation">
    <string name="a11y_double_tap_summary">Lock the screen by double-tapping the live wallpaper</string>
    <string name="a11y_double_tap_description">Relax Sound Live Wallpapers uses this Accessibility Service for a single purpose: when you double-tap the home screen, it performs the global "lock screen" action so the display turns off without using the power button. The service does not read screen content, does not track activity, and does not transmit any data. You can disable it at any time in Accessibility settings.</string>
</resources>
`;

const withA11yManifest = (config) =>
  withAndroidManifest(config, (config) => {
    const app = AndroidConfig.Manifest.getMainApplicationOrThrow(config.modResults);
    app["service"] = app["service"] || [];
    if (!app["service"].some((s) => s.$["android:name"] === ".a11y.DoubleTapLockService")) {
      app["service"].push({
        $: {
          "android:name": ".a11y.DoubleTapLockService",
          "android:exported": "true",
          "android:permission": "android.permission.BIND_ACCESSIBILITY_SERVICE"
        },
        "intent-filter": [
          { action: [{ $: { "android:name": "android.accessibilityservice.AccessibilityService" } }] }
        ],
        "meta-data": [
          {
            $: {
              "android:name": "android.accessibilityservice",
              "android:resource": "@xml/double_tap_lock_config"
            }
          }
        ]
      });
    }
    return config;
  });

const withA11yFiles = (config) =>
  withDangerousMod(config, [
    "android",
    async (config) => {
      const root = config.modRequest.projectRoot;
      writeNativeSource(root, "a11y/DoubleTapLockService.kt", SERVICE_KT);
      writeNativeSource(root, "native/RelaxAccessibilityModule.kt", MODULE_KT);
      writeResource(root, "xml/double_tap_lock_config.xml", CONFIG_XML);
      writeResource(root, "values/a11y_strings.xml", STRINGS_XML);
      return config;
    }
  ]);

module.exports = (config) => withA11yFiles(withA11yManifest(config));
