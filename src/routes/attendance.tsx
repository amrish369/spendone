import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { AppShell, Stat } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { useAttendance, useStaff, currentUserId, type Staff } from "@/lib/data";
import { categoryForRole } from "@/lib/constants";
import { money, todayISO, hiDate } from "@/lib/format";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/attendance")({
  head: () => ({
    meta: [
      { title: "हाज़िरी और DA – खर्च ट्रैकर" },
      {
        name: "description",
        content: "स्टाफ की हाज़िरी लगाएँ — उपस्थित होते ही DA अपने आप खर्च में जुड़ जाता है।",
      },
      { property: "og:title", content: "हाज़िरी और DA – खर्च ट्रैकर" },
      {
        property: "og:description",
        content: "उपस्थिति लगाते ही DA राशि अपने आप खर्च में दर्ज होती है।",
      },
    ],
  }),
  component: AttendancePage,
});

type Status = "present" | "half" | "absent";

function AttendancePage() {
  const qc = useQueryClient();
  const [date, setDate] = useState(todayISO());
  const { data: staff = [] } = useStaff();
  const { data: records = [], isLoading } = useAttendance(date);
  const [busyId, setBusyId] = useState<string | null>(null);

  const activeStaff = staff.filter((s) => s.active);
  const byStaff = useMemo(
    () => new Map(records.map((r) => [r.staff_id, r])),
    [records],
  );

  const daFor = (member: Staff, status: Status) =>
    status === "present"
      ? Number(member.da_amount)
      : status === "half"
        ? Number(member.da_amount) / 2
        : 0;

  const mark = async (member: Staff, status: Status) => {
    setBusyId(member.id);
    try {
      const user_id = await currentUserId();
      const amount = daFor(member, status);
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

      // हर हाज़िरी बदलाव पर पुराना DA खर्च हटाकर नया बनाएँ
      await supabase.from("transactions").delete().eq("attendance_id", saved.id);

      if (status !== "absent" && amount > 0) {
        const { error: txErr } = await supabase.from("transactions").insert({
          user_id,
          date,
          type: "expense",
          category: categoryForRole(member.role),
          amount,
          description: `${member.name} – ${status === "half" ? "आधा दिन" : "पूरा दिन"} DA`,
          source: "attendance",
          attendance_id: saved.id,
        });
        if (txErr) throw txErr;
      }

      qc.invalidateQueries({ queryKey: ["attendance"] });
      qc.invalidateQueries({ queryKey: ["transactions"] });
      toast.success(
        status === "absent"
          ? `${member.name}: अनुपस्थित`
          : `${member.name}: ${money(amount)} DA जुड़ गया`,
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "त्रुटि");
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
    const half = records.filter((r) => r.status === "half").length;
    const da = records.reduce((s, r) => s + Number(r.da_amount), 0);
    return { present, half, da };
  }, [records]);

  return (
    <AppShell title="🧑‍🏭 हाज़िरी और DA">
      <div className="surface flex flex-wrap items-center gap-3 p-4">
        <Input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="max-w-44"
        />
        <Button onClick={markAllPresent} disabled={activeStaff.length === 0}>
          ✅ सभी उपस्थित
        </Button>
        <Button asChild variant="outline">
          <Link to="/settings">⚙️ DA सेटिंग्स</Link>
        </Button>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-3">
        <Stat label="उपस्थित" value={String(totals.present)} tone="income" />
        <Stat label="आधा दिन" value={String(totals.half)} />
        <Stat label="कुल DA" value={money(totals.da)} tone="expense" />
      </div>

      <p className="mt-4 text-sm text-muted-foreground">{hiDate(date)} की हाज़िरी</p>

      <div className="mt-2 space-y-3">
        {isLoading && <p className="text-sm text-muted-foreground">लोड हो रहा है...</p>}
        {activeStaff.length === 0 && (
          <div className="surface p-5 text-center">
            <p className="text-sm text-muted-foreground">
              अभी कोई स्टाफ नहीं जोड़ा गया। सेटिंग्स में जाकर स्टाफ और उनका DA सेट करें।
            </p>
            <Button asChild className="mt-3">
              <Link to="/settings">स्टाफ जोड़ें</Link>
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
                    {member.role} • DA {money(Number(member.da_amount))}
                  </p>
                </div>
                {rec && (
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${
                      rec.status === "present"
                        ? "bg-success/15 text-success"
                        : rec.status === "half"
                          ? "bg-warning/20 text-warning-foreground"
                          : "bg-destructive/15 text-destructive"
                    }`}
                  >
                    {rec.status === "present"
                      ? `उपस्थित • ${money(Number(rec.da_amount))}`
                      : rec.status === "half"
                        ? `आधा दिन • ${money(Number(rec.da_amount))}`
                        : "अनुपस्थित"}
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
                  उपस्थित
                </Button>
                <Button
                  size="sm"
                  disabled={busyId === member.id}
                  variant={rec?.status === "half" ? "default" : "outline"}
                  onClick={() => mark(member, "half")}
                >
                  आधा दिन
                </Button>
                <Button
                  size="sm"
                  disabled={busyId === member.id}
                  variant={rec?.status === "absent" ? "destructive" : "outline"}
                  onClick={() => mark(member, "absent")}
                >
                  अनुपस्थित
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </AppShell>
  );
}
