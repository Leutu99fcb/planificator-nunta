import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { FileSpreadsheet, FolderOpen, LogOut, Plus } from "lucide-react";
import { pickerConfigured } from "../lib/config";
import type { GoogleUser } from "../lib/google/auth";
import { pickSpreadsheet } from "../lib/google/picker";
import { createPlanner, findPlanners } from "../lib/google/setup";
import { formatDate } from "../lib/dates";
import { useFeedback } from "../components/feedback";
import { Button, Card, Field, Input, Spinner } from "../components/ui";

// După login: deschide un planificator existent, creează unul nou sau alege
// (o singură dată) planificatorul primit de la partener.

export function Chooser({ user, onOpen, onLeave }: { user: GoogleUser; onOpen: (id: string) => void; onLeave: () => void }) {
  const { toast } = useFeedback();
  const planners = useQuery({ queryKey: ["planners", user.email], queryFn: findPlanners });
  const [form, setForm] = useState({ partener1: user.name.split(" ")[0] ?? "", partener2: "", dataNunta: "" });
  const [busy, setBusy] = useState<"create" | "pick" | null>(null);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy("create");
    try {
      const id = await createPlanner(form);
      toast("Planificatorul a fost creat în Drive-ul tău");
      onOpen(id);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Nu am putut crea planificatorul", "error");
      setBusy(null);
    }
  };

  const pick = async () => {
    setBusy("pick");
    try {
      const id = await pickSpreadsheet();
      if (id) onOpen(id);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Alegerea a eșuat", "error");
    } finally {
      setBusy(null);
    }
  };

  const list = planners.data ?? [];

  return (
    <div className="min-h-screen px-4 py-10">
      <div className="mx-auto max-w-xl space-y-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="font-serif text-2xl font-semibold">Bun venit!</h1>
            <p className="text-sm text-muted">Conectat ca {user.email}</p>
          </div>
          <Button variant="ghost" size="sm" icon={<LogOut className="h-4 w-4" />} onClick={onLeave}>
            Ieși
          </Button>
        </div>

        {planners.isPending ? (
          <Card className="flex items-center gap-3 p-5 text-sm text-muted">
            <Spinner /> Caut planificatoarele tale…
          </Card>
        ) : planners.isError ? (
          <Card className="p-5 text-sm text-danger-ink">{planners.error.message}</Card>
        ) : (
          list.length > 0 && (
            <Card className="p-5">
              <h2 className="mb-3 font-medium">Planificatoarele tale</h2>
              <div className="space-y-2">
                {list.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => onOpen(f.id)}
                    className="flex w-full items-center gap-3 rounded-lg border border-border p-3 text-left hover:bg-surface-2"
                  >
                    <FileSpreadsheet className="h-5 w-5 shrink-0 text-success-ink" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{f.name}</span>
                      <span className="block text-xs text-muted">
                        {f.ownedByMe ? "creat de tine" : `partajat de ${f.owners?.[0]?.displayName ?? f.owners?.[0]?.emailAddress ?? "partener"}`}
                        {f.modifiedTime && ` · modificat ${formatDate(f.modifiedTime.slice(0, 10))}`}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            </Card>
          )
        )}

        <Card className="p-5">
          <h2 className="font-medium">Creează planificatorul</h2>
          <p className="mb-4 text-sm text-muted">Facem un Google Sheet nou în Drive-ul tău. Restul detaliilor le poți completa oricând.</p>
          <form onSubmit={create} className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Numele tău">
                <Input value={form.partener1} onChange={(e) => setForm({ ...form, partener1: e.target.value })} required />
              </Field>
              <Field label="Numele partenerului">
                <Input value={form.partener2} onChange={(e) => setForm({ ...form, partener2: e.target.value })} />
              </Field>
            </div>
            <Field label="Data nunții" hint="Opțional, o poți schimba din Setări.">
              <Input type="date" value={form.dataNunta} onChange={(e) => setForm({ ...form, dataNunta: e.target.value })} />
            </Field>
            <Button type="submit" variant="primary" className="w-full" disabled={!!busy} icon={busy === "create" ? <Spinner /> : <Plus className="h-4 w-4" />}>
              Creează planificatorul
            </Button>
          </form>
        </Card>

        <Card className="p-5">
          <h2 className="font-medium">Ți-a trimis partenerul un planificator?</h2>
          <p className="mb-4 text-sm text-muted">
            Alege-l o singură dată din Google Drive. Aplicația primește acces doar la fișierul pe care îl alegi.
          </p>
          <Button className="w-full" onClick={pick} disabled={!!busy || !pickerConfigured} icon={busy === "pick" ? <Spinner /> : <FolderOpen className="h-4 w-4" />}>
            Deschide planificator partajat
          </Button>
          {!pickerConfigured && <p className="mt-2 text-xs text-warning-ink">Alegerea din Drive nu e configurată pe acest site.</p>}
        </Card>
      </div>
    </div>
  );
}
