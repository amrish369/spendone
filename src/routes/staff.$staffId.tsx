import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AppShell, Stat } from "@/components/AppShell";
import { useAttendance, useStaff, useWorkDays } from "@/lib/data";
import { money, todayISO, monthKey, monthLabel } from "@/lib/format";
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
  const earned = paid * salaryPerDay + paid * da;

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
              {da > 0 ? ` + ${money(da)}/day DA` : ""} × {paid} paid days
            </p>
          </div>
          <p className="text-lg font-bold text-primary">{money(earned)}</p>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Present {present} · Traveling {traveling} · Absent {absent} · Not marked{" "}
          {workingCount - paid - absent}
        </p>
      </div>
    </AppShell>
  );
}
