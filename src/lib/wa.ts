export function normalizeWaNumber(tel: string): string | null {
  let d = tel.replace(/\D/g, "");
  if (d.startsWith("0")) d = "62" + d.slice(1);
  return d.startsWith("62") && d.length >= 10 ? d : null;
}

export function waLink(tel: string, text?: string): string | null {
  const d = normalizeWaNumber(tel);
  if (!d) return null;
  return `https://wa.me/${d}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
}


export function fillTemplate(tpl: string, vars: Record<string, string>): string {
  return tpl.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m));
}

export const DEFAULT_TEMPLATE =
  "Halo {nama},\nSaya mendapatkan kontak Anda dari Google Maps ({alamat}).\nApakah saat ini menerima konsultasi? Terima kasih.";
