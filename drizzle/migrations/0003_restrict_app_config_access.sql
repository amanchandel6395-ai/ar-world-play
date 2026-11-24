REVOKE ALL PRIVILEGES ON TABLE public.app_config FROM PUBLIC, anon, authenticated;
GRANT ALL PRIVILEGES ON TABLE public.app_config TO service_role;
ALTER TABLE public.app_config ENABLE ROW LEVEL SECURITY;