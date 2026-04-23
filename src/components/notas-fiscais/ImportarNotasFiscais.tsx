import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Upload, AlertTriangle, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/modules/auth/hooks/useAuth";
import { useClinic } from "@/modules/clinic/hooks/useClinic";
import { supabase } from "@/integrations/supabase/client";
import {
  notasFiscaisService,
  BatchImportItem,
  PacienteMatchCandidate,
} from "@/modules/finance/services/notasFiscaisService";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

function currentMesRef() {
  const d = new Date();
  return `${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

export const ImportarNotasFiscais = () => {
  const { user } = useAuth();
  const { activeClinicId } = useClinic();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [mesRef, setMesRef] = useState(currentMesRef());
  const [items, setItems] = useState<BatchImportItem[]>([]);
  const [processing, setProcessing] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const { data: pacientes = [] } = useQuery<PacienteMatchCandidate[]>({
    queryKey: ["pacientes-match", activeClinicId],
    queryFn: async () => {
      if (!activeClinicId) return [];
      const { data: links } = await supabase
        .from("clinic_pacientes")
        .select("paciente_id")
        .eq("clinic_id", activeClinicId);
      const ids = (links || []).map((l: any) => l.paciente_id);
      if (ids.length === 0) return [];
      const { data } = await supabase
        .from("pacientes")
        .select("id, nome, cpf")
        .in("id", ids);
      return (data || []) as any;
    },
    enabled: open && !!activeClinicId,
  });

  const handleFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []).filter((f) =>
      f.name.toLowerCase().endsWith(".pdf")
    );
    if (files.length === 0 || !activeClinicId) return;
    setProcessing(true);
    try {
      const prepared = await notasFiscaisService.prepareBatch(
        files,
        pacientes,
        activeClinicId
      );
      setItems(prepared);
    } catch (e: any) {
      toast.error("Erro ao processar arquivos: " + e.message);
    } finally {
      setProcessing(false);
    }
  };

  const updateMatch = (idx: number, pacienteId: string) => {
    setItems((prev) =>
      prev.map((it, i) =>
        i === idx
          ? {
              ...it,
              matchedPacienteId: pacienteId || null,
              matchStatus: pacienteId ? "matched" : "not_found",
            }
          : it
      )
    );
  };

  const handleConfirm = async () => {
    if (!activeClinicId || !user) return;
    if (!/^\d{2}\/\d{4}$/.test(mesRef)) {
      toast.error("Mês de referência inválido. Use MM/AAAA.");
      return;
    }
    const ready = items.filter((it) => it.matchedPacienteId && !it.duplicate);
    if (ready.length === 0) {
      toast.error("Nenhum arquivo pronto para importar.");
      return;
    }
    setSubmitting(true);
    try {
      const result = await notasFiscaisService.commitBatch({
        clinicId: activeClinicId,
        mesReferencia: mesRef,
        uploadedBy: user.id,
        items: ready,
      });
      toast.success(
        `${result.success} nota(s) importada(s).` +
          (result.failed ? ` ${result.failed} falhou.` : "")
      );
      if (result.errors.length) console.warn(result.errors);
      queryClient.invalidateQueries({ queryKey: ["notas-fiscais"] });
      setOpen(false);
      setItems([]);
    } catch (e: any) {
      toast.error("Erro: " + e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const stats = {
    matched: items.filter((i) => i.matchStatus === "matched" && !i.duplicate).length,
    conflict: items.filter((i) => i.matchStatus === "conflict").length,
    notFound: items.filter((i) => i.matchStatus === "not_found").length,
    duplicate: items.filter((i) => i.duplicate).length,
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Upload className="h-4 w-4 mr-2" />
          Importar notas em lote
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Importação em lote de notas fiscais</DialogTitle>
          <DialogDescription>
            Selecione vários PDFs. O sistema tenta vincular cada arquivo ao paciente
            pelo nome do arquivo (nome ou CPF).
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 sm:grid-cols-[180px_1fr] gap-3 items-end">
          <div>
            <Label htmlFor="mes-batch">Mês ref. (MM/AAAA)</Label>
            <Input
              id="mes-batch"
              value={mesRef}
              onChange={(e) => setMesRef(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="files-batch">Arquivos PDF</Label>
            <Input
              id="files-batch"
              type="file"
              multiple
              accept="application/pdf,.pdf"
              onChange={handleFiles}
              disabled={processing}
            />
          </div>
        </div>

        {processing && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Analisando arquivos...
          </div>
        )}

        {items.length > 0 && (
          <>
            <div className="flex flex-wrap gap-2 text-xs">
              <Badge className="bg-emerald-500 hover:bg-emerald-500">
                ✓ {stats.matched} vinculados
              </Badge>
              {stats.conflict > 0 && (
                <Badge className="bg-amber-500 hover:bg-amber-500">
                  ⚠ {stats.conflict} conflitos
                </Badge>
              )}
              {stats.notFound > 0 && (
                <Badge variant="destructive">✗ {stats.notFound} não identificados</Badge>
              )}
              {stats.duplicate > 0 && (
                <Badge variant="secondary">↻ {stats.duplicate} duplicados</Badge>
              )}
            </div>

            <div className="border rounded-lg divide-y max-h-[400px] overflow-y-auto">
              {items.map((it, idx) => (
                <div key={idx} className="p-3 flex flex-col sm:flex-row gap-2 sm:items-center">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      {it.duplicate ? (
                        <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
                      ) : it.matchStatus === "matched" ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                      ) : it.matchStatus === "conflict" ? (
                        <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
                      ) : (
                        <XCircle className="h-4 w-4 text-destructive shrink-0" />
                      )}
                      <span className="text-sm font-medium truncate">{it.file.name}</span>
                    </div>
                    {it.duplicate && (
                      <p className="text-xs text-amber-600 mt-1 ml-6">
                        Já importada anteriormente (mesmo conteúdo).
                      </p>
                    )}
                  </div>
                  <Select
                    value={it.matchedPacienteId || ""}
                    onValueChange={(v) => updateMatch(idx, v)}
                    disabled={it.duplicate}
                  >
                    <SelectTrigger className="w-full sm:w-64">
                      <SelectValue placeholder="Selecione paciente" />
                    </SelectTrigger>
                    <SelectContent>
                      {(it.candidates.length > 0 ? it.candidates : pacientes).map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.nome}
                          {p.cpf ? ` — ${p.cpf}` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
          </>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={submitting}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm} disabled={submitting || items.length === 0}>
            {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Importar {stats.matched > 0 ? `(${stats.matched})` : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
