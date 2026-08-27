import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { useWorkLogs, currentUserId, type WorkLog } from "@/lib/data";
import { todayISO, hiDate } from "@/lib/format";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/notes")({
  head: () => ({
    meta: [
      { title: "Note Pad – Expense Tracker" },
      {
        name: "description",
        content: "Select a date and record when the work started and closed, with an optional note.",
      },
      { property: "og:title", content: "Note Pad – Expense Tracker" },
      { property: "og:description", content: "Log the start and close time of work for any date." },
    ],
  }),
  component: NotesPage,
});

/** Formats a "HH:MM:SS" or "HH:MM" time into 12-hour "h:mm AM/PM". */
function fmtTime(t: string | null | undefined) {
  if (!t) return "—";
  const [hStr, mStr] = t.split(":");
  const h = Number(hStr);
  const m = Number(mStr);
  const ampm = h >= 12 ? "PM" : "AM";
  const hh = h % 12 === 0 ? 12 : h % 12;
  return `${hh}:${String(m).padStart(2, "0")} ${ampm}`;
}

/** Duration between start and close time in "Xh Ym" form (assumes same-day). */
function duration(start: string | null, close: string | null) {
  if (!start || !close) return "—";
  const sp = start.split(":").map(Number);
  const cp = close.split(":").map(Number);
  let mins = (cp[0] ?? 0) * 60 + (cp[1] ?? 0) - ((sp[0] ?? 0) * 60 + (sp[1] ?? 0));
  if (mins < 0) mins += 24 * 60; // crossed midnight
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}h ${m}m`;
}

function NotesPage() {
  const qc = useQueryClient();
  const { data: logs = [] } = useWorkLogs();
  const [date, setDate] = useState(todayISO());
  const [start, setStart] = useState("");
  const [close, setClose] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const byDate = useMemo(() => new Map(logs.map((l) => [l.date, l])), [logs]);
  const current = byDate.get(date);

  useEffect(() => {
    if (current) {
      setStart(current.start_time ?? "");
      setClose(current.close_time ?? "");
      setNote(current.note ?? "");
    } else {
      setStart("");
      setClose("");
      setNote("");
    }
  }, [current, date]);

  const save = async () => {
    if (!date) {
      toast.error("Please select a date!");
      return;
    }
    setBusy(true);
    try {
      const user_id = await currentUserId();
      const payload = {
        date,
        start_time: start || null,
        close_time: close || null,
        note: note.trim() || null,
      };
      if (current) {
        const { error } = await supabase
          .from("work_logs")
          .update(payload)
          .eq("id", current.id);
        if (error) throw error;
        toast.success("Note updated!");
      } else {
        const { error } = await supabase
          .from("work_logs")
          .insert({ ...payload, user_id });
        if (error) throw error;
        toast.success("Note saved!");
      }
      qc.invalidateQueries({ queryKey: ["work_logs"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!current) return;
    setBusy(true);
    try {
      const { error } = await supabase.from("work_logs").delete().eq("id", current.id);
      if (error) throw error;
      qc.invalidateQueries({ queryKey: ["work_logs"] });
      toast.success("Note deleted!");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  const clear = () => {
    setStart("");
    setClose("");
    setNote("");
  };

  return (
    <AppShell title="🗒️ Note Pad">
      <div className="surface space-y-4 p-4">
        <div className="space-y-1.5">
          <Label htmlFor="np-date">Date</Label>
          <Input
            id="np-date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="np-start">Start time</Label>
            <Input
              id="np-start"
              type="time"
              value={start}
              onChange={(e) => setStart(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="np-close">Close time</Label>
            <Input
              id="np-close"
              type="time"
              value={close}
              onChange={(e) => setClose(e.target.value)}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="np-note">Note (optional)</Label>
          <Textarea
            id="np-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="What work was done..."
            rows={3}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Button disabled={busy} onClick={save}>
            {current ? "Update note" : "Save note"}
          </Button>
          <Button
            variant="outline"
            disabled={busy || !current}
            onClick={remove}
          >
            Delete
          </Button>
        </div>
      </div>

      {current && (
        <div className="surface mt-4 p-4">
          <p className="text-sm text-muted-foreground">{hiDate(date)}</p>
          <div className="mt-2 grid grid-cols-3 gap-2 text-center">
            <div>
              <p className="text-xs text-muted-foreground">Started</p>
              <p className="num font-semibold">{fmtTime(current.start_time)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Closed</p>
              <p className="num font-semibold">{fmtTime(current.close_time)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Duration</p>
              <p className="num font-semibold">
                {duration(current.start_time, current.close_time)}
              </p>
            </div>
          </div>
          {current.note && (
            <p className="mt-3 rounded-lg bg-muted p-3 text-sm">{current.note}</p>
          )}
        </div>
      )}

      <div className="mt-6">
        <h2 className="mb-2 text-base font-semibold">Recent notes</h2>
        <div className="space-y-2">
          {logs.length === 0 && (
            <p className="text-sm text-muted-foreground">No notes yet.</p>
          )}
          {logs.slice(0, 15).map((l: WorkLog) => (
            <button
              key={l.id}
              onClick={() => setDate(l.date)}
              className={`surface flex w-full items-center justify-between p-3 text-left transition-colors ${
                l.date === date ? "ring-2 ring-primary" : ""
              }`}
            >
              <div>
                <p className="text-sm font-semibold">{hiDate(l.date)}</p>
                <p className="text-xs text-muted-foreground">
                  {fmtTime(l.start_time)} → {fmtTime(l.close_time)}
                  {" · "}
                  {duration(l.start_time, l.close_time)}
                </p>
              </div>
              {l.note && (
                <span className="ml-2 max-w-40 truncate text-xs text-muted-foreground">
                  {l.note}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
