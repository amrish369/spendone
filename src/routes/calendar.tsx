import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { AppShell, Stat } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { useAttendance, useStaff, useWorkDays, currentUserId, type Staff } from "@/lib/data";
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
  const [selected, setSelected] = useState(todayISO());
  const { data: staff = [] } = useStaff();
  const { data: attendance = [] } = useAttendance();
  const { data: workDays = [] } = useWorkDays();
  const [busy, setBusy] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

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

  // Attendance status per date -> staff_id -> status (for calendar cell colors).
  const attByDate = useMemo(() => {
    const map = new Map<string, Map<string, string>>();
    attendance.forEach((a) => {
      if (!map.has(a.date)) map.set(a.date, new Map());
      map.get(a.date)!.set(a.staff_id, a.status);
    });
    return map;
  }, [attendance]);

  const mark = async (member: Staff, status: "present" | "traveling" | "absent") => {
    setBusyId(member.id);
    try {
      const user_id = await currentUserId();
      const amount = status === "absent" ? 0 : Number(member.da_amount);
      const existing = attendance.find((a) => a.date === selected && a.staff_id === member.id);

      const { data: saved, error } = await supabase
        .from("attendance")
        .upsert(
          {
            ...(existing ? { id: existing.id } : {}),
            user_id,
            staff_id: member.id,
            date: selected,
            status,
            da_amount: amount,
          },
          { onConflict: "staff_id,date" },
        )
        .select()
        .single();
      if (error) throw error;

      await supabase.from("transactions").delete().eq("attendance_id", saved.id);

      if (status !== "absent" && amount > 0) {
        const { error: txErr } = await supabase.from("transactions").insert({
          user_id,
          date: selected,
          type: "expense",
          category: member.name,
          amount,
          description: null,
          source: "attendance",
          attendance_id: saved.id,
        });
        if (txErr) throw txErr;
      }

      qc.invalidateQueries({ queryKey: ["attendance"] });
      qc.invalidateQueries({ queryKey: ["transactions"] });
      toast.success(
        status === "absent"
          ? `${member.name}: Absent`
          : status === "traveling"
            ? `${member.name}: Traveling • ${money(amount)} DA added`
            : `${member.name}: ${money(amount)} DA added`,
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusyId(null);
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

      <h2 className="mt-6 mb-2 text-base font-semibold">🗓️ Tap a date to mark attendance</h2>
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
            const isSel = d === selected;
            const dayAtt = attByDate.get(d);
            const statuses = dayAtt ? new Set(dayAtt.values()) : new Set<string>();
            const dot =
              statuses.size === 0
                ? null
                : statuses.size === 1
                  ? statuses.has("present")
                    ? "bg-success"
                    : statuses.has("traveling")
                      ? "bg-primary"
                      : "bg-destructive"
                  : "bg-accent-foreground";
            return (
              <button
                key={d}
                onClick={() => setSelected(d)}
                className={`relative rounded-lg py-2 text-sm font-medium transition-colors ${
                  isSel
                    ? "bg-primary text-primary-foreground ring-2 ring-primary ring-offset-2 ring-offset-background"
                    : on
                      ? "bg-secondary text-secondary-foreground hover:bg-primary/20"
                      : "bg-muted text-muted-foreground line-through"
                }`}
                aria-pressed={isSel}
              >
                {Number(d.slice(-2))}
                {dot && (
                  <span
                    className={`absolute bottom-1 left-1/2 size-1.5 -translate-x-1/2 rounded-full ${dot} ${
                      isSel ? "ring-1 ring-primary-foreground" : ""
                    }`}
                  />
                )}
              </button>
            );
          })}
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Tap a date to select it and mark attendance below. Dots: 🟢 present · 🔵 traveling · 🔴 absent.
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
        <div className="mt-3 border-t pt-3">
          <Button
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() => setDay(selected, !isWorking(selected))}
          >
            {isWorking(selected)
              ? `🚫 Mark ${selected.slice(-2)} as holiday`
              : `✅ Mark ${selected.slice(-2)} as working day`}
          </Button>
        </div>
      </div>

      <h2 className="mt-6 mb-2 text-base font-semibold">
        🧑‍🏭 Attendance for {selected}
      </h2>
      <div className="space-y-3">
        {activeStaff.length === 0 && (
          <p className="text-sm text-muted-foreground">Add staff in Settings first.</p>
        )}
        {activeStaff.map((member) => {
          const rec = attByDate.get(selected)?.get(member.id);
          return (
            <div key={member.id} className="surface p-4">
              <div className="flex items-center justify-between">
                <Link
                  to="/staff/$staffId"
                  params={{ staffId: member.id }}
                  className="font-semibold text-primary underline-offset-2 hover:underline"
                >
                  {member.name} →
                </Link>
                <p className="text-xs text-muted-foreground">
                  DA {money(Number(member.da_amount))}
                </p>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2">
                <Button
                  size="sm"
                  disabled={busyId === member.id}
                  variant={rec === "present" ? "default" : "outline"}
                  onClick={() => mark(member, "present")}
                >
                  Present
                </Button>
                <Button
                  size="sm"
                  disabled={busyId === member.id}
                  variant={rec === "traveling" ? "secondary" : "outline"}
                  onClick={() => mark(member, "traveling")}
                >
                  🚌 Traveling
                </Button>
                <Button
                  size="sm"
                  disabled={busyId === member.id}
                  variant={rec === "absent" ? "destructive" : "outline"}
                  onClick={() => mark(member, "absent")}
                >
                  Absent
                </Button>
              </div>
            </div>
          );
        })}
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
                <Link
                  to="/staff/$staffId"
                  params={{ staffId: r.staff.id }}
                  className="truncate font-semibold text-primary underline-offset-2 hover:underline"
                >
                  {r.staff.name} →
                </Link>
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
