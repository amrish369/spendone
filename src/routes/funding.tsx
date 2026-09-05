import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { useTransactions } from "@/lib/data";
import { cleanCategory, shortDate, todayISO } from "@/lib/format";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/funding")({
  head: () => ({
    meta: [
      { title: "Message Generator – Expense Tracker" },
      {
        name: "description",
        content: "Pick a date range, build an expense summary message and send it on WhatsApp.",
      },
      { property: "og:title", content: "Message Generator – Expense Tracker" },
      { property: "og:description", content: "Create an expense summary message and share it on WhatsApp." },
    ],
  }),
  component: FundingPage,
});

function FundingPage() {
  const { data: txns = [] } = useTransactions();
  const [from, setFrom] = useState(todayISO());
  const [to, setTo] = useState(todayISO());
  const [pending, setPending] = useState("");
  const [autoPending, setAutoPending] = useState(true);
  const [message, setMessage] = useState("");
  const [noData, setNoData] = useState(false);

  const carryForward = useMemo(() => {
    if (!from) return 0;
    const before = txns.filter((t) => t.date < from);
    const fundingBefore = before
      .filter((t) => t.type === "funding")
      .reduce((s, t) => s + Number(t.amount), 0);
    const expenseBefore = before
      .filter((t) => t.type === "expense")
      .reduce((s, t) => s + Number(t.amount), 0);
    return fundingBefore - expenseBefore;
  }, [txns, from]);

  useEffect(() => {
    if (!autoPending) return;
    setPending(String(carryForward));
  }, [carryForward, autoPending]);

  const generate = () => {
    if (!from || !to) {
      toast.error("Please pick a date range!");
      return;
    }
    if (from > to) {
      toast.error('"From" date must be before "To" date!');
      return;
    }
    const filtered = txns.filter((t) => t.date >= from && t.date <= to);
    const expenses = filtered.filter((t) => t.type === "expense");
    const fundings = filtered.filter((t) => t.type === "funding");
    if (filtered.length === 0) {
      setMessage("");
      setNoData(true);
      return;
    }

    const grouped = new Map<string, typeof expenses>();
    expenses.forEach((t) => {
      const list = grouped.get(t.date) ?? [];
      list.push(t);
      grouped.set(t.date, list);
    });

    let out = `Expense report\n${shortDate(from)} to ${shortDate(to)}\n\n`;
    [...grouped.keys()].sort().forEach((date) => {
      out += `${shortDate(date)}\n`;
      const day = grouped.get(date)!;
      day.forEach((t) => {
        let line = `${cleanCategory(t.category)} = ${Number(t.amount)}`;
        if (t.description?.trim()) line += ` (${t.description.trim()})`;
        out += line + "\n";
      });
      out += `Day Total = ${day.reduce((s, t) => s + Number(t.amount), 0)}\n\n`;
    });

    const grand = expenses.reduce((s, t) => s + Number(t.amount), 0);
    const fundingTotal = fundings.reduce((s, t) => s + Number(t.amount), 0);
    const opening = parseFloat(pending) || 0;

    out += `Total Expense = ${grand}\n`;
    out += `Balance remaining = ${opening + fundingTotal - grand}\n`;

    setMessage(out);
    setNoData(false);
  };

  return (
    <AppShell title="💬 Message Generator">
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
        <div className="space-y-1.5">
          <Label htmlFor="pending">Previous balance (₹)</Label>
          <Input
            id="pending"
            type="number"
            value={pending}
            onChange={(e) => {
              setAutoPending(false);
              setPending(e.target.value);
            }}
            placeholder="0"
          />
          <p className="text-xs text-muted-foreground">
            {autoPending
              ? `Auto-filled from all funding minus expenses before ${from || "the start date"}.`
              : "Manually edited."}
            {!autoPending && (
              <button
                type="button"
                className="ml-2 underline"
                onClick={() => {
                  setAutoPending(true);
                  setPending(String(carryForward));
                }}
              >
                Use auto value
              </button>
            )}
          </p>
        </div>
        <Button className="w-full" onClick={generate}>
          Generate message
        </Button>
      </div>

      {noData && (
        <p className="mt-4 text-center text-sm text-muted-foreground">
          No data found in this date range.
        </p>
      )}

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
