import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button, fieldClass } from "@/components/ui";
import { adminListVideos, bulkVideos, checkVideoLinks, setVideoPermission } from "@/server/admin";

export const Route = createFileRoute("/admin/videos")({
  component: VideosAdmin,
});

type Video = {
  id: number;
  youtube_id: string;
  title_en: string;
  channel_name: string;
  thumbnail_url: string;
  permission_status: string;
  link_status: string;
  lesson_count: number;
};

function VideosAdmin() {
  const [rows, setRows] = useState<Video[]>([]);
  const [bulk, setBulk] = useState("");
  const [note, setNote] = useState("");

  async function load() {
    const result = await adminListVideos();
    if (result.ok) setRows(result.videos as Video[]);
  }
  useEffect(() => { void load(); }, []);

  return (
    <div>
      <h1 className="font-display text-4xl">Videos</h1>
      <p className="mt-2 max-w-xl text-sm text-muted">Paste one or many YouTube links. Duplicates are the same video id. Broken means oEmbed no longer answers.</p>
      <textarea className={`${fieldClass} mt-4`} rows={4} value={bulk} onChange={(event) => setBulk(event.target.value)} placeholder="One URL per line" />
      <div className="mt-3 flex flex-wrap gap-2">
        <Button type="button" onClick={() => void bulkVideos({ data: bulk }).then((result) => {
          if (result.ok) setNote(`Added ${result.added}, duplicates ${result.duplicates}, unreadable ${result.bad}`);
          setBulk("");
          return load();
        })}>Import</Button>
        <Button type="button" variant="ghost" onClick={() => void checkVideoLinks().then((result) => {
          if (result.ok) setNote(`Checked. OK ${result.okCount}, broken ${result.broken}.`);
          return load();
        })}>Check links</Button>
      </div>
      {note ? <p className="mt-3 text-sm text-primary">{note}</p> : null}
      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {rows.map((video) => (
          <article key={video.id} className="overflow-hidden rounded-2xl border border-border bg-surface">
            {video.thumbnail_url ? <img src={video.thumbnail_url} alt="" className="aspect-video w-full object-cover" /> : null}
            <div className="p-3 text-sm">
              <p className="font-medium">{video.title_en}</p>
              <p className="text-muted">{video.channel_name || "Channel unknown"} · {video.lesson_count} lessons</p>
              <p className="mt-1">Link: {video.link_status}</p>
              <label className="mt-2 block">Permission
                <select className={`${fieldClass} mt-1`} value={video.permission_status} onChange={(event) => void setVideoPermission({ data: { id: video.id, status: event.target.value } }).then(load)}>
                  <option value="unknown">Unknown</option>
                  <option value="pending">Pending</option>
                  <option value="granted">Granted</option>
                  <option value="denied">Denied</option>
                </select>
              </label>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
