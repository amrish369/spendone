import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
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
      { title: "मैसेज जनरेटर – खर्च ट्रैकर" },
      {
        name: "description",
        content: "तारीख रेंज चुनकर खर्च का हिसाब मैसेज बनाएं और व्हाट्सएप पर भेजें।",
      },
      { property: "og:title", content: "मैसेज जनरेटर – खर्च ट्रैकर" },
      { property: "og:description", content: "खर्च का हिसाब मैसेज बनाकर व्हाट्सएप पर भेजें।" },
    ],
  }),
  component: FundingPage,
});

function FundingPage() {
  const { data: txns = [] } = useTransactions();
  const [from, setFrom] = useState(todayISO());
  const [to, setTo] = useState(todayISO());
  const [pending, setPending] = useState("");
  const [message, setMessage] = useState("");
  const [noData, setNoData] = useState(false);

  const generate = () => {
    if (!from || !to) {
      toast.error("कृपया तारीख रेंज चुनें!");
      return;
    }
    if (from > to) {
      toast.error('"कब से" तारीख "कब तक" से पहले होनी चाहिए!');
      return;
    }
    const filtered = txns.filter((t) => t.date >= from && t.date <= to);
    if (filtered.length === 0) {
      setMessage("");
      setNoData(true);
      return;
    }

    const grouped = new Map<string, typeof filtered>();
    filtered.forEach((t) => {
      const list = grouped.get(t.date) ?? [];
      list.push(t);
      grouped.set(t.date, list);
    });

    let out = "";
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

    const grand = filtered.reduce((s, t) => s + Number(t.amount), 0);
    out += `Grand Total = ${grand}\n`;
    const pend = parseFloat(pending) || 0;
    const total = pend + grand;
    if (pend > 0 || total > 0) {
      out += `Pending = ${pend}\nTotal = ${total}\n`;
    }
    setMessage(out);
    setNoData(false);
  };

  return (
    <AppShell title="💬 मैसेज जनरेटर">
      <div className="surface space-y-3 p-4">
        <h2 className="text-base font-semibold">📅 तारीख रेंज चुनें</h2>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="from">कब से</Label>
            <Input id="from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="to">कब तक</Label>
            <Input id="to" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="pending">पेंडिंग राशि (₹)</Label>
          <Input
            id="pending"
            type="number"
            value={pending}
            onChange={(e) => setPending(e.target.value)}
            placeholder="0"
          />
        </div>
        <Button className="w-full" onClick={generate}>
          मैसेज जनरेट करें
        </Button>
      </div>

      {noData && (
        <p className="mt-4 text-center text-sm text-muted-foreground">
          इस तारीख रेंज में कोई डेटा नहीं मिला।
        </p>
      )}

      {message && (
        <div className="surface mt-4 p-4">
          <h3 className="mb-2 text-base font-semibold">जनरेटेड मैसेज</h3>
          <pre className="num max-h-96 overflow-auto whitespace-pre-wrap rounded-lg bg-muted p-3 text-sm">
            {message}
          </pre>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <Button
              variant="outline"
              onClick={() => {
                navigator.clipboard.writeText(message);
                toast.success("मैसेज कॉपी हो गया!");
              }}
            >
              📋 कॉपी करें
            </Button>
            <Button
              className="bg-success text-success-foreground hover:bg-success/90"
              onClick={() =>
                window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, "_blank")
              }
            >
              📲 व्हाट्सएप
            </Button>
          </div>
        </div>
      )}
    </AppShell>
  );
}
