import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { AppShell, Stat } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { useAttendance, useStaff, useWorkDays, currentUserId } from "@/lib/data";
import { money, todayISO, monthKey, monthLabel } from "@/lib/format";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/calendar")({
  head: () => ({
    meta: [
      { title: "Work Calendar & Salary Calculator – Expense Tracker" },
      {
        name: "description",
        content:
          "Tick working days and holidays on the calendar, then calculate each staff member's salary for the month.",
      },
      { property: "og:title", content: "Work Calendar & Salary Calculator" },
      {
        property: "og:description",
        content: "Mark working days on a calendar and get an automatic monthly salary total per staff.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CalendarPage,
});

const WEEK = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

const pad = (n: number) => String(n).padStart(2, "0");

function daysOfMonth(key: string) {
  const [y, m] = key.split("-").map(Number);
  const count = new Date(y!, m!, 0).getDate();
  return Array.from({ length: count }, (_, i) => `${key}-${pad(i + 1)}`);
}

function CalendarPage() {
  const qc = useQueryClient();
  const [month, setMonth] = useState(monthKey(todayISO()));
  const { data: staff = [] } = useStaff();
  const { data: attendance = [] } = useAttendance();
  const { data: workDays = [] } = useWorkDays();
  const [busy, setBusy] = useState(false);

  const days = useMemo(() => daysOfMonth(month), [month]);
  const flags = useMemo(() => new Map(workDays.map((w) => [w.date, w.working])), [workDays]);

  // A day counts as working unless it has been ticked as a holiday.
  const isWorking = (d: string) => flags.get(d) !== false;
  const workingDays = days.filter(isWorking);

  const setDay = async (date: string, working: boolean) => {
    setBusy(true);
    try {
      const user_id = await currentUserId();
      const { error } = await supabase
        .from("work_days")
        .upsert({ user_id, date, working }, { onConflict: "user_id,date" });
      if (error) throw error;
      qc.invalidateQueries({ queryKey: ["work_days"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  const setMany = async (working: boolean, only?: (d: string) => boolean) => {
    setBusy(true);
    try {
      const user_id = await currentUserId();
      const rows = days.filter((d) => (only ? only(d) : true)).map((date) => ({ user_id, date, working }));
      const { error } = await supabase.from("work_days").upsert(rows, { onConflict: "user_id,date" });
      if (error) throw error;
      qc.invalidateQueries({ queryKey: ["work_days"] });
      toast.success("Calendar updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  const attByStaff = useMemo(() => {
    const map = new Map<string, Map<string, string>>();
    attendance
      .filter((a) => monthKey(a.date) === month)
      .forEach((a) => {
        if (!map.has(a.staff_id)) map.set(a.staff_id, new Map());
        map.get(a.staff_id)!.set(a.date, a.status);
      });
    return map;
  }, [attendance, month]);

  const activeStaff = staff.filter((s) => s.active);

  const salary = activeStaff.map((s) => {
    const rec = attByStaff.get(s.id) ?? new Map<string, string>();
    const present = workingDays.filter((d) => rec.get(d) === "present").length;
    const traveling = workingDays.filter((d) => rec.get(d) === "traveling").length;
    const absent = workingDays.filter((d) => rec.get(d) === "absent").length;
    // Traveling days are paid days, just like present days.
    const paid = present + traveling;
    const salary = Number(s.salary ?? 0) || 0;
    const salaryType = s.salary_type === "daily" ? "daily" : "monthly";
    const da = Number(s.da_amount) || 0;
    const workingCount = workingDays.length;
    // Monthly salary is split over working days (pro-rated by attendance);
    // daily salary is a fixed rate per paid day. DA is added per paid day.
    const salaryPerDay =
      salaryType === "daily" ? salary : workingCount > 0 ? salary / workingCount : 0;
    const hasSalary = salary > 0;
    const hasDa = da > 0;
    return {
      staff: s,
      salary,
      salaryType,
      da,
      salaryPerDay,
      hasSalary,
      hasDa,
      present,
      traveling,
      paid,
      absent,
      unmarked: workingCount - paid - absent,
      earned: paid * salaryPerDay + paid * da,
      full: salaryType === "daily" ? workingCount * salary + workingCount * da : salary + workingCount * da,
    };
  });

  const totalEarned = salary.reduce((t, r) => t + r.earned, 0);
  const totalFull = salary.reduce((t, r) => t + r.full, 0);

  const firstWeekday = new Date(`${days[0]}T00:00:00`).getDay();

  return (
    <AppShell title="📆 Calendar & Salary">
      <div className="surface flex flex-wrap items-center gap-3 p-4">
        <Input
          type="month"
          value={month}
          onChange={(e) => setMonth(e.target.value || month)}
          className="max-w-44"
        />
        <span className="text-sm text-muted-foreground">{monthLabel(month)}</span>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-3">
        <Stat label="Working days" value={String(workingDays.length)} />
        <Stat label="Holidays" value={String(days.length - workingDays.length)} />
        <Stat label="Total salary" value={money(totalEarned)} />
      </div>

      <h2 className="mt-6 mb-2 text-base font-semibold">🗓️ Tick working days</h2>
      <div className="surface p-4">
        <div className="mb-2 grid grid-cols-7 gap-1 text-center text-xs text-muted-foreground">
          {WEEK.map((w) => (
            <div key={w}>{w}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: firstWeekday }).map((_, i) => (
            <div key={`b${i}`} />
          ))}
          {days.map((d) => {
            const on = isWorking(d);
            return (
              <button
                key={d}
                disabled={busy}
                onClick={() => setDay(d, !on)}
                className={`rounded-lg py-2 text-sm font-medium transition-colors ${
                  on
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground line-through"
                }`}
                aria-pressed={on}
              >
                {Number(d.slice(-2))}
              </button>
            );
          })}
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Tap a date to switch it between working day and holiday.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button size="sm" variant="secondary" disabled={busy} onClick={() => setMany(true)}>
            All working
          </Button>
          <Button size="sm" variant="secondary" disabled={busy} onClick={() => setMany(false)}>
            All holiday
          </Button>
          <Button
            size="sm"
            variant="secondary"
            disabled={busy}
            onClick={() =>
              setMany(false, (d) => new Date(`${d}T00:00:00`).getDay() === 0)
            }
          >
            Sundays off
          </Button>
        </div>
      </div>

      <h2 className="mt-6 mb-2 text-base font-semibold">💰 Salary calculator</h2>
      <div className="space-y-3">
        {salary.length === 0 && (
          <p className="text-sm text-muted-foreground">Add staff in Settings first.</p>
        )}
        {salary.map((r) => (
          <div key={r.staff.id} className="surface p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate font-semibold">{r.staff.name}</p>
                <p className="text-xs text-muted-foreground">
                  {r.hasSalary
                    ? r.salaryType === "daily"
                      ? `Salary ${money(r.salary)}/day`
                      : `Salary ${money(r.salary)}/mo (${money(r.salaryPerDay)}/day)`
                    : "No salary"}
                  {r.hasDa ? ` + ${money(r.da)}/day DA` : ""} × {r.paid} paid
                </p>
              </div>
              <p className="text-lg font-bold text-primary">{money(r.earned)}</p>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Present {r.present} · Traveling {r.traveling} · Absent {r.absent} · Not marked{" "}
              {r.unmarked} · Full month {money(r.full)}
            </p>
          </div>
        ))}
        {salary.length > 0 && (
          <div className="surface flex items-center justify-between p-4">
            <div>
              <p className="font-semibold">Total payable</p>
              <p className="text-xs text-muted-foreground">
                If everyone worked all {workingDays.length} days: {money(totalFull)}
              </p>
            </div>
            <p className="text-lg font-bold text-primary">{money(totalEarned)}</p>
          </div>
        )}
      </div>
    </AppShell>
  );
}
