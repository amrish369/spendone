UPDATE public.transactions SET category = '🍔 Daily Allowance' WHERE category IN ('🍔 Supervisor D/A', '👨‍💼 Promoter D/A');
UPDATE public.categories SET name = '🍔 Daily Allowance' WHERE name IN ('🍔 Supervisor D/A', '👨‍💼 Promoter D/A');
UPDATE public.staff SET role = 'Staff' WHERE role IN ('Supervisor', 'Promoter');
UPDATE public.attendance SET status = 'present' WHERE status = 'half';