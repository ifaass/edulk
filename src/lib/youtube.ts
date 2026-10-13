const ID = /^[\w-]{11}$/;

function take(value: string | null | undefined): string | null {
  if (!value) return null;
  const id = value.slice(0, 11);
  return ID.test(id) ? id : null;
}

/** Accepts a raw 11-character id or any common YouTube URL. */
export function parseYouTubeId(input: string): string | null {
  const raw = input.trim();
  if (!raw) return null;
  if (ID.test(raw)) return raw;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  const host = url.hostname.replace(/^www\./, "").replace(/^m\./, "");
  if (host === "youtu.be") {
    return take(url.pathname.split("/").filter(Boolean)[0]);
  }
  if (
    host === "youtube.com" ||
    host === "youtube-nocookie.com" ||
    host === "music.youtube.com"
  ) {
    const fromQuery = take(url.searchParams.get("v"));
    if (fromQuery) return fromQuery;
    const parts = url.pathname.split("/").filter(Boolean);
    const markers = new Set(["embed", "shorts", "live", "v"]);
    for (let i = 0; i < parts.length; i += 1) {
      if (markers.has(parts[i] ?? "")) return take(parts[i + 1]);
    }
  }
  return null;
}

export function thumbnailUrl(id: string): string {
  return `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
}

export function watchUrl(id: string): string {
  return `https://www.youtube.com/watch?v=${id}`;
}
