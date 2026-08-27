CREATE TABLE public.work_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date date NOT NULL,
  start_time time,
  close_time time,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, date)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.work_logs TO authenticated;
GRANT ALL ON public.work_logs TO service_role;

ALTER TABLE public.work_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own work_logs ALL"
  ON public.work_logs
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_work_logs_updated_at
  BEFORE UPDATE ON public.work_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();