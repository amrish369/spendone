CREATE TABLE public.work_days (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  date DATE NOT NULL,
  working BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, date)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.work_days TO authenticated;
GRANT ALL ON public.work_days TO service_role;

ALTER TABLE public.work_days ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own work days"
ON public.work_days FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$
LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_work_days_updated_at
BEFORE UPDATE ON public.work_days
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();