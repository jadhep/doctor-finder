import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Loader2, Phone, MapPin, ExternalLink, Download, Search, FileSpreadsheet } from "lucide-react";
import * as XLSX from "xlsx";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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

  const mutation = useMutation({
    mutationFn: async () => {
      const subAreas = subAreasText
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      return fn({
        data: {
          query: query.trim(),
          area: area.trim(),
          subAreas,
          maxPages: 2,
        },
      });
    },
  });

  const places = mutation.data?.places ?? [];
  const withPhone = useMemo(() => places.filter((p) => p.telepon).length, [places]);

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

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto max-w-5xl px-4 py-10">
        <header className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight">Pencari Kontak Praktek Dokter</h1>
          <p className="mt-2 text-muted-foreground">
            Cari nomor telepon & alamat dari Google Maps. Bisa untuk kota mana saja.
          </p>
        </header>

        <Card>
          <CardHeader>
            <CardTitle>Parameter Pencarian</CardTitle>
            <CardDescription>
              Atur kata kunci, area, dan sub-area (kecamatan) untuk memperluas cakupan.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="query">Kata kunci</Label>
                <Input
                  id="query"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Praktek Dokter Mandiri"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="area">Area / Kota</Label>
                <Input
                  id="area"
                  value={area}
                  onChange={(e) => setArea(e.target.value)}
                  placeholder="Depok"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="subareas">Sub-area (opsional, pisahkan dengan koma)</Label>
              <Input
                id="subareas"
                value={subAreasText}
                onChange={(e) => setSubAreasText(e.target.value)}
                placeholder="Beji, Pancoran Mas, ..."
              />
              <div className="flex flex-wrap gap-2 pt-1">
                <span className="text-xs text-muted-foreground self-center">Preset:</span>
                {Object.keys(PRESETS).map((k) => (
                  <Button
                    key={k}
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => applyPreset(k)}
                  >
                    {k}
                  </Button>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-3 pt-2">
              <Button
                onClick={() => mutation.mutate()}
                disabled={mutation.isPending || !query.trim() || !area.trim()}
              >
                {mutation.isPending ? (
                  <>
                    <Loader2 className="animate-spin" /> Mencari...
                  </>
                ) : (
                  <>
                    <Search /> Cari
                  </>
                )}
              </Button>
              {places.length > 0 && (
                <>
                  <Button variant="outline" onClick={downloadCsv}>
                    <Download /> CSV
                  </Button>
                  <Button variant="outline" onClick={downloadXlsx}>
                    <FileSpreadsheet /> Excel
                  </Button>
                </>
              )}
            </div>
            {mutation.isError && (
              <p className="text-sm text-destructive">
                Gagal: {(mutation.error as Error).message}
              </p>
            )}
          </CardContent>
        </Card>

        {places.length > 0 && (
          <div className="mt-8 space-y-4">
            <div className="flex items-baseline justify-between">
              <h2 className="text-xl font-semibold">Hasil ({places.length})</h2>
              <span className="text-sm text-muted-foreground">
                {withPhone} dengan nomor telepon
              </span>
            </div>
            <div className="grid gap-3">
              {places.map((p) => (
                <Card key={p.id}>
                  <CardContent className="p-4 space-y-2">
                    <div className="font-medium">{p.nama}</div>
                    {p.alamat && (
                      <div className="flex items-start gap-2 text-sm text-muted-foreground">
                        <MapPin className="mt-0.5 shrink-0" />
                        <span>{p.alamat}</span>
                      </div>
                    )}
                    <div className="flex flex-wrap gap-4 text-sm">
                      {p.telepon ? (
                        <a
                          href={`tel:${p.telepon.replace(/\s+/g, "")}`}
                          className="flex items-center gap-1 text-primary hover:underline"
                        >
                          <Phone /> {p.telepon}
                        </a>
                      ) : (
                        <span className="text-muted-foreground">Telepon tidak tersedia</span>
                      )}
                      {p.website && (
                        <a
                          href={p.website}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-1 text-primary hover:underline"
                        >
                          <ExternalLink /> Website
                        </a>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {!mutation.isPending && mutation.isSuccess && places.length === 0 && (
          <p className="mt-8 text-center text-muted-foreground">
            Tidak ada hasil. Coba ubah kata kunci atau area.
          </p>
        )}
      </div>
    </div>
  );
}
