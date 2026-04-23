import { useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Upload,
  FileText,
  Trash2,
  Download,
  Link as LinkIcon,
  Send,
  Loader2,
  Copy,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/modules/auth/hooks/useAuth";
import { useClinic } from "@/modules/clinic/hooks/useClinic";
import { notasFiscaisService, NotaFiscal } from "@/modules/finance/services/notasFiscaisService";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  pacienteId: string;
  pacienteNome?: string;
  pacienteWhatsapp?: string | null;
}

function formatSize(bytes: number | null) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function currentMesRef() {
  const d = new Date();
  return `${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

export const NotasFiscaisPaciente = ({ pacienteId, pacienteNome, pacienteWhatsapp }: Props) => {
  const { user } = useAuth();
  const { activeClinicId } = useClinic();
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [mesRef, setMesRef] = useState(currentMesRef());
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [linkDialog, setLinkDialog] = useState<{ url: string; nota: NotaFiscal } | null>(null);

  const { data: notas = [], isLoading } = useQuery({
    queryKey: ["notas-fiscais", pacienteId],
    queryFn: () => notasFiscaisService.listByPaciente(pacienteId),
    enabled: !!pacienteId,
  });

  const deleteMutation = useMutation({
    mutationFn: (n: NotaFiscal) => notasFiscaisService.deleteNota(n),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notas-fiscais", pacienteId] });
      toast.success("Nota fiscal removida.");
      setDeletingId(null);
    },
    onError: (e: any) => toast.error("Erro ao remover: " + e.message),
  });

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !user || !activeClinicId) return;
    if (!/^\d{2}\/\d{4}$/.test(mesRef)) {
      toast.error("Mês de referência inválido. Use MM/AAAA.");
      return;
    }
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        await notasFiscaisService.uploadSingle({
          clinicId: activeClinicId,
          pacienteId,
          file,
          mesReferencia: mesRef,
          uploadedBy: user.id,
        });
      }
      queryClient.invalidateQueries({ queryKey: ["notas-fiscais", pacienteId] });
      toast.success("Nota fiscal anexada com sucesso!");
    } catch (e: any) {
      toast.error(e.message || "Erro no upload.");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const handleDownload = async (n: NotaFiscal) => {
    try {
      const url = await notasFiscaisService.getSignedUrl(n.arquivo_path, 120);
      window.open(url, "_blank");
    } catch {
      toast.error("Erro ao gerar download.");
    }
  };

  const handleGenerateLink = async (n: NotaFiscal) => {
    try {
      const url = await notasFiscaisService.generatePublicLink(n.id, 7);
      await notasFiscaisService.markSent(n.id, "link");
      queryClient.invalidateQueries({ queryKey: ["notas-fiscais", pacienteId] });
      setLinkDialog({ url, nota: n });
    } catch {
      toast.error("Erro ao gerar link.");
    }
  };

  const handleSendWhatsapp = async (n: NotaFiscal) => {
    if (!pacienteWhatsapp) {
      toast.error("Paciente não possui WhatsApp cadastrado.");
      return;
    }
    try {
      const url =
        n.public_token &&
        n.public_token_expires_at &&
        new Date(n.public_token_expires_at) > new Date()
          ? `${window.location.origin}/nota-fiscal/${n.public_token}`
          : await notasFiscaisService.generatePublicLink(n.id, 7);
      await notasFiscaisService.markSent(n.id, "whatsapp");
      queryClient.invalidateQueries({ queryKey: ["notas-fiscais", pacienteId] });
      const phone = pacienteWhatsapp.replace(/\D/g, "");
      const msg = encodeURIComponent(
        `Olá ${pacienteNome || ""}, segue sua nota fiscal referente a ${n.mes_referencia}. Acesse: ${url}`
      );
      window.open(`https://wa.me/${phone}?text=${msg}`, "_blank");
    } catch {
      toast.error("Erro ao enviar via WhatsApp.");
    }
  };

  const notaToDelete = notas.find((n) => n.id === deletingId);
  const grouped = notas.reduce<Record<string, NotaFiscal[]>>((acc, n) => {
    (acc[n.mes_referencia] ||= []).push(n);
    return acc;
  }, {});

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" /> Notas Fiscais
        </CardTitle>
        <CardDescription>
          Anexe e gerencie as notas fiscais (PDF) do paciente, organizadas por mês.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-[160px_1fr_auto] gap-2 items-end">
          <div>
            <Label htmlFor="mes-ref">Mês ref. (MM/AAAA)</Label>
            <Input
              id="mes-ref"
              value={mesRef}
              onChange={(e) => setMesRef(e.target.value)}
              placeholder="MM/AAAA"
            />
          </div>
          <div className="text-xs text-muted-foreground">
            Selecione o mês de referência antes de anexar a nota.
          </div>
          <div>
            <input
              ref={fileRef}
              type="file"
              accept="application/pdf,.pdf"
              multiple
              className="hidden"
              onChange={handleUpload}
            />
            <Button
              onClick={() => fileRef.current?.click()}
              disabled={uploading || !activeClinicId}
              className="w-full sm:w-auto"
            >
              {uploading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Upload className="h-4 w-4 mr-2" />
              )}
              {uploading ? "Enviando..." : "Anexar PDF"}
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="text-center py-6 text-muted-foreground text-sm animate-pulse">
            Carregando...
          </div>
        ) : notas.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground border-2 border-dashed rounded-lg">
            <FileText className="h-10 w-10 mx-auto mb-3 opacity-20" />
            <p className="text-sm">Nenhuma nota fiscal cadastrada.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {Object.entries(grouped)
              .sort((a, b) => b[0].localeCompare(a[0]))
              .map(([mes, list]) => (
                <div key={mes}>
                  <div className="text-xs font-semibold text-muted-foreground mb-2">
                    {mes} ({list.length})
                  </div>
                  <div className="space-y-2">
                    {list.map((n) => (
                      <div
                        key={n.id}
                        className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-accent/30 transition-colors"
                      >
                        <FileText className="h-5 w-5 text-red-500 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{n.nome_arquivo}</p>
                          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                            <span>
                              {format(new Date(n.created_at), "dd/MM/yyyy HH:mm", {
                                locale: ptBR,
                              })}
                            </span>
                            {n.tamanho_bytes && <span>• {formatSize(n.tamanho_bytes)}</span>}
                            {n.enviado_em && (
                              <Badge variant="secondary" className="text-[10px]">
                                Enviado
                              </Badge>
                            )}
                          </div>
                        </div>
                        <div className="flex gap-1 shrink-0">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => handleDownload(n)}
                            title="Baixar"
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => handleGenerateLink(n)}
                            title="Gerar link público"
                          >
                            <LinkIcon className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-emerald-600"
                            onClick={() => handleSendWhatsapp(n)}
                            title="Enviar via WhatsApp"
                          >
                            <Send className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive"
                            onClick={() => setDeletingId(n.id)}
                            title="Excluir"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
          </div>
        )}
      </CardContent>

      <AlertDialog open={!!deletingId} onOpenChange={(o) => !o && setDeletingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir nota fiscal?</AlertDialogTitle>
            <AlertDialogDescription>
              "{notaToDelete?.nome_arquivo}" será removida permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => notaToDelete && deleteMutation.mutate(notaToDelete)}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!linkDialog} onOpenChange={(o) => !o && setLinkDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Link público gerado</AlertDialogTitle>
            <AlertDialogDescription>
              Válido por 7 dias. Compartilhe com o paciente para acesso direto à nota.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex gap-2">
            <Input readOnly value={linkDialog?.url || ""} className="font-mono text-xs" />
            <Button
              variant="outline"
              size="icon"
              onClick={() => {
                if (linkDialog?.url) {
                  navigator.clipboard.writeText(linkDialog.url);
                  toast.success("Link copiado!");
                }
              }}
            >
              <Copy className="h-4 w-4" />
            </Button>
          </div>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setLinkDialog(null)}>Fechar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
};
