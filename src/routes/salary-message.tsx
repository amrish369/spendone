import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { useAttendance, useStaff, useWorkDays } from "@/lib/data";
import { money, shortDate, todayISO } from "@/lib/format";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/salary-message")({
  head: () => ({
    meta: [
      { title: "Salary Message – Expense Tracker" },
      {
        name: "description",
        content:
          "Pick a date range and staff to generate a salary message: days worked, DA already taken and salary payable.",
      },
      { property: "og:title", content: "Salary Message – Expense Tracker" },
      {
        property: "og:description",
        content: "Generate a shareable salary summary for any staff member and date range.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SalaryMessagePage,
});

const pad = (n: number) => String(n).padStart(2, "0");

function daysOfMonth(key: string) {
  const [y, m] = key.split("-").map(Number);
  const count = new Date(y!, m!, 0).getDate();
  return Array.from({ length: count }, (_, i) => `${key}-${pad(i + 1)}`);
}

const num = (n: number) => (Number(n) || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 });

function monthStart(iso: string) {
  return iso.slice(0, 7);
}

function SalaryMessagePage() {
  const { data: staff = [] } = useStaff();
  const { data: attendance = [] } = useAttendance();
  const { data: workDays = [] } = useWorkDays();

  const firstOfMonth = `${monthStart(todayISO())}-01`;
  const [from, setFrom] = useState(firstOfMonth);
  const [to, setTo] = useState(todayISO());
  const [picked, setPicked] = useState<string[]>([]);
  const [message, setMessage] = useState("");

  const activeStaff = useMemo(() => staff.filter((s) => s.active), [staff]);
  const flags = useMemo(() => new Map(workDays.map((w) => [w.date, w.working])), [workDays]);
  const isWorking = (d: string) => flags.get(d) !== false;

  const toggle = (id: string) =>
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  const rows = useMemo(() => {
    if (!from || !to || from > to) return [];
    const chosen = picked.length ? activeStaff.filter((s) => picked.includes(s.id)) : activeStaff;

    // Working days per month (a day counts as working unless ticked as holiday).
    const workingPerMonth = new Map<string, number>();
    const monthsSeen = new Set<string>();

    return chosen.map((s) => {
      const mine = attendance.filter(
        (a) => a.staff_id === s.id && a.date >= from && a.date <= to && isWorking(a.date),
      );
      let present = 0,
        traveling = 0,
        absent = 0;
      const paidByMonth = new Map<string, number>();
      mine.forEach((a) => {
        if (a.status === "present") present++;
        else if (a.status === "traveling") traveling++;
        else if (a.status === "absent") absent++;
        if (a.status === "present" || a.status === "traveling") {
          const key = monthStart(a.date);
          monthsSeen.add(key);
          paidByMonth.set(key, (paidByMonth.get(key) ?? 0) + 1);
        }
      });

      const salary = Number(s.salary ?? 0) || 0;
      const daily = s.salary_type === "daily";
      const da = Number(s.da_amount) || 0;
      const paid = present + traveling;

      let earned = 0;
      paidByMonth.forEach((paidDays, key) => {
        if (daily) {
          earned += paidDays * salary;
          return;
        }
        let wc = workingPerMonth.get(key);
        if (wc === undefined) {
          wc = daysOfMonth(key).filter(isWorking).length;
          workingPerMonth.set(key, wc);
        }
        earned += wc > 0 ? (salary / wc) * paidDays : 0;
      });

      const dates = mine.map((a) => a.date).sort();
      return {
        staff: s,
        present,
        traveling,
        absent,
        paid,
        da: paid * da,
        daRate: da,
        earned,
        daily,
        salary,
        firstDate: dates[0] ?? null,
        lastDate: dates[dates.length - 1] ?? null,
      };
    });
  }, [activeStaff, attendance, picked, from, to, flags]);

  const generate = () => {
    if (!from || !to) {
      toast.error("Please pick a date range!");
      return;
    }
    if (from > to) {
      toast.error('"From" date must be before "To" date!');
      return;
    }
    const withData = rows.filter((r) => r.paid > 0 || r.absent > 0);
    if (withData.length === 0) {
      setMessage("");
      toast.error("No attendance found in this date range.");
      return;
    }

    let out = `Salary Report\n${shortDate(from)} to ${shortDate(to)}\n\n`;
    withData.forEach((r) => {
      out += `${r.staff.name}\n`;
      out += `Working days = ${r.paid}\n`;
      out += `Present = ${r.present}\n`;
      if (r.traveling > 0) out += `Traveling = ${r.traveling}\n`;
      if (r.absent > 0) out += `Absent = ${r.absent}\n`;
      out += `DA taken = ${num(r.da)}\n`;
      out += `Salary = ${num(r.earned)}\n\n`;
    });

    const totalSalary = withData.reduce((s, r) => s + r.earned, 0);
    const totalDa = withData.reduce((s, r) => s + r.da, 0);
    const totalDays = withData.reduce((s, r) => s + r.paid, 0);
    out += `Total Days = ${totalDays}\n`;
    out += `Total DA = ${num(totalDa)}\n`;
    out += `Total Salary = ${num(totalSalary)}\n`;

    setMessage(out);
  };

  return (
    <AppShell title="💰 Salary Message">
      <div className="surface space-y-3 p-4">
        <h2 className="text-base font-semibold">📅 Select date range</h2>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="from">From</Label>
            <Input id="from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="to">To</Label>
            <Input id="to" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
        </div>

        <div className="space-y-2">
          <Label>Staff</Label>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setPicked([])}
              className={`rounded-full border px-3 py-1.5 text-sm ${
                picked.length === 0 ? "bg-primary text-primary-foreground" : "bg-secondary"
              }`}
            >
              All staff
            </button>
            {activeStaff.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => toggle(s.id)}
                className={`rounded-full border px-3 py-1.5 text-sm ${
                  picked.includes(s.id) ? "bg-primary text-primary-foreground" : "bg-secondary"
                }`}
              >
                {s.name}
              </button>
            ))}
          </div>
          {activeStaff.length === 0 && (
            <p className="text-xs text-muted-foreground">Add staff in Settings first.</p>
          )}
        </div>

        <Button className="w-full" onClick={generate}>
          Generate salary message
        </Button>
      </div>

      <h2 className="mt-6 mb-2 text-base font-semibold">📊 Preview</h2>
      <div className="space-y-3">
        {rows.length === 0 && (
          <p className="text-sm text-muted-foreground">Pick a valid date range to see totals.</p>
        )}
        {rows.map((r) => (
          <div key={r.staff.id} className="surface p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate font-semibold">{r.staff.name}</p>
                <p className="text-xs text-muted-foreground">
                  {r.salary > 0
                    ? r.daily
                      ? `Salary ${money(r.salary)}/day`
                      : `Salary ${money(r.salary)}/month`
                    : "No salary set"}
                  {" · "}
                  {r.paid} days worked
                </p>
              </div>
              <p className="text-lg font-bold text-primary">{money(r.earned)}</p>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Present {r.present} · Traveling {r.traveling} · Absent {r.absent} · DA already taken{" "}
              {money(r.da)}
            </p>
          </div>
        ))}
      </div>

      {message && (
        <div className="surface mt-4 p-4">
          <h3 className="mb-2 text-base font-semibold">Generated message</h3>
          <pre className="num max-h-96 overflow-auto whitespace-pre-wrap rounded-lg bg-muted p-3 text-sm">
            {message}
          </pre>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <Button
              variant="outline"
              onClick={() => {
                navigator.clipboard.writeText(message);
                toast.success("Message copied!");
              }}
            >
              📋 Copy
            </Button>
            <Button
              className="bg-success text-success-foreground hover:bg-success/90"
              onClick={() =>
                window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, "_blank")
              }
            >
              📲 WhatsApp
            </Button>
          </div>
        </div>
      )}
    </AppShell>
  );
}
