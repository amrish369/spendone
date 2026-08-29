import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type Txn = {
  id: string;
  date: string;
  type: "expense" | "funding";
  category: string;
  amount: number;
  description: string | null;
  source: string;
  attendance_id: string | null;
};

export type Staff = {
  id: string;
  name: string;
  role: string;
  da_amount: number;
  salary: number;
  salary_type: "monthly" | "daily";
  active: boolean;
};

export type Attendance = {
  id: string;
  staff_id: string;
  date: string;
  status: "present" | "traveling" | "absent";
  da_amount: number;
};

export type WorkLog = {
  id: string;
  date: string;
  start_time: string | null;
  close_time: string | null;
  note: string | null;
};

export type Category = { id: string; name: string; type: "expense" | "funding" };
export type Customer = { id: string; name: string; phone: string | null };
export type LedgerEntry = {
  id: string;
  customer_id: string;
  date: string;
  type: "given" | "taken";
  amount: number;
  note: string | null;
};

async function unwrap<T>(p: PromiseLike<{ data: unknown; error: { message: string } | null }>) {
  const { data, error } = await p;
  if (error) throw new Error(error.message);
  return (data ?? []) as T;
}

export function useTransactions() {
  return useQuery({
    queryKey: ["transactions"],
    queryFn: () =>
      unwrap<Txn[]>(
        supabase
          .from("transactions")
          .select("*")
          .order("date", { ascending: false })
          .order("created_at", { ascending: false }),
      ),
  });
}

export function useCategories() {
  return useQuery({
    queryKey: ["categories"],
    queryFn: () =>
      unwrap<Category[]>(
        supabase.from("categories").select("*").order("created_at", { ascending: true }),
      ),
  });
}

export function useStaff() {
  return useQuery({
    queryKey: ["staff"],
    queryFn: () =>
      unwrap<Staff[]>(supabase.from("staff").select("*").order("created_at", { ascending: true })),
  });
}

export function useAttendance(date?: string) {
  return useQuery({
    queryKey: ["attendance", date ?? "all"],
    queryFn: () => {
      let q = supabase.from("attendance").select("*").order("date", { ascending: false });
      if (date) q = q.eq("date", date);
      return unwrap<Attendance[]>(q);
    },
  });
}

export function useWorkLogs() {
  return useQuery({
    queryKey: ["work_logs"],
    queryFn: () =>
      unwrap<WorkLog[]>(
        supabase.from("work_logs").select("*").order("date", { ascending: false }),
      ),
  });
}

export type WorkDay = { id: string; date: string; working: boolean };

export function useWorkDays() {
  return useQuery({
    queryKey: ["work_days"],
    queryFn: () =>
      unwrap<WorkDay[]>(
        supabase.from("work_days").select("*").order("date", { ascending: true }),
      ),
  });
}

export function useCustomers() {
  return useQuery({
    queryKey: ["customers"],
    queryFn: () =>
      unwrap<Customer[]>(
        supabase.from("customers").select("*").order("created_at", { ascending: false }),
      ),
  });
}

export function useLedgerEntries(customerId?: string) {
  return useQuery({
    queryKey: ["ledger", customerId ?? "all"],
    queryFn: () => {
      let q = supabase.from("ledger_entries").select("*").order("date", { ascending: false });
      if (customerId) q = q.eq("customer_id", customerId);
      return unwrap<LedgerEntry[]>(q);
    },
  });
}

/** Generic table mutation helper that refreshes related caches. */
export function useTableMutation(invalidate: string[]) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (fn: () => Promise<{ error: { message: string } | null }>) => {
      const { error } = await fn();
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      invalidate.forEach((key) => qc.invalidateQueries({ queryKey: [key] }));
    },
  });
}

export async function currentUserId() {
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? "";
}
