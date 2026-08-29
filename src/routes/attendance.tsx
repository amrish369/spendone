import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { AppShell, Stat } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { useAttendance, useStaff, currentUserId, type Staff } from "@/lib/data";
import { money, todayISO, hiDate } from "@/lib/format";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/attendance")({
  head: () => ({
    meta: [
      { title: "Attendance & DA – Expense Tracker" },
      {
        name: "description",
        content: "Mark staff attendance — the daily allowance is added as an expense automatically.",
      },
      { property: "og:title", content: "Attendance & DA – Expense Tracker" },
      {
        property: "og:description",
        content: "Marking someone present records their DA amount as an expense instantly.",
      },
    ],
  }),
  component: AttendancePage,
});

type Status = "present" | "traveling" | "absent";

function AttendancePage() {
  const qc = useQueryClient();
  const [date, setDate] = useState(todayISO());
  const { data: staff = [] } = useStaff();
  const { data: records = [], isLoading } = useAttendance(date);
  const [busyId, setBusyId] = useState<string | null>(null);

  const activeStaff = staff.filter((s) => s.active);
  const byStaff = useMemo(() => new Map(records.map((r) => [r.staff_id, r])), [records]);

  const mark = async (member: Staff, status: Status) => {
    setBusyId(member.id);
    try {
      const user_id = await currentUserId();
      const amount = status === "absent" ? 0 : Number(member.da_amount);
      const existing = byStaff.get(member.id);

      const { data: saved, error } = await supabase
        .from("attendance")
        .upsert(
          {
            ...(existing ? { id: existing.id } : {}),
            user_id,
            staff_id: member.id,
            date,
            status,
            da_amount: amount,
          },
          { onConflict: "staff_id,date" },
        )
        .select()
        .single();
      if (error) throw error;

      // Remove the previous DA expense and recreate it on every change
      await supabase.from("transactions").delete().eq("attendance_id", saved.id);

      if (status !== "absent" && amount > 0) {
        const { error: txErr } = await supabase.from("transactions").insert({
          user_id,
          date,
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

  const markAllPresent = async () => {
    for (const member of activeStaff) {
      if (byStaff.get(member.id)?.status === "present") continue;
      await mark(member, "present");
    }
  };

  const totals = useMemo(() => {
    const present = records.filter((r) => r.status === "present").length;
    const traveling = records.filter((r) => r.status === "traveling").length;
    const absent = records.filter((r) => r.status === "absent").length;
    const da = records.reduce((s, r) => s + Number(r.da_amount), 0);
    return { present, traveling, absent, da };
  }, [records]);

  return (
    <AppShell title="🧑‍🏭 Attendance & DA">
      <div className="surface flex flex-wrap items-center gap-3 p-4">
        <Input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="max-w-44"
        />
        <Button onClick={markAllPresent} disabled={activeStaff.length === 0}>
          ✅ Mark all present
        </Button>
        <Button asChild variant="outline">
          <Link to="/settings">⚙️ DA settings</Link>
        </Button>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Present" value={String(totals.present)} tone="income" />
        <Stat label="Traveling" value={String(totals.traveling)} />
        <Stat label="Absent" value={String(totals.absent)} />
        <Stat label="Total DA" value={money(totals.da)} tone="expense" />
      </div>

      <p className="mt-4 text-sm text-muted-foreground">Attendance for {hiDate(date)}</p>

      <div className="mt-2 space-y-3">
        {isLoading && <p className="text-sm text-muted-foreground">Loading...</p>}
        {activeStaff.length === 0 && (
          <div className="surface p-5 text-center">
            <p className="text-sm text-muted-foreground">
              No staff added yet. Go to settings to add staff and set their DA.
            </p>
            <Button asChild className="mt-3">
              <Link to="/settings">Add staff</Link>
            </Button>
          </div>
        )}
        {activeStaff.map((member) => {
          const rec = byStaff.get(member.id);
          return (
            <div key={member.id} className="surface p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold">{member.name}</p>
                  <p className="text-xs text-muted-foreground">
                    DA {money(Number(member.da_amount))}
                  </p>
                </div>
                {rec && (
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${
                      rec.status === "absent"
                        ? "bg-destructive/15 text-destructive"
                        : rec.status === "traveling"
                          ? "bg-primary/15 text-primary"
                          : "bg-success/15 text-success"
                    }`}
                  >
                    {rec.status === "absent"
                      ? "Absent"
                      : rec.status === "traveling"
                        ? `Traveling • ${money(Number(rec.da_amount))}`
                        : `Present • ${money(Number(rec.da_amount))}`}
                  </span>
                )}
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2">
                <Button
                  size="sm"
                  disabled={busyId === member.id}
                  variant={rec?.status === "present" ? "default" : "outline"}
                  onClick={() => mark(member, "present")}
                >
                  Present
                </Button>
                <Button
                  size="sm"
                  disabled={busyId === member.id}
                  variant={rec?.status === "traveling" ? "secondary" : "outline"}
                  onClick={() => mark(member, "traveling")}
                >
                  🚌 Traveling
                </Button>
                <Button
                  size="sm"
                  disabled={busyId === member.id}
                  variant={rec?.status === "absent" ? "destructive" : "outline"}
                  onClick={() => mark(member, "absent")}
                >
                  Absent
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </AppShell>
  );
}
