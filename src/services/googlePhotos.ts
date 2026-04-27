/**
 * Best-effort scraper for a public Google Photos shared album.
 *
 * The shared page embeds direct image URLs on lh3.googleusercontent.com.
 * Google Photos URLs accept size modifiers like `=w400-h400-no` that make the
 * CDN deliver a fast thumbnail instead of the full-resolution original. We
 * return BOTH a small thumbnail URL (for grid previews — keeps scroll at
 * 60 FPS even on 60+ tiles) and the full-size URL (used only when the user
 * actually imports a photo into their wallpaper set).
 *
 * The previous implementation rewrote every URL to `=w2048-h2048-no`, which
 * caused the home screen to decode multi-megabyte images per tile and was the
 * source of the reported "main screen lags" bug.
 *
 * Google may change their page markup or block scraping; we fall back to
 * returning an empty list and surface a friendly message in the UI.
 */

export interface GPhoto {
  /** 300×300 thumbnail — used for grid tiles. */
  thumb: string;
  /** Up to 2048×2048 original, downloaded only when the user imports. */
  full: string;
}

const SHARED_URL = "https://photos.app.goo.gl/E8frgv5QyePtvHZr5";

function withSize(url: string, size: string): string {
  // Strip any existing size params and append the requested ones.
  return url.replace(/=w\d+-h\d+(-[a-z0-9-]+)?$/i, "") + "=" + size;
}

export async function fetchGooglePhotosAlbum(url = SHARED_URL): Promise<GPhoto[]> {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36"
      }
    });
    const html = await res.text();
    const re = /"(https:\/\/lh3\.googleusercontent\.com\/[^"]+?)"/g;
    const set = new Set<string>();
    let m: RegExpExecArray | null;
    while ((m = re.exec(html))) {
      // Normalise by stripping any existing size modifier so the de-dupe
      // Set does not keep different-sized variants of the same image.
      const bare = m[1].replace(/=w\d+-h\d+(-[a-z0-9-]+)?$/i, "");
      set.add(bare);
    }
    return Array.from(set)
      .slice(0, 120)
      .map((u) => ({
        thumb: withSize(u, "w400-h400-no"),
        full: withSize(u, "w2048-h2048-no")
      }));
  } catch {
    return [];
  }
}
