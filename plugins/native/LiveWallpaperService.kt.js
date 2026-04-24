exports.liveWallpaperServiceKt = (pkg) => `package ${pkg}.wallpaper

import android.service.wallpaper.WallpaperService
import android.util.Log

class RelaxWallpaperService : WallpaperService() {
    override fun onCreateEngine(): Engine {
        Log.i(TAG, "onCreateEngine")
        return RelaxWallpaperEngine(this)
    }
    companion object { const val TAG = "RelaxWallpaper" }
}
`;
