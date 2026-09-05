import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AppShell, Stat } from "@/components/AppShell";
import { useAttendance, useStaff, useWorkDays } from "@/lib/data";
import { money, todayISO, monthKey, monthLabel, prettyRange } from "@/lib/format";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/staff/$staffId")({
  head: () => ({
    meta: [
      { title: "Staff Calendar – Expense Tracker" },
      {
        name: "description",
        content:
          "View one staff member's calendar: working days, holidays, present, traveling and absent days with salary summary.",
      },
      { property: "og:title", content: "Staff Calendar" },
      {
        property: "og:description",
        content: "Per-staff calendar with working days and attendance status.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: StaffCalendarPage,
});

const WEEK = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

const pad = (n: number) => String(n).padStart(2, "0");

function daysOfMonth(key: string) {
  const [y, m] = key.split("-").map(Number);
  const count = new Date(y!, m!, 0).getDate();
  return Array.from({ length: count }, (_, i) => `${key}-${pad(i + 1)}`);
}

function StaffCalendarPage() {
  const { staffId } = Route.useParams();
  const [month, setMonth] = useState(monthKey(todayISO()));
  const { data: staff = [] } = useStaff();
  const { data: attendance = [] } = useAttendance();
  const { data: workDays = [] } = useWorkDays();

  const member = staff.find((s) => s.id === staffId);

  const days = useMemo(() => daysOfMonth(month), [month]);
  const flags = useMemo(() => new Map(workDays.map((w) => [w.date, w.working])), [workDays]);
  const isWorking = (d: string) => flags.get(d) !== false;
  const workingDays = days.filter(isWorking);

  // This staff member's attendance status per date.
  const myAtt = useMemo(() => {
    const map = new Map<string, string>();
    attendance
      .filter((a) => a.staff_id === staffId)
      .forEach((a) => map.set(a.date, a.status));
    return map;
  }, [attendance, staffId]);

  const monthDates = useMemo(() => new Set(days), [days]);

  let present = 0,
    traveling = 0,
    absent = 0;
  myAtt.forEach((status, date) => {
    if (!monthDates.has(date) || !isWorking(date)) return;
    if (status === "present") present++;
    else if (status === "traveling") traveling++;
    else if (status === "absent") absent++;
  });

  const salary = member ? Number(member.salary ?? 0) || 0 : 0;
  const salaryType = member?.salary_type === "daily" ? "daily" : "monthly";
  const da = member ? Number(member.da_amount) || 0 : 0;
  const paid = present + traveling;
  const workingCount = workingDays.length;
  const salaryPerDay =
    salaryType === "daily" ? salary : workingCount > 0 ? salary / workingCount : 0;
  // DA is excluded — it is already paid daily via attendance expenses.
  const earned = paid * salaryPerDay;
  const daPaid = paid * da;

  // ── All-time & per-month detailed report ──────────────────────────────
  const report = useMemo(() => {
    // working-day count per month (across all flagged dates; default working)
    const workingPerMonth = new Map<string, number>();
    flags.forEach((working, date) => {
      const key = date.slice(0, 7);
      if (working) workingPerMonth.set(key, (workingPerMonth.get(key) ?? 0) + 1);
    });
    const months = new Map<
      string,
      { present: number; traveling: number; absent: number; da: number; salary: number }
    >();
    let totalPaid = 0,
      totalAbsent = 0,
      totalDa = 0,
      totalSalary = 0;
    const myRows = attendance
      .filter((a) => a.staff_id === staffId)
      .sort((a, b) => a.date.localeCompare(b.date));
    const firstDate = myRows[0]?.date ?? null;
    const lastDate = myRows[myRows.length - 1]?.date ?? null;
    for (const a of myRows) {
      const key = a.date.slice(0, 7);
      const m =
        months.get(key) ?? { present: 0, traveling: 0, absent: 0, da: 0, salary: 0 };
      if (a.status === "present") m.present++;
      else if (a.status === "traveling") m.traveling++;
      else if (a.status === "absent") m.absent++;
      months.set(key, m);
    }
    months.forEach((m, key) => {
      const paidDays = m.present + m.traveling;
      // If no calendar flags exist for that month, treat every day as working.
      const wc = workingPerMonth.get(key) ?? daysOfMonth(key).length;
      const perDay = salaryType === "daily" ? salary : wc > 0 ? salary / wc : 0;
      m.salary = paidDays * perDay;
      m.da = paidDays * da;
      totalPaid += paidDays;
      totalAbsent += m.absent;
      totalDa += m.da;
      totalSalary += m.salary;
    });
    const rows = Array.from(months.entries())
      .map(([key, m]) => ({ key, ...m, paidDays: m.present + m.traveling }))
      .sort((a, b) => b.key.localeCompare(a.key));
    return { rows, firstDate, lastDate, totalPaid, totalAbsent, totalDa, totalSalary };
  }, [attendance, staffId, flags, salary, salaryType, da]);

  const firstWeekday = new Date(`${days[0]}T00:00:00`).getDay();
  const today = todayISO();

  if (!member) {
    return (
      <AppShell title="🧑‍🏭 Staff Calendar">
        <div className="surface p-6 text-center">
          <p className="text-sm text-muted-foreground">Staff member not found.</p>
          <Link to="/calendar" className="mt-3 inline-block text-sm font-medium text-primary underline">
            ← Back to Calendar
          </Link>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell title={`🧑‍🏭 ${member.name}`}>
      <Link to="/calendar" className="text-sm font-medium text-primary underline">
        ← Back to Calendar
      </Link>

      <div className="surface mt-3 flex flex-wrap items-center gap-3 p-4">
        <Input
          type="month"
          value={month}
          onChange={(e) => setMonth(e.target.value || month)}
          className="max-w-44"
        />
        <span className="text-sm text-muted-foreground">{monthLabel(month)}</span>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-3">
        <Stat label="Present" value={String(present)} tone="income" />
        <Stat label="Traveling" value={String(traveling)} tone="balance" />
        <Stat label="Absent" value={String(absent)} tone="expense" />
      </div>
      <div className="mt-3 grid grid-cols-3 gap-3">
        <Stat label="Working days" value={String(workingCount)} />
        <Stat label="Holidays" value={String(days.length - workingCount)} />
        <Stat label="Salary this month" value={money(earned)} tone="balance" />
      </div>

      <h2 className="mt-6 mb-2 text-base font-semibold">🗓️ {monthLabel(month)}</h2>
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
            const status = myAtt.get(d);
            const isToday = d === today;
            const style = !on
              ? "bg-muted text-muted-foreground line-through"
              : status === "present"
                ? "bg-success/20 text-success"
                : status === "traveling"
                  ? "bg-primary/20 text-primary"
                  : status === "absent"
                    ? "bg-destructive/20 text-destructive"
                    : "bg-secondary text-secondary-foreground";
            return (
              <div
                key={d}
                className={`relative rounded-lg py-2 text-center text-sm font-medium ${style} ${
                  isToday ? "ring-2 ring-primary ring-offset-2 ring-offset-background" : ""
                }`}
              >
                {Number(d.slice(-2))}
                {status && on && (
                  <span
                    className={`absolute bottom-1 left-1/2 size-1.5 -translate-x-1/2 rounded-full ${
                      status === "present"
                        ? "bg-success"
                        : status === "traveling"
                          ? "bg-primary"
                          : "bg-destructive"
                    }`}
                  />
                )}
              </div>
            );
          })}
        </div>
        <div className="mt-3 space-y-1 text-xs text-muted-foreground">
          <p>🟢 Present · 🔵 Traveling · 🔴 Absent · struck-through = holiday</p>
          <p>Ring = today. Days without a color are working days not yet marked.</p>
        </div>
      </div>

      <h2 className="mt-6 mb-2 text-base font-semibold">💰 Salary summary</h2>
      <div className="surface p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate font-semibold">{member.name}</p>
            <p className="text-xs text-muted-foreground">
              {salary > 0
                ? salaryType === "daily"
                  ? `Salary ${money(salary)}/day`
                  : `Salary ${money(salary)}/mo (${money(salaryPerDay)}/day)`
                : "No salary"}
              {" × "}{paid} paid days
            </p>
          </div>
          <p className="text-lg font-bold text-primary">{money(earned)}</p>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Present {present} · Traveling {traveling} · Absent {absent} · Not marked{" "}
          {workingCount - paid - absent}
          {da > 0 ? ` · DA already paid: ${money(daPaid)}` : ""}
        </p>
      </div>

      <h2 className="mt-6 mb-2 text-base font-semibold">📊 Overall report</h2>
      <div className="surface p-4">
        <p className="text-sm text-muted-foreground">
          {report.firstDate && report.lastDate
            ? `Working from ${prettyRange(report.firstDate, report.lastDate)}`
            : "No attendance recorded yet"}
        </p>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div>
            <p className="text-xs text-muted-foreground">Days worked</p>
            <p className="text-lg font-bold text-success">{report.totalPaid}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Days absent</p>
            <p className="text-lg font-bold text-destructive">{report.totalAbsent}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Total DA paid</p>
            <p className="text-lg font-bold text-primary">{money(report.totalDa)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Total salary earned</p>
            <p className="text-lg font-bold">{money(report.totalSalary)}</p>
          </div>
        </div>
      </div>

      <h2 className="mt-6 mb-2 text-base font-semibold">🗓️ Month by month</h2>
      <div className="space-y-2">
        {report.rows.length === 0 && (
          <div className="surface p-4 text-sm text-muted-foreground">
            No attendance history yet.
          </div>
        )}
        {report.rows.map((r) => (
          <button
            key={r.key}
            type="button"
            onClick={() => setMonth(r.key)}
            className="surface block w-full p-4 text-left"
          >
            <div className="flex items-center justify-between gap-3">
              <p className="font-semibold">{monthLabel(r.key)}</p>
              <p className="font-bold text-primary">{money(r.salary)}</p>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Worked {r.paidDays} days (Present {r.present} · Traveling {r.traveling}) ·
              Absent {r.absent}
              {da > 0 ? ` · DA paid ${money(r.da)}` : ""}
            </p>
          </button>
        ))}
      </div>
    </AppShell>
  );
}
