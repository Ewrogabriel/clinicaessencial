import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useClinic } from "@/modules/clinic/hooks/useClinic";
import { useAuth } from "@/modules/auth/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Loader2, Save, FileText, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { TIPOS_CONTRATO, PLACEHOLDER_HELP, renderContractTemplate } from "@/lib/contractTemplates";

type Template = {
  id?: string;
  clinic_id?: string | null;
  nome: string;
  tipo: string;
  conteudo: string;
  ativo: boolean;
};

const SEED_TEXT: Record<string, string> = {
  paciente: `# {{clinic.nome}}
## CONTRATO DE PRESTAÇÃO DE SERVIÇOS

**CONTRATADA:** {{clinic.nome}}, CNPJ {{clinic.cnpj}}, com sede à {{clinic.endereco}}.
**CONTRATANTE:** {{paciente.nome}}, CPF {{paciente.cpf}}, RG {{paciente.rg}}.

### CLÁUSULA 1ª – DO OBJETO
O presente contrato tem por objeto a prestação de serviços de {{plano.modalidade}}, conforme plano contratado: **{{plano.nome}}**, com frequência de {{plano.frequencia_semanal}}x por semana.

### CLÁUSULA 2ª – DA VIGÊNCIA
Este contrato vigorará pelo prazo de {{contrato.vigencia_meses}} meses a contar da data de assinatura, renovando-se automaticamente por iguais períodos, salvo manifestação contrária por escrito de qualquer das partes com antecedência mínima de 30 dias.

### CLÁUSULA 3ª – DO PAGAMENTO
O CONTRATANTE pagará à CONTRATADA o valor mensal de R$ {{contrato.valor}}, com vencimento todo dia {{contrato.dia_vencimento}}, via {{contrato.forma_pagamento}}. O atraso ensejará multa de {{contrato.multa_atraso_pct}}% e juros de {{contrato.juros_mensal_pct}}% ao mês.

### CLÁUSULA 4ª – DAS FALTAS E REPOSIÇÕES
O CONTRATANTE poderá cancelar uma sessão com antecedência mínima de {{contrato.prazo_cancelamento_h}} horas, sendo a reposição garantida em até {{contrato.prazo_reposicao_dias}} dias. Faltas sem aviso prévio não geram direito à reposição.

### CLÁUSULA 5ª – DAS OBRIGAÇÕES DA CONTRATADA
Prestar os serviços com zelo, técnica e ética profissional, mantendo equipamentos e instalações adequadas, e respeitando o sigilo das informações do CONTRATANTE conforme a LGPD.

### CLÁUSULA 6ª – DAS OBRIGAÇÕES DO CONTRATANTE
Comparecer pontualmente às sessões, informar quaisquer condições de saúde relevantes, seguir as orientações dos profissionais e efetuar os pagamentos nas datas acordadas.

### CLÁUSULA 7ª – DA RESCISÃO
O contrato poderá ser rescindido por qualquer das partes mediante comunicação por escrito com antecedência mínima de 30 dias, ressalvado o pagamento das mensalidades vencidas até a efetiva rescisão.

### CLÁUSULA 8ª – DA PROTEÇÃO DE DADOS (LGPD)
O CONTRATANTE autoriza o tratamento dos seus dados pessoais e de saúde para fins de prestação dos serviços, comunicação e cumprimento de obrigações legais, em conformidade com a Lei nº 13.709/2018.

### CLÁUSULA 9ª – DO FORO
Fica eleito o foro da comarca de {{contrato.cidade_foro}}/{{contrato.estado_foro}} para dirimir quaisquer controvérsias oriundas deste contrato.

{{clinic.cidade}}, {{data.hoje}}.`,

  profissional: `# {{clinic.nome}}
## CONTRATO DE PRESTAÇÃO DE SERVIÇOS PROFISSIONAIS

**CLÍNICA (CONTRATANTE):** {{clinic.nome}}, CNPJ {{clinic.cnpj}}, sede {{clinic.endereco}}.
**PROFISSIONAL (CONTRATADO):** {{profissional.nome}}, CPF {{profissional.cpf}}, {{profissional.conselho}} {{profissional.registro}}.

### CLÁUSULA 1ª – DO OBJETO
Prestação de serviços profissionais autônomos pelo CONTRATADO em favor da CONTRATANTE, sem vínculo empregatício, observada a legislação do respectivo conselho de classe.

### CLÁUSULA 2ª – DA REMUNERAÇÃO
Comissão de {{profissional.commission_rate}}% sobre os valores efetivamente recebidos pela CONTRATANTE referentes aos atendimentos prestados pelo CONTRATADO. O pagamento será efetuado até o dia {{profissional.dia_pagamento_comissao}} do mês subsequente.

### CLÁUSULA 3ª – DA NÃO CAPTAÇÃO DE CLIENTES
Fica vedado ao CONTRATADO, durante a vigência deste contrato e por 12 (doze) meses após sua rescisão, atender clientes da CONTRATANTE em consultório próprio ou de terceiros num raio de {{profissional.raio_nao_concorrencia}} km, sob pena de multa equivalente a {{profissional.multa_nao_captacao}}x o valor mensal recebido pelo cliente captado.

### CLÁUSULA 4ª – DA RESCISÃO E AVISO PRÉVIO
Qualquer das partes poderá rescindir o contrato mediante aviso prévio de {{profissional.aviso_previo_dias}} dias, garantindo a continuidade dos atendimentos em curso.

### CLÁUSULA 5ª – DO USO DA MARCA
O uso indevido da marca, logotipo ou imagem da CONTRATANTE pelo CONTRATADO acarretará multa de R$ {{profissional.multa_uso_marca}}, sem prejuízo de demais perdas e danos.

### CLÁUSULA 6ª – DA CONFIDENCIALIDADE
O CONTRATADO compromete-se a manter sigilo absoluto sobre informações de pacientes, fluxos internos e dados estratégicos da CONTRATANTE, em conformidade com a LGPD.

### CLÁUSULA 7ª – DO FORO
Fica eleito o foro da comarca de {{contrato.cidade_foro}}/{{contrato.estado_foro}}.

{{clinic.cidade}}, {{data.hoje}}.`,

  termo_saude: `# {{clinic.nome}}
## TERMO DE RESPONSABILIDADE E CONDIÇÕES DE SAÚDE

Eu, {{paciente.nome}}, CPF {{paciente.cpf}}, declaro estar ciente das condições para realização dos atendimentos na {{clinic.nome}} e:

1. Informarei previamente quaisquer condições de saúde, alergias, medicamentos em uso e restrições físicas que possam interferir nos atendimentos.
2. Seguirei as orientações dos profissionais e respeitarei os limites indicados.
3. Autorizo a equipe a tomar as medidas necessárias em caso de emergência durante o atendimento.
4. Declaro estar apto(a) à prática das atividades propostas, isentando a CONTRATADA de responsabilidade por omissão ou falsidade nas informações de saúde aqui prestadas.

{{clinic.cidade}}, {{data.hoje}}.`,

  politica_interna: `# {{clinic.nome}}
## POLÍTICA INTERNA E REGRAS DE CONVIVÊNCIA

1. **Pontualidade:** chegar com 5 minutos de antecedência. Atrasos superiores a 15 minutos podem implicar perda da sessão.
2. **Cancelamentos:** com antecedência mínima de {{contrato.prazo_cancelamento_h}} horas para garantir reposição em até {{contrato.prazo_reposicao_dias}} dias.
3. **Vestimenta adequada** para a modalidade praticada.
4. **Higiene:** uso de toalha individual e meias antiderrapantes quando aplicável.
5. **Equipamentos:** uso restrito ao horário agendado e sob orientação do profissional.
6. **Convivência:** ambiente de respeito mútuo; comportamentos inadequados podem ensejar desligamento.
7. **Comunicação oficial:** atualizações e avisos por WhatsApp/{{clinic.telefone}} e Instagram {{clinic.instagram}}.

{{clinic.cidade}}, {{data.hoje}}.`,
};

export default function ModelosContrato() {
  const { activeClinicId } = useClinic();
  const { isAdmin, isGestor } = useAuth();
  const qc = useQueryClient();
  const [tipo, setTipo] = useState<string>("paciente");
  const [draft, setDraft] = useState<Template | null>(null);
  const [saving, setSaving] = useState(false);

  const canManage = isAdmin || isGestor;

  const { data: templates, isLoading } = useQuery({
    queryKey: ["contrato-templates", activeClinicId],
    queryFn: async () => {
      let q = supabase.from("contrato_templates").select("*");
      if (activeClinicId) q = q.eq("clinic_id", activeClinicId);
      const { data } = await q;
      return data ?? [];
    },
  });

  useEffect(() => {
    if (!templates) return;
    const existing = templates.find((t: any) => t.tipo === tipo);
    if (existing) {
      setDraft(existing as Template);
    } else {
      setDraft({
        nome: TIPOS_CONTRATO.find(t => t.value === tipo)?.label || tipo,
        tipo,
        conteudo: SEED_TEXT[tipo] || "",
        ativo: true,
        clinic_id: activeClinicId,
      });
    }
  }, [tipo, templates, activeClinicId]);

  const handleSave = async () => {
    if (!draft) return;
    setSaving(true);
    try {
      if (draft.id) {
        const { error } = await supabase.from("contrato_templates")
          .update({ nome: draft.nome, conteudo: draft.conteudo, ativo: draft.ativo })
          .eq("id", draft.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("contrato_templates")
          .insert({ nome: draft.nome, tipo: draft.tipo, conteudo: draft.conteudo, ativo: draft.ativo, clinic_id: activeClinicId });
        if (error) throw error;
      }
      toast.success("Modelo salvo. As novas alterações já aparecerão no preview e no PDF.");
      qc.invalidateQueries({ queryKey: ["contrato-templates"] });
      qc.invalidateQueries({ queryKey: ["contrato-template-ativo"] });
    } catch (e: any) {
      toast.error(e.message || "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  const handleResetToDefault = () => {
    if (!draft) return;
    if (!confirm("Restaurar o texto padrão? Suas alterações serão perdidas após salvar.")) return;
    setDraft({ ...draft, conteudo: SEED_TEXT[draft.tipo] || "" });
  };

  const previewHtml = draft ? renderContractTemplate(draft.conteudo, {
    clinic: { nome: "Sua Clínica", cnpj: "00.000.000/0001-00", endereco: "Av. Exemplo, 100", cidade: "Cidade", estado: "UF", telefone: "(00) 0000-0000", instagram: "@clinica" },
    paciente: { nome: "João da Silva", cpf: "000.000.000-00", rg: "00.000.000-0" },
    plano: { nome: "Plano Mensal", modalidade: "Pilates", frequencia_semanal: 2 },
    profissional: { nome: "Dr. Fulano", cpf: "111.111.111-11", conselho_profissional: "CREFITO", registro_profissional: "12345-F", commission_rate: 50 },
    valorFinal: 350,
    formaPagamento: "Pix",
  }) : "";

  if (!canManage) {
    return <div className="p-6 text-center text-muted-foreground">Acesso restrito a administradores.</div>;
  }

  return (
    <div className="container mx-auto py-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><FileText className="h-6 w-6 text-primary" /> Modelos de Contrato</h1>
          <p className="text-sm text-muted-foreground">Edite o texto que será usado no preview e no PDF gerado para os pacientes.</p>
        </div>
      </div>

      <Tabs value={tipo} onValueChange={setTipo}>
        <TabsList className="grid grid-cols-2 sm:grid-cols-4 w-full">
          {TIPOS_CONTRATO.map(t => (
            <TabsTrigger key={t.value} value={t.value}>{t.label}</TabsTrigger>
          ))}
        </TabsList>

        {TIPOS_CONTRATO.map(t => (
          <TabsContent key={t.value} value={t.value} className="space-y-4 mt-4">
            {isLoading || !draft ? (
              <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between text-base">
                      <span>Editor — {t.label}</span>
                      {draft.id && <Badge variant="secondary">Personalizado</Badge>}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div>
                      <Label htmlFor="nome">Nome do modelo</Label>
                      <Input id="nome" value={draft.nome} onChange={e => setDraft({ ...draft, nome: e.target.value })} />
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch checked={draft.ativo} onCheckedChange={v => setDraft({ ...draft, ativo: v })} id="ativo" />
                      <Label htmlFor="ativo">Ativo (será usado no preview/PDF)</Label>
                    </div>
                    <div>
                      <Label htmlFor="conteudo">Conteúdo</Label>
                      <Textarea
                        id="conteudo"
                        value={draft.conteudo}
                        onChange={e => setDraft({ ...draft, conteudo: e.target.value })}
                        className="min-h-[420px] font-mono text-xs"
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button onClick={handleSave} disabled={saving} className="flex-1">
                        {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                        Salvar
                      </Button>
                      <Button variant="outline" onClick={handleResetToDefault} title="Restaurar texto padrão">
                        <RotateCcw className="h-4 w-4" />
                      </Button>
                    </div>

                    <details className="text-xs text-muted-foreground border rounded-md p-2 mt-2">
                      <summary className="cursor-pointer font-medium">Variáveis disponíveis (clique para expandir)</summary>
                      <div className="space-y-2 mt-2">
                        {PLACEHOLDER_HELP.map(g => (
                          <div key={g.group}>
                            <p className="font-semibold">{g.group}</p>
                            <div className="flex flex-wrap gap-1">
                              {g.items.map(i => <code key={i} className="bg-muted px-1.5 py-0.5 rounded">{`{{${i}}}`}</code>)}
                            </div>
                          </div>
                        ))}
                      </div>
                    </details>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader><CardTitle className="text-base">Pré-visualização (com dados de exemplo)</CardTitle></CardHeader>
                  <CardContent>
                    <div className="border rounded-md p-4 bg-card max-h-[600px] overflow-y-auto whitespace-pre-wrap text-sm leading-relaxed font-serif">
                      {previewHtml}
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
