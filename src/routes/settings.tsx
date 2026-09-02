import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { useStaff, currentUserId, type Staff } from "@/lib/data";
import { STAFF_ROLES, categoryForRole } from "@/lib/constants";
import { money } from "@/lib/format";
import { useAuth } from "@/hooks/useAuth";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Trash2 } from "lucide-react";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Settings – Staff & DA – Expense Tracker" },
      { name: "description", content: "Set the daily allowance (DA) amount for each staff member." },
      { property: "og:title", content: "Settings – Staff & DA" },
      { property: "og:description", content: "Add staff members and set their DA value." },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const { data: staff = [] } = useStaff();
  const [name, setName] = useState("");
  const [role, setRole] = useState<string>("Staff");
  const [da, setDa] = useState("");
  const [salary, setSalary] = useState("");
  const [salaryType, setSalaryType] = useState<"monthly" | "daily">("monthly");
  const [bulkDa, setBulkDa] = useState("");
  const [bulkSalary, setBulkSalary] = useState("");
  const [confirmWipe, setConfirmWipe] = useState(false);
  const [wiping, setWiping] = useState(false);

  const refresh = () => qc.invalidateQueries({ queryKey: ["staff"] });

  const wipeAll = async () => {
    if (!confirmWipe) {
      setConfirmWipe(true);
      return;
    }
    setWiping(true);
    try {
      // Delete every table's rows for this user (RLS scopes to own rows).
      const tables = [
        "transactions",
        "attendance",
        "ledger_entries",
        "work_logs",
        "work_days",
        "customers",
        "categories",
        "staff",
      ] as const;
      for (const table of tables) {
        const { error } = await supabase
          .from(table)
          .delete()
          .neq("id", "00000000-0000-0000-0000-000000000000");
        if (error) throw error;
      }
      qc.clear();
      toast.success("All data cleared. Fresh start!");
      setConfirmWipe(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setWiping(false);
    }
  };

  const addStaff = async () => {
    if (!name.trim()) {
      toast.error("Name is required!");
      return;
    }
    const user_id = await currentUserId();
    const { error } = await supabase
      .from("staff")
      .insert({
        user_id,
        name: name.trim(),
        role,
        da_amount: Number(da) || 0,
        salary: Number(salary) || 0,
        salary_type: salaryType,
      });
    if (error) {
      toast.error(error.message);
      return;
    }
    setName("");
    setDa("");
    setSalary("");
    refresh();
    toast.success("Staff member added!");
  };

  const update = async (id: string, patch: Partial<Staff>) => {
    const { error } = await supabase.from("staff").update(patch).eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    refresh();
  };

  const remove = async (id: string) => {
    if (!confirm("Remove this staff member? Their attendance will be deleted too.")) return;
    const { error } = await supabase.from("staff").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    refresh();
    toast.success("Removed");
  };

  const applyBulk = async () => {
    const value = Number(bulkDa);
    if (!value) {
      toast.error("Enter a DA amount first!");
      return;
    }
    const { error } = await supabase
      .from("staff")
      .update({ da_amount: value })
      .neq("id", "00000000-0000-0000-0000-000000000000");
    if (error) {
      toast.error(error.message);
      return;
    }
    setBulkDa("");
    refresh();
    toast.success("DA updated for all staff!");
  };

  const applyBulkSalary = async () => {
    const value = Number(bulkSalary);
    if (!value) {
      toast.error("Enter a salary amount first!");
      return;
    }
    const { error } = await supabase
      .from("staff")
      .update({ salary: value })
      .neq("id", "00000000-0000-0000-0000-000000000000");
    if (error) {
      toast.error(error.message);
      return;
    }
    setBulkSalary("");
    refresh();
    toast.success("Salary updated for all staff!");
  };

  return (
    <AppShell title="⚙️ Settings">
      <div className="surface p-4">
        <p className="text-sm text-muted-foreground">Signed in as</p>
        <p className="font-medium">{user?.email}</p>
      </div>

      <h2 className="mt-6 mb-2 text-base font-semibold">➕ Add new staff</h2>
      <div className="surface space-y-3 p-4">
        <div className="space-y-1.5">
          <Label htmlFor="sname">Name</Label>
          <Input
            id="sname"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Ramesh Kumar"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="srole">Type</Label>
            <select
              id="srole"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              {STAFF_ROLES.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sda">DA amount (₹/day)</Label>
            <Input
              id="sda"
              type="number"
              inputMode="decimal"
              value={da}
              onChange={(e) => setDa(e.target.value)}
              placeholder="0"
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="ssaltype">Salary type</Label>
            <select
              id="ssaltype"
              value={salaryType}
              onChange={(e) => setSalaryType(e.target.value as "monthly" | "daily")}
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="monthly">Monthly</option>
              <option value="daily">Per day</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ssal">
              {salaryType === "daily" ? "Salary (₹/day)" : "Salary (₹/month)"}
            </Label>
            <Input
              id="ssal"
              type="number"
              inputMode="decimal"
              value={salary}
              onChange={(e) => setSalary(e.target.value)}
              placeholder="0"
            />
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          DA is added automatically as an expense under "{categoryForRole(role)}" when attendance is
          marked. Salary is a separate monthly base used by the salary calculator.
        </p>
        <Button onClick={addStaff} className="w-full">
          Add staff
        </Button>
      </div>

      <h2 className="mt-6 mb-2 text-base font-semibold">💵 Set DA for everyone at once</h2>
      <div className="surface flex gap-2 p-4">
        <Input
          type="number"
          value={bulkDa}
          onChange={(e) => setBulkDa(e.target.value)}
          placeholder="e.g. 300"
        />
        <Button variant="secondary" onClick={applyBulk}>
          Apply
        </Button>
      </div>

      <h2 className="mt-6 mb-2 text-base font-semibold">🧾 Set salary for everyone at once</h2>
      <div className="surface flex gap-2 p-4">
        <Input
          type="number"
          value={bulkSalary}
          onChange={(e) => setBulkSalary(e.target.value)}
          placeholder="e.g. 12000"
        />
        <Button variant="secondary" onClick={applyBulkSalary}>
          Apply
        </Button>
      </div>


      <h2 className="mt-6 mb-2 text-base font-semibold">👥 Staff list</h2>
      <div className="space-y-3">
        {staff.length === 0 && <p className="text-sm text-muted-foreground">No staff yet.</p>}
        {staff.map((s) => (
          <div key={s.id} className="surface p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate font-semibold">{s.name}</p>
                <p className="text-xs text-muted-foreground">
                  DA {money(Number(s.da_amount))}/day · Salary {money(Number(s.salary ?? 0))}
                  {s.salary_type === "daily" ? "/day" : "/month"}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={s.active}
                  onCheckedChange={(v) => update(s.id, { active: v })}
                  aria-label="Active"
                />
                <button onClick={() => remove(s.id)} aria-label="Remove">
                  <Trash2 className="size-4 text-destructive" />
                </button>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">DA amount</Label>
                <Input
                  type="number"
                  defaultValue={s.da_amount}
                  onBlur={(e) => {
                    const v = Number(e.target.value) || 0;
                    if (v !== Number(s.da_amount)) update(s.id, { da_amount: v });
                  }}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Salary type</Label>
                <select
                  value={s.salary_type === "daily" ? "daily" : "monthly"}
                  onChange={(e) =>
                    update(s.id, { salary_type: e.target.value as "monthly" | "daily" })
                  }
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="monthly">Monthly</option>
                  <option value="daily">Per day</option>
                </select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">
                  {s.salary_type === "daily" ? "Salary (₹/day)" : "Salary (₹/month)"}
                </Label>
                <Input
                  type="number"
                  defaultValue={s.salary ?? 0}
                  onBlur={(e) => {
                    const v = Number(e.target.value) || 0;
                    if (v !== Number(s.salary ?? 0)) update(s.id, { salary: v });
                  }}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Type</Label>
                <select
                  value={s.role}
                  onChange={(e) => update(s.id, { role: e.target.value })}
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  {STAFF_ROLES.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        ))}
      </div>

      <h2 className="mt-8 mb-2 text-base font-semibold text-destructive">⚠️ Danger zone</h2>
      <div className="surface border-destructive/40 p-4">
        <p className="text-sm font-semibold">Clear all data</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Permanently deletes ALL your transactions, attendance, staff, customers, ledger entries,
          categories, work logs and calendar marks. This cannot be undone.
        </p>
        <Button
          variant="destructive"
          className="mt-3 w-full"
          disabled={wiping}
          onClick={wipeAll}
        >
          {wiping
            ? "Clearing…"
            : confirmWipe
              ? "⚠️ Tap again to permanently delete everything"
              : "🗑️ Clear all data"}
        </Button>
        {confirmWipe && !wiping && (
          <Button
            variant="ghost"
            className="mt-2 w-full"
            onClick={() => setConfirmWipe(false)}
          >
            Cancel
          </Button>
        )}
      </div>
    </AppShell>
  );
}
