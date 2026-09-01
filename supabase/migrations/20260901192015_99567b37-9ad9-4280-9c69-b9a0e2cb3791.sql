ALTER TABLE public.attendance DROP CONSTRAINT attendance_status_check;
ALTER TABLE public.attendance ADD CONSTRAINT attendance_status_check CHECK (status IN ('present', 'traveling', 'absent'));