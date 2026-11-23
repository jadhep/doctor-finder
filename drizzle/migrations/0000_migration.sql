CREATE TABLE public.places_cache (
  cache_key text PRIMARY KEY,
  query text NOT NULL,
  area text NOT NULL,
  places jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.places_cache TO service_role;
ALTER TABLE public.places_cache ENABLE ROW LEVEL SECURITY;