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
            val i = Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS)
            i.flags = Intent.FLAG_ACTIVITY_NEW_TASK
            reactApplicationContext.startActivity(i)
            promise.resolve(true)
        } catch (t: Throwable) { promise.reject("A11Y_OPEN_FAIL", t) }
    }

    @ReactMethod fun addListener(n: String) {}
    @ReactMethod fun removeListeners(n: Int) {}
}
`;

const CONFIG_XML = `<?xml version="1.0" encoding="utf-8"?>
<accessibility-service xmlns:android="http://schemas.android.com/apk/res/android"
    android:accessibilityEventTypes="typeAllMask"
    android:accessibilityFeedbackType="feedbackGeneric"
    android:accessibilityFlags="flagDefault"
    android:notificationTimeout="100"
    android:canPerformGestures="true"
    android:canRetrieveWindowContent="false"/>
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
      return config;
    }
  ]);

module.exports = (config) => withA11yFiles(withA11yManifest(config));
