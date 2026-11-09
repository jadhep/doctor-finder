import { useEffect, useState } from "react";
import { Check, MessageCircle, Send, RotateCcw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Place } from "@/lib/places.functions";
import { DEFAULT_TEMPLATE, fillTemplate, waLink } from "@/lib/wa";

const TPL_KEY = "faskes_wa_template";

interface Props {
  contacts: Place[];
  area: string;
  onClose: () => void;
}

export function BroadcastPanel({ contacts, area, onClose }: Props) {
  const [tpl, setTpl] = useState(DEFAULT_TEMPLATE);
  const [sent, setSent] = useState<Set<string>>(new Set());

  useEffect(() => {
    const saved = localStorage.getItem(TPL_KEY);
    if (saved) setTpl(saved);
  }, []);

  const updateTpl = (v: string) => {
    setTpl(v);
    try {
      localStorage.setItem(TPL_KEY, v);
    } catch {
      // abaikan
    }
  };

  const linkFor = (p: Place) => waLink(p.telepon, fillTemplate(tpl, { nama: p.nama, alamat: p.alamat, kota: area }));
  const open = (p: Place) => {
    const url = linkFor(p);
    if (!url) return;
    window.open(url, "_blank", "noopener");
    setSent((s) => new Set(s).add(p.id));
  };
  const next = contacts.find((p) => !sent.has(p.id));
  const done = sent.size;

  return (
    <div className="rounded-2xl border border-primary/30 bg-card p-5 shadow-soft space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 font-semibold"><MessageCircle className="size-4 text-success" /> Kirim Pesan WhatsApp</div>
          <p className="text-sm text-muted-foreground">{done} dari {contacts.length} kontak sudah dibuka</p>
        </div>
        <Button size="icon" variant="ghost" onClick={onClose} aria-label="Tutup"><X /></Button>
      </div>

      <div className="space-y-2">
        <textarea
          value={tpl}
          onChange={(e) => updateTpl(e.target.value)}
          rows={4}
          className="w-full rounded-md border border-input bg-background p-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="text-muted-foreground">Sisipkan:</span>
          {["nama", "alamat", "kota"].map((v) => (
            <button key={v} type="button" onClick={() => updateTpl(tpl + `{${v}}`)} className="rounded-full border border-border px-2 py-0.5 hover:border-primary hover:text-primary">
              {`{${v}}`}
            </button>
          ))}
          <button type="button" onClick={() => updateTpl(DEFAULT_TEMPLATE)} className="ml-auto inline-flex items-center gap-1 text-muted-foreground hover:text-primary">
            <RotateCcw className="size-3" /> Template awal
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button onClick={() => next && open(next)} disabled={!next}>
          <Send /> {next ? `Buka WhatsApp: ${next.nama.slice(0, 30)}` : "Semua selesai"}
        </Button>
        {done > 0 && <Button variant="outline" onClick={() => setSent(new Set())}><RotateCcw /> Ulangi</Button>}
      </div>

      <div className="max-h-64 space-y-1 overflow-y-auto">
        {contacts.map((p) => (
          <div key={p.id} className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted">
            <span className="flex min-w-0 items-center gap-2">
              {sent.has(p.id) ? <Check className="size-4 shrink-0 text-success" /> : <span className="size-4 shrink-0 rounded-full border border-border" />}
              <span className="truncate">{p.nama}</span>
            </span>
            <button type="button" onClick={() => open(p)} className="shrink-0 text-xs text-primary hover:underline">
              {sent.has(p.id) ? "Buka lagi" : "Kirim"}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
