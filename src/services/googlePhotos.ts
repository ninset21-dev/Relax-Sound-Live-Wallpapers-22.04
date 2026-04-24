/**
 * Best-effort scraper for a public Google Photos shared album.
 * Google does not expose an official read-only API for shared URLs;
 * we extract direct image URLs from the public HTML.
 * NOTE: Google may change their page markup or block scraping; we fall back
 * to returning an empty list and surface a friendly message in the UI.
 */

const SHARED_URL = "https://photos.app.goo.gl/E8frgv5QyePtvHZr5";

export async function fetchGooglePhotosAlbum(url = SHARED_URL): Promise<string[]> {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36"
      }
    });
    const html = await res.text();
    // Google Photos embeds direct image URLs in lh3.googleusercontent.com form
    const re = /"(https:\/\/lh3\.googleusercontent\.com\/[^"]+?)"/g;
    const set = new Set<string>();
    let m: RegExpExecArray | null;
    while ((m = re.exec(html))) {
      let u = m[1];
      // Strip size suffix so we can request highres
      u = u.replace(/=w\d+-h\d+(-[a-z0-9-]+)?$/i, "=w2048-h2048-no");
      set.add(u);
    }
    return Array.from(set).slice(0, 60);
  } catch {
    return [];
  }
}
