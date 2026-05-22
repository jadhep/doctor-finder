#!/usr/bin/env python3
"""
Scrape kontak Praktek Dokter Mandiri di Depok via Google Maps Platform
(Places API New) lewat Lovable connector gateway.

Output: /mnt/documents/dokter_depok.csv
"""
import csv
import json
import os
import sys
import time
import urllib.request
import urllib.error

GATEWAY = "https://connector-gateway.lovable.dev/google_maps/places/v1/places:searchText"
LOVABLE_API_KEY = os.environ.get("LOVABLE_API_KEY")
GOOGLE_MAPS_API_KEY = os.environ.get("GOOGLE_MAPS_API_KEY")

if not LOVABLE_API_KEY:
    sys.exit("LOVABLE_API_KEY is not configured")
if not GOOGLE_MAPS_API_KEY:
    sys.exit("GOOGLE_MAPS_API_KEY is not configured")

AREA = "Depok"
KECAMATAN = [
    "Beji", "Pancoran Mas", "Cipayung", "Sukmajaya", "Cilodong",
    "Cimanggis", "Tapos", "Sawangan", "Bojongsari", "Limo", "Cinere",
]
QUERIES = [f"Praktek Dokter Mandiri {AREA}"] + [
    f"Praktek Dokter Mandiri {k} {AREA}" for k in KECAMATAN
] + [f"Dokter praktek pribadi {k} {AREA}" for k in KECAMATAN]

FIELD_MASK = (
    "places.id,places.displayName,places.formattedAddress,"
    "places.nationalPhoneNumber,places.internationalPhoneNumber,"
    "nextPageToken"
)


def search_text(query: str, page_token: str | None = None) -> dict:
    body = {"textQuery": query, "languageCode": "id", "regionCode": "ID"}
    if page_token:
        body["pageToken"] = page_token
    req = urllib.request.Request(
        GATEWAY,
        data=json.dumps(body).encode("utf-8"),
        method="POST",
        headers={
            "Authorization": f"Bearer {LOVABLE_API_KEY}",
            "X-Connection-Api-Key": GOOGLE_MAPS_API_KEY,
            "Content-Type": "application/json",
            "X-Goog-FieldMask": FIELD_MASK,
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        body_text = e.read().decode("utf-8", errors="replace")
        raise SystemExit(f"Places API error [{e.code}]: {body_text}")


def collect():
    results: dict[str, dict] = {}
    for q in QUERIES:
        print(f"[query] {q}")
        token = None
        for page in range(3):  # Google caps at ~60 results (3 pages of 20)
            data = search_text(q, token)
            places = data.get("places", []) or []
            for p in places:
                pid = p.get("id")
                if not pid or pid in results:
                    continue
                name = (p.get("displayName") or {}).get("text", "")
                addr = p.get("formattedAddress", "")
                phone = p.get("nationalPhoneNumber") or p.get("internationalPhoneNumber") or ""
                # Filter ringan: hanya tampung yg relevan dengan praktek dokter
                low = name.lower()
                if not any(k in low for k in ("dokter", "dr.", "dr ", "klinik", "praktek", "praktik")):
                    continue
                results[pid] = {"Nama": name, "Alamat": addr, "Telepon": phone}
            token = data.get("nextPageToken")
            if not token:
                break
            time.sleep(2)  # required delay before nextPageToken is valid
    return list(results.values())


def main():
    rows = collect()
    out_path = "/mnt/documents/dokter_depok.csv"
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    with open(out_path, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=["Nama", "Alamat", "Telepon"])
        w.writeheader()
        w.writerows(rows)
    with_phone = sum(1 for r in rows if r["Telepon"])
    print(f"\nTotal: {len(rows)} tempat, {with_phone} memiliki nomor telepon")
    print(f"CSV: {out_path}")


if __name__ == "__main__":
    main()
