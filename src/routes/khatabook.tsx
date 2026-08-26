import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { AppShell, Stat } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { useCustomers, useLedgerEntries, currentUserId } from "@/lib/data";
import { money, todayISO, hiDate } from "@/lib/format";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ArrowLeft, Trash2 } from "lucide-react";

export const Route = createFileRoute("/khatabook")({
  head: () => ({
    meta: [
      { title: "Ledger – Customer Accounts" },
      { name: "description", content: "Customer ledger: how much you gave, took and the outstanding balance." },
      { property: "og:title", content: "Ledger – Customer Accounts" },
      { property: "og:description", content: "Keep a full credit and payment record for every customer." },
    ],
  }),
  component: KhatabookPage,
});

function KhatabookPage() {
  const qc = useQueryClient();
  const { data: customers = [] } = useCustomers();
  const { data: entries = [] } = useLedgerEntries();
  const [openId, setOpenId] = useState<string | null>(null);

  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");

  const balances = useMemo(() => {
    const map = new Map<string, number>();
    entries.forEach((e) => {
      const sign = e.type === "given" ? 1 : -1;
      map.set(e.customer_id, (map.get(e.customer_id) ?? 0) + sign * Number(e.amount));
    });
    return map;
  }, [entries]);

  const totals = useMemo(() => {
    let receive = 0;
    let pay = 0;
    balances.forEach((v) => (v >= 0 ? (receive += v) : (pay += -v)));
    return { receive, pay };
  }, [balances]);

  const addCustomer = async () => {
    if (!newName.trim()) {
      toast.error("Name is required!");
      return;
    }
    const user_id = await currentUserId();
    const { error } = await supabase
      .from("customers")
      .insert({ user_id, name: newName.trim(), phone: newPhone.trim() || null });
    if (error) {
      toast.error(error.message);
      return;
    }
    setNewName("");
    setNewPhone("");
    qc.invalidateQueries({ queryKey: ["customers"] });
    toast.success("Customer added!");
  };

  const active = customers.find((c) => c.id === openId);

  if (active) {
    return (
      <CustomerLedger
        customerId={active.id}
        name={active.name}
        phone={active.phone}
        onBack={() => setOpenId(null)}
      />
    );
  }

  return (
    <AppShell title="📒 Ledger">
      <div className="grid grid-cols-2 gap-3">
        <Stat label="Total to receive" value={money(totals.receive)} tone="income" />
        <Stat label="Total to pay" value={money(totals.pay)} tone="expense" />
      </div>

      <div className="mt-4 flex items-center justify-between">
        <h2 className="text-base font-semibold">Customers</h2>
        <Dialog>
          <DialogTrigger asChild>
            <Button size="sm">➕ New customer</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add a new customer</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="cname">Name</Label>
                <Input
                  id="cname"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="John Doe"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cphone">Phone</Label>
                <Input
                  id="cphone"
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  placeholder="9876543210"
                />
              </div>
              <Button className="w-full" onClick={addCustomer}>
                Save
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="surface mt-3 divide-y">
        {customers.length === 0 && (
          <p className="p-4 text-sm text-muted-foreground">No customers yet.</p>
        )}
        {customers.map((c) => {
          const bal = balances.get(c.id) ?? 0;
          return (
            <button
              key={c.id}
              onClick={() => setOpenId(c.id)}
              className="flex w-full items-center justify-between p-3 text-left transition-colors hover:bg-muted"
            >
              <div>
                <p className="font-medium">{c.name}</p>
                {c.phone && <p className="text-xs text-muted-foreground">{c.phone}</p>}
              </div>
              <span
                className={`num text-sm font-bold ${bal >= 0 ? "text-success" : "text-destructive"}`}
              >
                {bal >= 0 ? "To receive" : "To pay"} {money(Math.abs(bal))}
              </span>
            </button>
          );
        })}
      </div>
    </AppShell>
  );
}

function CustomerLedger({
  customerId,
  name,
  phone,
  onBack,
}: {
  customerId: string;
  name: string;
  phone: string | null;
  onBack: () => void;
}) {
  const qc = useQueryClient();
  const { data: entries = [] } = useLedgerEntries(customerId);
  const [date, setDate] = useState(todayISO());
  const [type, setType] = useState<"given" | "taken">("given");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");

  const given = entries.filter((e) => e.type === "given").reduce((s, e) => s + Number(e.amount), 0);
  const taken = entries.filter((e) => e.type === "taken").reduce((s, e) => s + Number(e.amount), 0);
  const balance = given - taken;

  const add = async () => {
    if (!amount) {
      toast.error("Amount is required!");
      return;
    }
    const user_id = await currentUserId();
    const { error } = await supabase.from("ledger_entries").insert({
      user_id,
      customer_id: customerId,
      date,
      type,
      amount: Number(amount),
      note: note || null,
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    setAmount("");
    setNote("");
    qc.invalidateQueries({ queryKey: ["ledger"] });
    toast.success("Entry added!");
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("ledger_entries").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    qc.invalidateQueries({ queryKey: ["ledger"] });
  };

  const reminder = () => {
    const text = `Hello ${name}, your outstanding balance is ₹${Math.abs(balance)}. Please make the payment. Thank you.`;
    const num = (phone ?? "").replace(/\D/g, "");
    window.open(
      `https://wa.me/${num ? "91" + num.slice(-10) : ""}?text=${encodeURIComponent(text)}`,
      "_blank",
    );
  };

  return (
    <AppShell title={`📒 ${name}`}>
      <div className="flex items-center justify-between">
        <Button variant="outline" size="sm" onClick={onBack}>
          <ArrowLeft className="mr-1 size-4" /> Back
        </Button>
        <Button size="sm" variant="secondary" onClick={reminder}>
          📲 Send reminder
        </Button>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-3">
        <Stat label="Given" value={money(given)} tone="income" />
        <Stat label="Taken" value={money(taken)} tone="expense" />
        <Stat
          label={balance >= 0 ? "To receive" : "To pay"}
          value={money(Math.abs(balance))}
          tone="balance"
        />
      </div>

      <div className="surface mt-4 space-y-3 p-4">
        <h3 className="text-base font-semibold">New entry</h3>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="ldate">Date</Label>
            <Input
              id="ldate"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ltype">Type</Label>
            <select
              id="ltype"
              value={type}
              onChange={(e) => setType(e.target.value as "given" | "taken")}
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="given">I gave</option>
              <option value="taken">I took</option>
            </select>
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="lamt">Amount (₹)</Label>
          <Input
            id="lamt"
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="lnote">Note</Label>
          <Input
            id="lnote"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Optional"
          />
        </div>
        <Button className="w-full" onClick={add}>
          Add entry
        </Button>
      </div>

      <h3 className="mt-6 mb-2 text-base font-semibold">Previous entries</h3>
      <div className="surface divide-y">
        {entries.length === 0 && (
          <p className="p-4 text-sm text-muted-foreground">No entries yet.</p>
        )}
        {entries.map((e) => (
          <div key={e.id} className="flex items-center justify-between gap-3 p-3">
            <div className="min-w-0">
              <p className="text-sm">{hiDate(e.date)}</p>
              {e.note && <p className="truncate text-xs text-muted-foreground">{e.note}</p>}
            </div>
            <span
              className={`num text-sm font-bold ${
                e.type === "given" ? "text-success" : "text-destructive"
              }`}
            >
              {e.type === "given" ? "Given" : "Taken"} {money(Number(e.amount))}
            </span>
            <button onClick={() => remove(e.id)} aria-label="Delete">
              <Trash2 className="size-4 text-destructive" />
            </button>
          </div>
        ))}
      </div>
    </AppShell>
  );
}
