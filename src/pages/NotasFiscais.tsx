import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileText, CheckCircle2, Search, Eye, Upload, Download, Send, RefreshCw, AlertTriangle } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { format, endOfMonth, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useClinic } from "@/hooks/useClinic";

const NotasFiscais = () => {
  const { user } = useAuth();
  const { activeClinicId } = useClinic();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [mesRef, setMesRef] = useState(format(new Date(), "yyyy-MM"));
  const [detailOpen, setDetailOpen] = useState(false);
  const [selected, setSelected] = useState<any>(null);
  const [uploading, setUploading] = useState<string | null>(null);
  const [emitting, setEmitting] = useState<string | null>(null);

  const { data: pacientesNF = [], isLoading } = useQuery({
    queryKey: ["pacientes-nf"],
    queryFn: async () => {
      const { data, error } = await (supabase.from("pacientes") as any)
        .select("id, nome, telefone, cpf, solicita_nf, nf_razao_social, nf_cnpj_cpf, nf_endereco, nf_inscricao_estadual, nf_email")
        .eq("solicita_nf", true)
        .order("nome");
      if (error) throw error;
      return data || [];
    },
  });

  const { data: emissoes = [] } = useQuery({
    queryKey: ["emissoes-nf", mesRef, activeClinicId],
    queryFn: async () => {
      const mesDate = `${mesRef}-01`;
      let query = (supabase.from("emissoes_nf") as any).select("*").eq("mes_referencia", mesDate);
      if (activeClinicId) query = query.eq("clinic_id", activeClinicId);
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
  });

  const { data: pagamentos = [] } = useQuery({
    queryKey: ["pagamentos-nf", mesRef],
    queryFn: async () => {
      const start = `${mesRef}-01`;
      const end = format(endOfMonth(new Date(start)), "yyyy-MM-dd");
      const { data } = await (supabase.from("pagamentos") as any)
        .select("paciente_id, valor, status")
        .eq("status", "pago")
        .gte("data_pagamento", start)
        .lte("data_pagamento", end);

      const { data: mensalidades } = await (supabase.from("pagamentos_mensalidade") as any)
        .select("paciente_id, valor, status")
        .eq("status", "pago")
        .gte("mes_referencia", start)
        .lte("mes_referencia", end);

      const all = [...(data || []), ...(mensalidades || [])];
      const byPatient: Record<string, number> = {};
      all.forEach((p: any) => {
        byPatient[p.paciente_id] = (byPatient[p.paciente_id] || 0) + Number(p.valor);
      });
      return byPatient;
    },
  });

  const { data: nfeConfig } = useQuery({
    queryKey: ["config-nfe"],
    queryFn: async () => {
      const { data } = await (supabase.from("config_nfe") as any).select("*").limit(1).single();
      return data;
    },
  });

  const confirmarEmissao = useMutation({
    mutationFn: async (pacienteId: string) => {
      const mesDate = `${mesRef}-01`;
      const valor = (pagamentos as any)[pacienteId] || 0;
      const { error } = await (supabase.from("emissoes_nf") as any).upsert({
        paciente_id: pacienteId,
        mes_referencia: mesDate,
        valor,
        emitida: true,
        emitida_por: user?.id,
        emitida_em: new Date().toISOString(),
      }, { onConflict: "paciente_id,mes_referencia" });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["emissoes-nf"] });
      toast({ title: "Emissão confirmada! ✓" });
    },
  });

  const handleEmitNfe = async (pacienteId: string, emissaoId: string) => {
    setEmitting(pacienteId);
    try {
      const { data, error } = await supabase.functions.invoke("emit-nfe", {
        body: {
          emissao_id: emissaoId,
          paciente_id: pacienteId,
          mes_referencia: `${mesRef}-01`,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      queryClient.invalidateQueries({ queryKey: ["emissoes-nf"] });
      toast({
        title: "NFS-e enviada para emissão!",
        description: `Status: ${data.status}. O PDF ficará disponível em instantes.`,
      });
    } catch (e: any) {
      toast({
        title: "Erro ao emitir NFS-e",
        description: e.message || "Verifique a configuração do Focus NFe",
        variant: "destructive",
      });
    } finally {
      setEmitting(null);
    }
  };

  const handleCheckStatus = async (emissaoId: string) => {
    try {
      const { data, error } = await supabase.functions.invoke("check-nfe-status", {
        body: { emissao_id: emissaoId },
      });
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["emissoes-nf"] });
      toast({ title: `Status: ${data?.status || "verificado"}` });
    } catch (e: any) {
      toast({ title: "Erro ao verificar status", description: e.message, variant: "destructive" });
    }
  };

  const handleUploadPdf = async (pacienteId: string, file: File) => {
    setUploading(pacienteId);
    try {
      const mesDate = `${mesRef}-01`;
      const filePath = `notas-fiscais/${pacienteId}/${mesRef}/${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from("clinic-uploads")
        .upload(filePath, file, { upsert: true });
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("clinic-uploads")
        .getPublicUrl(filePath);

      const valor = (pagamentos as any)[pacienteId] || 0;
      const { error } = await (supabase.from("emissoes_nf") as any).upsert({
        paciente_id: pacienteId,
        mes_referencia: mesDate,
        valor,
        nf_pdf_url: urlData.publicUrl,
        emitida: true,
        emitida_por: user?.id,
        emitida_em: new Date().toISOString(),
      }, { onConflict: "paciente_id,mes_referencia" });
      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ["emissoes-nf"] });
      toast({ title: "PDF da NF enviado com sucesso!" });
    } catch (e: any) {
      toast({ title: "Erro ao enviar PDF", description: e.message, variant: "destructive" });
    } finally {
      setUploading(null);
    }
  };

  const emissaoMap = new Map(emissoes.map((e: any) => [e.paciente_id, e]));

  const filtered = pacientesNF.filter((p: any) =>
    p.nome?.toLowerCase().includes(search.toLowerCase())
  );

  const monthOptions = Array.from({ length: 12 }, (_, i) => {
    const d = subMonths(new Date(), i);
    return { value: format(d, "yyyy-MM"), label: format(d, "MMMM yyyy", { locale: ptBR }) };
  });

  const focusNfeConfigured = !!nfeConfig?.prestador_cnpj;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight font-[Plus_Jakarta_Sans] flex items-center gap-2">
          <FileText className="h-6 w-6 text-primary" /> Notas Fiscais
        </h1>
        <p className="text-muted-foreground">Controle de emissão de NF para pacientes que solicitam</p>
      </div>

      {!focusNfeConfigured && (
        <Card className="border-amber-200 bg-amber-50/50">
          <CardContent className="flex items-center gap-3 py-4">
            <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
            <div className="text-sm">
              <p className="font-medium text-amber-800">Focus NFe não configurado</p>
              <p className="text-amber-700">Configure os dados do prestador em <strong>Ajustes → Nota Fiscal</strong> para emitir NFS-e automaticamente.</p>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar paciente..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
        </div>
        <Select value={mesRef} onValueChange={setMesRef}>
          <SelectTrigger className="w-[200px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {monthOptions.map((m) => (
              <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Paciente</TableHead>
                <TableHead>Razão Social / Nome</TableHead>
                <TableHead>CPF/CNPJ</TableHead>
                <TableHead>Valor ({format(new Date(`${mesRef}-01`), "MMM/yy", { locale: ptBR })})</TableHead>
                <TableHead>Status NF</TableHead>
                <TableHead>PDF</TableHead>
                <TableHead>Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8">Carregando...</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Nenhum paciente solicita nota fiscal</TableCell></TableRow>
              ) : (
                filtered.map((p: any) => {
                  const emissao = emissaoMap.get(p.id) as any;
                  const valor = (pagamentos as any)[p.id] || 0;
                  const focusStatus = emissao?.focus_nfe_status;
                  return (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">{p.nome}</TableCell>
                      <TableCell className="text-muted-foreground">{p.nf_razao_social || p.nome}</TableCell>
                      <TableCell className="text-muted-foreground">{p.nf_cnpj_cpf || p.cpf || "—"}</TableCell>
                      <TableCell className="font-medium">R$ {valor.toFixed(2)}</TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          {emissao?.emitida ? (
                            <Badge className="bg-emerald-100 text-emerald-700 w-fit">Emitida</Badge>
                          ) : (
                            <Badge variant="secondary" className="w-fit">Pendente</Badge>
                          )}
                          {focusStatus && (
                            <Badge variant="outline" className="text-xs w-fit">
                              Focus: {focusStatus}
                            </Badge>
                          )}
                          {emissao?.focus_nfe_erro && (
                            <span className="text-xs text-destructive truncate max-w-[150px]" title={emissao.focus_nfe_erro}>
                              ⚠ Erro
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {emissao?.nf_pdf_url ? (
                          <a href={emissao.nf_pdf_url} target="_blank" rel="noopener noreferrer">
                            <Button size="sm" variant="outline" className="h-8 text-primary">
                              <Download className="h-3 w-3 mr-1" /> Ver PDF
                            </Button>
                          </a>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1 flex-wrap">
                          <Button size="sm" variant="outline" onClick={() => { setSelected(p); setDetailOpen(true); }}>
                            <Eye className="h-3 w-3 mr-1" /> Dados
                          </Button>

                          {/* Emit via Focus NFe */}
                          {focusNfeConfigured && !focusStatus && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-primary"
                              disabled={emitting === p.id || valor === 0}
                              onClick={async () => {
                                // Ensure emissao record exists
                                let eId = emissao?.id;
                                if (!eId) {
                                  const mesDate = `${mesRef}-01`;
                                  const { data: newE } = await (supabase.from("emissoes_nf") as any).upsert({
                                    paciente_id: p.id,
                                    mes_referencia: mesDate,
                                    valor,
                                  }, { onConflict: "paciente_id,mes_referencia" }).select().single();
                                  eId = newE?.id;
                                  if (!eId) { toast({ title: "Erro ao criar registro", variant: "destructive" }); return; }
                                }
                                handleEmitNfe(p.id, eId);
                              }}
                            >
                              <Send className="h-3 w-3 mr-1" />
                              {emitting === p.id ? "Emitindo..." : "Emitir NFS-e"}
                            </Button>
                          )}

                          {/* Check status */}
                          {focusStatus && focusStatus !== "autorizado" && emissao?.id && (
                            <Button size="sm" variant="outline" onClick={() => handleCheckStatus(emissao.id)}>
                              <RefreshCw className="h-3 w-3 mr-1" /> Status
                            </Button>
                          )}

                          {/* Manual confirm */}
                          {!emissao?.emitida && !focusNfeConfigured && (
                            <Button size="sm" variant="outline" className="text-emerald-600" onClick={() => confirmarEmissao.mutate(p.id)} disabled={confirmarEmissao.isPending}>
                              <CheckCircle2 className="h-3 w-3 mr-1" /> Confirmar
                            </Button>
                          )}

                          {/* Upload PDF */}
                          <Button size="sm" variant="outline" className="relative" disabled={uploading === p.id}>
                            <Upload className="h-3 w-3 mr-1" />
                            {uploading === p.id ? "Enviando..." : "PDF"}
                            <input
                              type="file"
                              accept=".pdf"
                              className="absolute inset-0 opacity-0 cursor-pointer"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) handleUploadPdf(p.id, file);
                                e.target.value = "";
                              }}
                            />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Dados para Nota Fiscal</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-3 text-sm">
              <div><Label className="text-muted-foreground">Paciente</Label><p className="font-medium">{selected.nome}</p></div>
              <div><Label className="text-muted-foreground">Razão Social</Label><p className="font-medium">{selected.nf_razao_social || "Não informado"}</p></div>
              <div><Label className="text-muted-foreground">CPF/CNPJ</Label><p className="font-medium">{selected.nf_cnpj_cpf || selected.cpf || "Não informado"}</p></div>
              <div><Label className="text-muted-foreground">Endereço NF</Label><p>{selected.nf_endereco || "Não informado"}</p></div>
              <div><Label className="text-muted-foreground">Inscrição Estadual</Label><p>{selected.nf_inscricao_estadual || "Não informado"}</p></div>
              <div><Label className="text-muted-foreground">E-mail para NF</Label><p>{selected.nf_email || selected.email || "Não informado"}</p></div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default NotasFiscais;
