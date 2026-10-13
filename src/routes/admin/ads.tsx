import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button, fieldClass } from "@/components/ui";
import { adminListAds, deleteAd, saveAd } from "@/server/admin";

export const Route = createFileRoute("/admin/ads")({
  component: AdsAdmin,
});

type Ad = {
  id: number;
  name: string;
  provider: string;
  code: string;
  placement: string;
  frequency: string;
  every_n: number;
  is_enabled: boolean;
};

const blank = { name: "", provider: "adsense", code: "", placement: "footer", frequency: "always", everyN: 1, isEnabled: true };

function AdsAdmin() {
  const [rows, setRows] = useState<Ad[]>([]);
  const [form, setForm] = useState<typeof blank & { id?: number } | null>(null);
  const [error, setError] = useState("");

  async function load() {
    const result = await adminListAds();
    if (result.ok) setRows(result.ads as Ad[]);
  }
  useEffect(() => { void load(); }, []);

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <h1 className="font-display text-4xl">Ads</h1>
        <Button type="button" onClick={() => setForm(blank)}>Add</Button>
      </div>
      <p className="mt-2 max-w-xl text-sm text-muted">Free plans see a labeled slot. Paid plans see nothing. Codes are stored as text and are not injected into the page, so a bad snippet cannot run in a student's browser.</p>
      {error ? <p className="mt-3 text-sm text-accent">{error}</p> : null}
      <ul className="mt-4 flex flex-col gap-2">
        {rows.map((row) => (
          <li key={row.id} className="rounded-2xl border border-border p-4 text-sm">
            <p className="font-medium">{row.name} · {row.placement} · {row.is_enabled ? "On" : "Off"}</p>
            <p className="text-muted">{row.provider} · {row.frequency}{row.frequency === "every_n" ? ` / ${row.every_n}` : ""}</p>
            {row.code ? <pre className="mt-2 overflow-x-auto rounded-xl bg-bg p-3 text-xs">{row.code}</pre> : null}
            <div className="mt-3 flex gap-2">
              <Button type="button" variant="ghost" onClick={() => setForm({
                id: row.id, name: row.name, provider: row.provider, code: row.code, placement: row.placement,
                frequency: row.frequency, everyN: row.every_n, isEnabled: row.is_enabled,
              })}>Edit</Button>
              <Button type="button" variant="ghost" onClick={() => void saveAd({ data: {
                id: row.id, name: row.name, provider: row.provider, code: row.code, placement: row.placement,
                frequency: row.frequency, everyN: row.every_n, isEnabled: !row.is_enabled,
              } }).then(load)}>{row.is_enabled ? "Disable" : "Enable"}</Button>
              <Button type="button" variant="danger" onClick={() => void deleteAd({ data: row.id }).then(load)}>Delete</Button>
            </div>
          </li>
        ))}
      </ul>
      {form ? (
        <form className="mt-6 grid max-w-lg gap-3" onSubmit={(event) => {
          event.preventDefault();
          void saveAd({ data: form }).then((result) => {
            if (!result.ok) setError(result.error);
            else { setForm(null); void load(); }
          }).catch((err: unknown) => setError(err instanceof Error ? err.message : "Could not save"));
        }}>
          <input className={fieldClass} placeholder="Name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
          <select className={fieldClass} value={form.provider} onChange={(event) => setForm({ ...form, provider: event.target.value })}>
            <option value="adsense">AdSense</option>
            <option value="admob">AdMob (stored for a future app)</option>
            <option value="custom_html">Custom HTML (stored, not executed)</option>
          </select>
          <textarea className={fieldClass} rows={4} placeholder="Code, stored as text" value={form.code} onChange={(event) => setForm({ ...form, code: event.target.value })} />
          <select className={fieldClass} value={form.placement} onChange={(event) => setForm({ ...form, placement: event.target.value })}>
            {["header", "sidebar", "in_content", "below_video", "footer"].map((p) => <option key={p}>{p}</option>)}
          </select>
          <select className={fieldClass} value={form.frequency} onChange={(event) => setForm({ ...form, frequency: event.target.value })}>
            <option value="always">Always</option>
            <option value="every_n">Every N views</option>
          </select>
          <input className={fieldClass} type="number" min={1} value={form.everyN} onChange={(event) => setForm({ ...form, everyN: Number(event.target.value) })} />
          <label className="flex min-h-11 items-center gap-2 text-sm">
            <input type="checkbox" checked={form.isEnabled} onChange={(event) => setForm({ ...form, isEnabled: event.target.checked })} />
            Enabled
          </label>
          <div className="flex gap-2">
            <Button type="submit">Save</Button>
            <Button type="button" variant="ghost" onClick={() => setForm(null)}>Cancel</Button>
          </div>
        </form>
      ) : null}
    </div>
  );
}
