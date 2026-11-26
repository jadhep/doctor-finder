import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { isAccountApproved } from "@/lib/account-access";

const GATEWAY = "https://connector-gateway.lovable.dev/google_maps/places/v1/places:searchText";

const FIELD_MASK = [
  "places.id",
  "places.displayName",
  "places.formattedAddress",
  "places.nationalPhoneNumber",
  "places.internationalPhoneNumber",
  "places.websiteUri",
  "nextPageToken",
].join(",");

const InputSchema = z.object({
  query: z.string().min(2).max(200),
  area: z.string().min(2).max(100),
  subAreas: z.array(z.string().min(1).max(100)).max(30).default([]),
  maxPages: z.number().int().min(1).max(3).default(2),
  refresh: z.boolean().default(false),
});

const CACHE_DAYS = 30;

export type Place = {
  id: string;
  nama: string;
  alamat: string;
  telepon: string;
  website: string;
};

async function searchText(body: Record<string, unknown>, keys: { lovable: string; gmaps: string }) {
  const res = await fetch(GATEWAY, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${keys.lovable}`,
      "X-Connection-Api-Key": keys.gmaps,
      "Content-Type": "application/json",
      "X-Goog-FieldMask": FIELD_MASK,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Places API ${res.status}: ${t.slice(0, 300)}`);
  }
  return (await res.json()) as {
    places?: Array<{
      id?: string;
      displayName?: { text?: string };
      formattedAddress?: string;
      nationalPhoneNumber?: string;
      internationalPhoneNumber?: string;
      websiteUri?: string;
    }>;
    nextPageToken?: string;
  };
}

export const searchPlaces = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => InputSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { data: account, error: accessError } = await context.supabase
      .from("account_access")
      .select("status")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (accessError || !account || !isAccountApproved(account.status)) {
      throw new Error("Account approval is required to search.");
    }

    const lovable = process.env.LOVABLE_API_KEY;
    const gmaps = process.env.GOOGLE_MAPS_API_KEY;
    const norm = (x: string) => x.trim().toLowerCase().replace(/\s+/g, " ");
    const cacheKey = [
      norm(data.query),
      norm(data.area),
      data.subAreas.map(norm).sort().join(","),
      data.maxPages,
    ].join("|");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (!data.refresh) {
      const { data: row } = await supabaseAdmin
        .from("places_cache")
        .select("places, created_at")
        .eq("cache_key", cacheKey)
        .maybeSingle();
      if (row && Date.now() - new Date(row.created_at).getTime() < CACHE_DAYS * 864e5) {
        return { places: row.places as unknown as Place[], cached: true, cachedAt: row.created_at };
      }
    }

    if (!lovable) throw new Error("LOVABLE_API_KEY is not configured");
    if (!gmaps) throw new Error("GOOGLE_MAPS_API_KEY is not configured");

    const queries = data.subAreas.length
      ? data.subAreas.map((s) => `${data.query} ${s} ${data.area}`)
      : [`${data.query} ${data.area}`];

    const results = new Map<string, Place>();
    for (const q of queries) {
      let token: string | undefined;
      for (let page = 0; page < data.maxPages; page++) {
        const body: Record<string, unknown> = {
          textQuery: q,
          languageCode: "id",
          regionCode: "ID",
        };
        if (token) body.pageToken = token;
        const json = await searchText(body, { lovable, gmaps });
        for (const p of json.places ?? []) {
          if (!p.id || results.has(p.id)) continue;
          results.set(p.id, {
            id: p.id,
            nama: p.displayName?.text ?? "",
            alamat: p.formattedAddress ?? "",
            telepon: p.nationalPhoneNumber ?? p.internationalPhoneNumber ?? "",
            website: p.websiteUri ?? "",
          });
        }
        token = json.nextPageToken;
        if (!token) break;
        await new Promise((r) => setTimeout(r, 2000));
      }
    }
    const places = Array.from(results.values());
    const now = new Date().toISOString();
    const { error } = await supabaseAdmin.from("places_cache").upsert({
      cache_key: cacheKey,
      query: data.query,
      area: data.area,
      places: places as unknown as never,
      created_at: now,
    });
    if (error) console.error("cache save failed", error.message);
    return { places, cached: false, cachedAt: now };
  });
