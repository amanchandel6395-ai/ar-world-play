CREATE TABLE public.shares (
  token text PRIMARY KEY,
  path text NOT NULL,
  kind text NOT NULL DEFAULT 'photo',
  ai_generated boolean NOT NULL DEFAULT false,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.shares TO service_role;
ALTER TABLE public.shares ENABLE ROW LEVEL SECURITY;