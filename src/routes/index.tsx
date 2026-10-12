import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Loader2, Phone, MapPin, ExternalLink, Download, Search, FileSpreadsheet, Stethoscope, Copy, Check, MessageCircle, Map as MapIcon, Building2, Activity, History, X, Trash2 } from "lucide-react";
import * as XLSX from "xlsx";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { searchPlaces, type Place } from "@/lib/places.functions";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Pencari Kontak Praktek Dokter — Google Maps" },
      {
        name: "description",
        content:
          "Cari nomor telepon & alamat Praktek Dokter Mandiri di kota mana pun dari Google Maps, lalu export ke CSV.",
      },
      { property: "og:title", content: "Pencari Kontak Praktek Dokter & Klinik" },
      { property: "og:description", content: "Direktori kontak fasilitas kesehatan dari Google Maps, ekspor ke Excel/CSV." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Index,
});

const PRESETS: Record<string, string[]> = {
  Depok: [
    "Beji", "Pancoran Mas", "Cipayung", "Sukmajaya", "Cilodong",
    "Cimanggis", "Tapos", "Sawangan", "Bojongsari", "Limo", "Cinere",
  ],
  Jakarta: [
    "Jakarta Pusat", "Jakarta Utara", "Jakarta Barat", "Jakarta Selatan", "Jakarta Timur",
  ],
  Bandung: ["Coblong", "Cidadap", "Sukajadi", "Cicendo", "Bandung Wetan", "Lengkong", "Antapani"],
  Bogor: ["Bogor Tengah", "Bogor Utara", "Bogor Selatan", "Bogor Timur", "Bogor Barat", "Tanah Sareal"],
};

const KEYWORDS = ["Praktek Dokter Mandiri", "Klinik Pratama", "Klinik 24 Jam", "Dokter Gigi", "Bidan Praktek Mandiri", "Apotek"];

const HISTORY_KEY = "faskes_search_history";
const MAX_HISTORY = 8;

interface HistoryItem {
  query: string;
  area: string;
  subAreas: string;
  ts: number;
}

function loadHistory(): HistoryItem[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.filter((h) => h && h.query && h.area) : [];
  } catch {
    return [];
  }
}

function waLink(tel: string) {
  let d = tel.replace(/\D/g, "");
  if (d.startsWith("0")) d = "62" + d.slice(1);
  return d.startsWith("62") && d.length >= 10 ? `https://wa.me/${d}` : null;
}

function PlaceCard({ p }: { p: Place }) {
  const [copied, setCopied] = useState(false);
  const wa = p.telepon ? waLink(p.telepon) : null;
  const copy = async () => {
    await navigator.clipboard.writeText(p.telepon);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  const maps = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(p.nama + " " + p.alamat)}&query_place_id=${p.id}`;
  return (
    <div className="group rounded-xl border border-border bg-card p-4 transition-shadow hover:shadow-soft">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-secondary text-primary">
            <Building2 className="size-5" />
          </div>
          <div className="min-w-0">
            <div className="font-semibold leading-snug">{p.nama}</div>
            {p.alamat && (
              <div className="mt-1 flex items-start gap-1.5 text-sm text-muted-foreground">
                <MapPin className="mt-0.5 size-3.5 shrink-0" />
                <span>{p.alamat}</span>
              </div>
            )}
          </div>
        </div>
        {p.telepon ? (
          <span className="shrink-0 rounded-full bg-success-soft px-2.5 py-0.5 text-xs font-medium text-success">Ada Kontak</span>
        ) : (
          <span className="shrink-0 rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">Tanpa Telepon</span>
        )}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2 pl-13">
        {p.telepon && (
          <>
            <a href={`tel:${p.telepon.replace(/\s+/g, "")}`} className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90">
              <Phone className="size-3.5" /> {p.telepon}
            </a>
            <Button size="sm" variant="outline" onClick={copy}>
              {copied ? <><Check className="text-success" /> Tersalin!</> : <><Copy /> Salin</>}
            </Button>
            {wa && (
              <Button size="sm" variant="outline" asChild>
                <a href={wa} target="_blank" rel="noreferrer"><MessageCircle className="text-success" /> WhatsApp</a>
              </Button>
            )}
          </>
        )}
        <Button size="sm" variant="ghost" asChild>
          <a href={maps} target="_blank" rel="noreferrer"><MapIcon /> Maps</a>
        </Button>
        {p.website && (
          <Button size="sm" variant="ghost" asChild>
            <a href={p.website} target="_blank" rel="noreferrer"><ExternalLink /> Website</a>
          </Button>
        )}
      </div>
    </div>
  );
}

function toCsv(rows: Place[]): string {
  const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const head = ["Nama", "Alamat", "Telepon", "Website"].map(esc).join(",");
  const body = rows.map((r) => [r.nama, r.alamat, r.telepon, r.website].map(esc).join(","));
  return [head, ...body].join("\n");
}

function Index() {
  const fn = useServerFn(searchPlaces);
  const [query, setQuery] = useState("Praktek Dokter Mandiri");
  const [area, setArea] = useState("Depok");
  const [subAreasText, setSubAreasText] = useState(PRESETS.Depok.join(", "));
  const [history, setHistory] = useState<HistoryItem[]>([]);

  useEffect(() => {
    setHistory(loadHistory());
  }, []);

  const saveHistory = (item: Omit<HistoryItem, "ts">) => {
    const next: HistoryItem[] = [
      { ...item, ts: Date.now() },
      ...history.filter((h) => !(h.query === item.query && h.area === item.area)),
    ].slice(0, MAX_HISTORY);
    setHistory(next);
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
    } catch {
      // storage penuh / privat — abaikan
    }
  };

  const removeHistory = (h: HistoryItem) => {
    const next = history.filter((x) => x.ts !== h.ts);
    setHistory(next);
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
    } catch {
      // abaikan
    }
  };

  const clearHistory = () => {
    setHistory([]);
    try {
      localStorage.removeItem(HISTORY_KEY);
    } catch {
      // abaikan
    }
  };

  const mutation = useMutation({
    mutationFn: async (input?: { query: string; area: string; subAreasText: string }) => {
      const q = (input?.query ?? query).trim();
      const a = (input?.area ?? area).trim();
      const s = input?.subAreasText ?? subAreasText;
      const subAreas = s
        .split(",")
        .map((x) => x.trim())
        .filter(Boolean);
      const result = await fn({
        data: {
          query: q,
          area: a,
          subAreas,
          maxPages: 2,
        },
      });
      saveHistory({ query: q, area: a, subAreas: s });
      return result;
    },
  });

  const runFromHistory = (h: HistoryItem) => {
    setQuery(h.query);
    setArea(h.area);
    setSubAreasText(h.subAreas);
    mutation.mutate({ query: h.query, area: h.area, subAreasText: h.subAreas });
  };

  const places = mutation.data?.places ?? [];
  const withPhone = useMemo(() => places.filter((p) => p.telepon).length, [places]);
  const [onlyPhone, setOnlyPhone] = useState(false);
  const shown = useMemo(() => (onlyPhone ? places.filter((p) => p.telepon) : places), [places, onlyPhone]);

  const applyPreset = (key: string) => {
    setArea(key);
    setSubAreasText(PRESETS[key].join(", "));
  };

  const fileBase = () => `kontak_${area.toLowerCase().replace(/\s+/g, "_") || "hasil"}`;

  const downloadCsv = () => {
    const blob = new Blob([toCsv(places)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${fileBase()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadXlsx = () => {
    const rows = places.map((p) => ({
      Nama: p.nama,
      Alamat: p.alamat,
      Telepon: p.telepon,
    }));
    const ws = XLSX.utils.json_to_sheet(rows, { header: ["Nama", "Alamat", "Telepon"] });
    ws["!cols"] = [{ wch: 40 }, { wch: 60 }, { wch: 20 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Kontak");
    XLSX.writeFile(wb, `${fileBase()}.xlsx`);
  };

  const pill = (active: boolean) =>
    `rounded-full border px-3 py-1 text-sm transition-colors ${active ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-foreground hover:border-primary hover:text-primary"}`;

  return (
    <div className="min-h-screen bg-background">
      <section className="bg-hero text-primary-foreground">
        <div className="container mx-auto max-w-5xl px-4 pb-24 pt-10">
          <div className="flex items-center gap-2 text-sm font-medium opacity-90">
            <span className="grid size-8 place-items-center rounded-lg bg-primary-foreground/15"><Stethoscope className="size-4" /></span>
            Direktori Faskes
            <span className="ml-2 inline-flex items-center gap-1.5 rounded-full bg-primary-foreground/15 px-2.5 py-0.5 text-xs">
              <span className="size-1.5 rounded-full bg-primary-foreground" /> Google Maps aktif
            </span>
          </div>
          <h1 className="mt-6 text-3xl font-bold tracking-tight md:text-4xl">Cari Kontak Praktek Dokter & Klinik</h1>
          <p className="mt-2 max-w-2xl opacity-90">Temukan nomor telepon & alamat fasilitas kesehatan di kota mana pun, lalu hubungi atau ekspor dalam hitungan detik.</p>
          <div className="mt-4 flex flex-wrap gap-2 text-xs opacity-90">
            <span className="rounded-full bg-primary-foreground/15 px-2.5 py-1">1. Cari di Maps</span>
            <span className="rounded-full bg-primary-foreground/15 px-2.5 py-1">2. Filter Kontak</span>
            <span className="rounded-full bg-primary-foreground/15 px-2.5 py-1">3. Ekspor Excel/CSV</span>
          </div>
        </div>
      </section>

      <div className="container mx-auto -mt-16 max-w-5xl px-4 pb-12">
        <div className="rounded-2xl border border-border bg-card p-5 shadow-soft md:p-6 space-y-5">
          <div className="space-y-2">
            <Label htmlFor="query">Jenis fasilitas / kata kunci</Label>
            <Input id="query" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Praktek Dokter Mandiri" />
            <div className="flex flex-wrap gap-2 pt-1">
              {KEYWORDS.map((k) => (
                <button key={k} type="button" className={pill(query === k)} onClick={() => setQuery(k)}>{k}</button>
              ))}
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="area">Kota</Label>
              <Input id="area" value={area} onChange={(e) => setArea(e.target.value)} placeholder="Depok" />
              <div className="flex flex-wrap gap-2 pt-1">
                {Object.keys(PRESETS).map((k) => (
                  <button key={k} type="button" className={pill(area === k)} onClick={() => applyPreset(k)}>{k}</button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="subareas">Kecamatan (opsional, pisahkan koma)</Label>
              <Input id="subareas" value={subAreasText} onChange={(e) => setSubAreasText(e.target.value)} placeholder="Beji, Pancoran Mas, ..." />
              <p className="text-xs text-muted-foreground">Lebih banyak kecamatan = cakupan lebih luas, waktu lebih lama.</p>
            </div>
          </div>
          <Button size="lg" className="w-full md:w-auto" onClick={() => mutation.mutate()} disabled={mutation.isPending || !query.trim() || !area.trim()}>
            {mutation.isPending ? <><Loader2 className="animate-spin" /> Mencari fasilitas...</> : <><Search /> Cari Kontak</>}
          </Button>
          {mutation.isError && <p className="text-sm text-destructive">Gagal: {(mutation.error as Error).message}</p>}
        </div>

        {mutation.isPending && (
          <div className="mt-8 grid gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-28 animate-pulse rounded-xl border border-border bg-card p-4">
                <div className="h-4 w-1/3 rounded bg-muted" />
                <div className="mt-3 h-3 w-2/3 rounded bg-muted" />
                <div className="mt-4 h-7 w-40 rounded bg-muted" />
              </div>
            ))}
          </div>
        )}

        {!mutation.isPending && places.length > 0 && (
          <div className="mt-8 space-y-4">
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: "Faskes ditemukan", value: places.length, icon: Building2 },
                { label: "Punya telepon", value: withPhone, icon: Phone },
                { label: "Ketersediaan kontak", value: `${Math.round((withPhone / places.length) * 100)}%`, icon: Activity },
              ].map((s) => (
                <div key={s.label} className="rounded-xl border border-border bg-card p-4">
                  <s.icon className="size-4 text-primary" />
                  <div className="mt-2 text-2xl font-bold">{s.value}</div>
                  <div className="text-xs text-muted-foreground">{s.label}</div>
                </div>
              ))}
            </div>
            <div className="sticky top-0 z-10 -mx-4 flex flex-wrap items-center justify-between gap-3 border-b border-border bg-background/90 px-4 py-3 backdrop-blur">
              <div className="flex gap-2">
                <button className={pill(!onlyPhone)} onClick={() => setOnlyPhone(false)}>Semua ({places.length})</button>
                <button className={pill(onlyPhone)} onClick={() => setOnlyPhone(true)}>Ada Telepon ({withPhone})</button>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={downloadCsv}><Download /> CSV</Button>
                <Button size="sm" onClick={downloadXlsx}><FileSpreadsheet /> Excel</Button>
              </div>
            </div>
            <div className="grid gap-3">
              {shown.map((p) => <PlaceCard key={p.id} p={p} />)}
            </div>
          </div>
        )}

        {!mutation.isPending && mutation.isSuccess && places.length === 0 && (
          <p className="mt-8 text-center text-muted-foreground">Tidak ada hasil. Coba ubah kata kunci atau kota.</p>
        )}
      </div>
    </div>
  );
}
