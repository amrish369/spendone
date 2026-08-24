import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { AppShell } from "@/components/AppShell";
import { useTransactions, type Txn } from "@/lib/data";
import { hiDate, monthKey, monthLabel, todayISO } from "@/lib/format";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/export")({
  head: () => ({
    meta: [
      { title: "एक्सेल डाउनलोड – खर्च ट्रैकर" },
      { name: "description", content: "महीने या तारीख रेंज अनुसार खर्च डेटा एक्सेल में डाउनलोड करें।" },
      { property: "og:title", content: "एक्सेल डाउनलोड – खर्च ट्रैकर" },
      { property: "og:description", content: "अपना पूरा खर्च डेटा एक्सेल फाइल में लें।" },
    ],
  }),
  component: ExportPage,
});

function rows(list: Txn[]) {
  return list.map((t) => ({
    तारीख: hiDate(t.date),
    प्रकार: t.type === "expense" ? "खर्च" : "फंडिंग",
    श्रेणी: t.category,
    राशि: Number(t.amount),
    विवरण: t.description ?? "",
    स्रोत: t.source === "attendance" ? "हाज़िरी DA" : "मैनुअल",
  }));
}

function monthlySummary(list: Txn[]) {
  const map = new Map<string, { expense: number; income: number }>();
  list.forEach((t) => {
    const k = monthKey(t.date);
    const cur = map.get(k) ?? { expense: 0, income: 0 };
    if (t.type === "expense") cur.expense += Number(t.amount);
    else cur.income += Number(t.amount);
    map.set(k, cur);
  });
  return [...map.entries()].sort().map(([k, v]) => ({
    महीना: monthLabel(k),
    खर्च: v.expense,
    फंडिंग: v.income,
    बैलेंस: v.income - v.expense,
  }));
}

function categorySummary(list: Txn[]) {
  const map = new Map<string, { expense: number; income: number; count: number }>();
  list.forEach((t) => {
    const cur = map.get(t.category) ?? { expense: 0, income: 0, count: 0 };
    if (t.type === "expense") cur.expense += Number(t.amount);
    else cur.income += Number(t.amount);
    cur.count += 1;
    map.set(t.category, cur);
  });
  return [...map.entries()].map(([k, v]) => ({
    श्रेणी: k,
    खर्च: v.expense,
    फंडिंग: v.income,
    नेट: v.income - v.expense,
    एंट्री: v.count,
  }));
}

function download(sheets: { name: string; data: Record<string, unknown>[] }[], file: string) {
  if (sheets.every((s) => s.data.length === 0)) {
    toast.error("डाउनलोड के लिए कोई डेटा नहीं है!");
    return;
  }
  const wb = XLSX.utils.book_new();
  sheets.forEach((s) => XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(s.data), s.name));
  XLSX.writeFile(wb, file);
  toast.success("डाउनलोड शुरू हो गया!");
}

function ExportPage() {
  const { data: txns = [] } = useTransactions();
  const [month, setMonth] = useState(todayISO().slice(0, 7));
  const [from, setFrom] = useState(todayISO());
  const [to, setTo] = useState(todayISO());

  const monthTxns = txns.filter((t) => monthKey(t.date) === month);
  const rangeTxns = txns.filter((t) => t.date >= from && t.date <= to);

  return (
    <AppShell title="📥 एक्सेल डाउनलोड">
      <div className="surface space-y-3 p-4">
        <h2 className="text-base font-semibold">📅 महीना अनुसार</h2>
        <div className="space-y-1.5">
          <Label htmlFor="month">महीना चुनें</Label>
          <Input
            id="month"
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
          />
        </div>
        <p className="text-xs text-muted-foreground">{monthTxns.length} लेन-देन मिले</p>
        <div className="grid grid-cols-2 gap-3">
          <Button
            onClick={() =>
              download([{ name: "लेन-देन", data: rows(monthTxns) }], `transactions-${month}.xlsx`)
            }
          >
            लेन-देन डाउनलोड
          </Button>
          <Button
            variant="secondary"
            onClick={() =>
              download(
                [{ name: "श्रेणी सारांश", data: categorySummary(monthTxns) }],
                `summary-${month}.xlsx`,
              )
            }
          >
            सारांश डाउनलोड
          </Button>
        </div>
      </div>

      <div className="surface mt-4 space-y-3 p-4">
        <h2 className="text-base font-semibold">📆 तारीख रेंज अनुसार</h2>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="ef">कब से</Label>
            <Input id="ef" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="et">कब तक</Label>
            <Input id="et" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
        </div>
        <p className="text-xs text-muted-foreground">{rangeTxns.length} लेन-देन मिले</p>
        <Button
          className="w-full"
          onClick={() =>
            download([{ name: "लेन-देन", data: rows(rangeTxns) }], `transactions-${from}_${to}.xlsx`)
          }
        >
          रेंज डाउनलोड
        </Button>
      </div>

      <div className="surface mt-4 space-y-3 p-4">
        <h2 className="text-base font-semibold">📚 सभी डेटा</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <Button
            onClick={() =>
              download(
                [
                  { name: "लेन-देन", data: rows(txns) },
                  { name: "मासिक सारांश", data: monthlySummary(txns) },
                  { name: "श्रेणी सारांश", data: categorySummary(txns) },
                ],
                "expense-tracker-all.xlsx",
              )
            }
          >
            सभी शीट (एक फाइल)
          </Button>
          <Button
            variant="secondary"
            onClick={() => download([{ name: "लेन-देन", data: rows(txns) }], "transactions.xlsx")}
          >
            सिर्फ़ लेन-देन
          </Button>
          <Button
            variant="secondary"
            onClick={() =>
              download([{ name: "मासिक सारांश", data: monthlySummary(txns) }], "monthly.xlsx")
            }
          >
            मासिक सारांश
          </Button>
          <Button
            variant="secondary"
            onClick={() =>
              download([{ name: "श्रेणी सारांश", data: categorySummary(txns) }], "category.xlsx")
            }
          >
            श्रेणी सारांश
          </Button>
        </div>
      </div>
    </AppShell>
  );
}
