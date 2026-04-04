import { useState, useEffect } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
    ArrowLeft, User, ClipboardList, History, Plus, Stethoscope,
    Calendar, DollarSign, FileCheck, Brain, ChevronDown,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/modules/auth/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { EvolutionForm } from "@/components/clinical/EvolutionForm";
import { EvaluationForm } from "@/components/clinical/EvaluationForm";
import { PatientScheduleTab } from "@/components/clinical/PatientScheduleTab";
import { PatientAttachments } from "@/components/clinical/PatientAttachments";
import { AIClinicalAssistant } from "@/components/clinical/AIClinicalAssistant";
import { ExportPatientPDFButton } from "@/components/patient/ExportPatientPDFButton";
import { AIPatientAnalysisButton } from "@/components/patient/AIPatientAnalysisButton";
import { PaymentHistoryTab } from "@/components/financial/PaymentHistoryTab";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

const PacienteDetalhes = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const { isAdmin, isProfissional, isGestor, isSecretario, isMaster } = useAuth();
    const initialTab = searchParams.get("tab") ?? "prontuario";
    const [activeTab, setActiveTab] = useState(initialTab);
    const [evolutionOpen, setEvolutionOpen] = useState(false);
    const [evaluationOpen, setEvaluationOpen] = useState(false);
    const [historyOpen, setHistoryOpen] = useState(false);

    // Auto-open new evolution form when navigated with ?new=1
    useEffect(() => {
        if (searchParams.get("new") === "1" && searchParams.get("tab") === "evolucoes") {
            setActiveTab("evolucoes");
            setEvolutionOpen(true);
        }
    }, [searchParams]);

    const canAccess = isAdmin || isProfissional;

    const { data: paciente, isLoading: loadingPaciente } = useQuery({
        queryKey: ["paciente", id],
        queryFn: async () => {
            const { data, error } = await supabase
                .from("pacientes")
                .select("id, nome, email, telefone, cpf, data_nascimento, status, tipo_atendimento, profissional_id, user_id, observacoes, foto_url, created_at, updated_at")
                .eq("id", id)
                .maybeSingle();
            if (error) throw error;
            return data;
        },
        enabled: !!id && canAccess,
    });

    // Fetch ALL evaluations for history
    const { data: allAvaliacoes = [], isLoading: loadingAvaliacoes } = useQuery({
        queryKey: ["avaliacoes-historico", id],
        queryFn: async () => {
            const { data, error } = await supabase
                .from("evaluations")
                .select("*")
                .eq("paciente_id", id)
                .order("data_avaliacao", { ascending: false });
            if (error) throw error;

            // Fetch profissional names
            const profIds = [...new Set((data || []).map(e => e.profissional_id))] as string[];
            const profMap: Record<string, string> = {};
            if (profIds.length > 0) {
                const { data: profs } = await supabase.from("profiles").select("user_id, nome").in("user_id", profIds);
                if (profs) profs.forEach(p => { profMap[p.user_id] = p.nome; });
            }
            return (data || []).map(e => ({ ...e, profissional_nome: profMap[e.profissional_id] || "—" }));
        },
        enabled: !!id && canAccess,
    });

    const avaliacao = allAvaliacoes.length > 0 ? allAvaliacoes[0] : null;

    const { data: evolucoes = [] } = useQuery({
        queryKey: ["evolucoes", id],
        queryFn: async () => {
            const { data, error } = await supabase
                .from("evolutions")
                .select("*")
                .eq("paciente_id", id)
                .order("data_evolucao", { ascending: false });
            if (error) throw error;

            const profIds = [...new Set((data || []).map((e) => e.profissional_id))] as string[];
            const profMap: Record<string, string> = {};
            if (profIds.length > 0) {
                const { data: profs } = await supabase.from("profiles").select("user_id, nome").in("user_id", profIds);
                if (profs) profs.forEach((p) => { profMap[p.user_id] = p.nome; });
            }
            return (data || []).map((e) => ({ ...e, profissional_nome: profMap[e.profissional_id] || "—" }));
        },
        enabled: !!id && canAccess,
    });

    if (!canAccess) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-muted-foreground">
                <p className="text-lg font-medium">Acesso restrito</p>
                <p className="text-sm">Apenas profissionais e administradores podem acessar detalhes do paciente.</p>
                <Button variant="outline" onClick={() => navigate(-1)}>Voltar</Button>
            </div>
        );
    }

    if (loadingPaciente) {
        return <div className="p-8 text-center animate-pulse">Carregando dados do paciente...</div>;
    }

    if (!paciente) {
        return <div className="p-8 text-center">Paciente não encontrado.</div>;
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" onClick={() => navigate("/pacientes")}>
                    <ArrowLeft className="h-4 w-4" />
                </Button>
                <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center overflow-hidden shrink-0">
                    {paciente.foto_url ? (
                        <img src={paciente.foto_url} alt={paciente.nome} className="w-full h-full object-cover" />
                    ) : (
                        <User className="h-6 w-6 text-muted-foreground" />
                    )}
                </div>
                <div className="flex flex-col">
                    <div className="flex items-center gap-3">
                        <h1 className="text-2xl font-bold tracking-tight font-[Plus_Jakarta_Sans]">{paciente.nome}</h1>
                        <Badge variant={paciente.status === "ativo" ? "default" : "outline"}>
                            {paciente.status === "ativo" ? "Ativo" : "Inativo"}
                        </Badge>
                    </div>
                    <p className="text-muted-foreground text-sm">
                        {paciente.tipo_atendimento.charAt(0).toUpperCase() + paciente.tipo_atendimento.slice(1)} • {paciente.telefone}
                    </p>
                </div>
                <div className="flex gap-2 ml-auto">
                    <ExportPatientPDFButton pacienteId={id!} />
                    <AIPatientAnalysisButton pacienteId={id!} pacienteNome={paciente.nome} />
                </div>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="grid w-full grid-cols-5 mb-8">
                    <TabsTrigger value="prontuario" className="gap-2">
                        <Stethoscope className="h-4 w-4" />
                        <span className="hidden sm:inline">Prontuário</span>
                    </TabsTrigger>
                    <TabsTrigger value="evolucoes" className="gap-2">
                        <ClipboardList className="h-4 w-4" />
                        <span className="hidden sm:inline">Evoluções</span>
                    </TabsTrigger>
                    <TabsTrigger value="atendimentos" className="gap-2">
                        <Calendar className="h-4 w-4" />
                        <span className="hidden sm:inline">Agenda</span>
                    </TabsTrigger>
                    {(isAdmin || isGestor || isSecretario || isMaster || isProfissional) && (
                        <TabsTrigger value="pagamentos" className="gap-2">
                            <DollarSign className="h-4 w-4" />
                            <span className="hidden sm:inline">Pagamentos</span>
                        </TabsTrigger>
                    )}
                    <TabsTrigger value="cadastro" className="gap-2">
                        <User className="h-4 w-4" />
                        <span className="hidden sm:inline">Cadastro</span>
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="prontuario" className="space-y-4">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between">
                            <div>
                                <CardTitle>Avaliação Clínica</CardTitle>
                                <CardDescription>
                                    {avaliacao
                                        ? `Última avaliação em ${format(new Date(avaliacao.data_avaliacao), "dd/MM/yyyy")} por ${avaliacao.profissional_nome}`
                                        : "Nenhuma avaliação registrada"}
                                </CardDescription>
                            </div>
                            <Button size="sm" onClick={() => setEvaluationOpen(true)}>
                                <Plus className="h-4 w-4 mr-2" />
                                {avaliacao ? "Nova Avaliação" : "Realizar Avaliação"}
                            </Button>
                        </CardHeader>
                        <CardContent>
                            {avaliacao ? (
                                <div className="space-y-6">
                                    <div>
                                        <h4 className="font-semibold text-sm uppercase text-muted-foreground mb-2">Queixa Principal</h4>
                                        <p className="text-sm">{avaliacao.queixa_principal}</p>
                                    </div>
                                    {avaliacao.historico_doenca && (
                                        <div>
                                            <h4 className="font-semibold text-sm uppercase text-muted-foreground mb-2">Histórico (HDA)</h4>
                                            <p className="text-sm">{avaliacao.historico_doenca}</p>
                                        </div>
                                    )}
                                    {avaliacao.antecedentes_pessoais && (
                                        <div>
                                            <h4 className="font-semibold text-sm uppercase text-muted-foreground mb-2">Antecedentes</h4>
                                            <p className="text-sm">{avaliacao.antecedentes_pessoais}</p>
                                        </div>
                                    )}
                                    {avaliacao.objetivos_tratamento && (
                                        <div>
                                            <h4 className="font-semibold text-sm uppercase text-muted-foreground mb-2">Objetivos</h4>
                                            <p className="text-sm">{avaliacao.objetivos_tratamento}</p>
                                        </div>
                                    )}
                                    {avaliacao.conduta_inicial && (
                                        <div className="pt-4 border-t">
                                            <h4 className="font-semibold text-sm uppercase text-muted-foreground mb-2">Conduta Inicial</h4>
                                            <p className="text-sm">{avaliacao.conduta_inicial}</p>
                                        </div>
                                    )}
                                    <div className="pt-4 text-xs text-muted-foreground text-right italic">
                                        Avaliado em {format(new Date(avaliacao.data_avaliacao), "dd/MM/yyyy")} por {avaliacao.profissional_nome}
                                    </div>
                                </div>
                            ) : (
                                <div className="text-center py-12 text-muted-foreground border-2 border-dashed rounded-lg">
                                    <Stethoscope className="h-12 w-12 mx-auto mb-4 opacity-20" />
                                    <p>Nenhuma avaliação registrada para este paciente.</p>
                                    <Button variant="link" className="mt-2" onClick={() => setEvaluationOpen(true)}>Realizar avaliação inicial agora</Button>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Evaluation History */}
                    {allAvaliacoes.length > 1 && (
                        <Collapsible open={historyOpen} onOpenChange={setHistoryOpen}>
                            <Card>
                                <CollapsibleTrigger asChild>
                                    <CardHeader className="cursor-pointer hover:bg-muted/30 transition-colors">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <CardTitle className="text-base flex items-center gap-2">
                                                    <History className="h-4 w-4" />
                                                    Histórico de Avaliações ({allAvaliacoes.length})
                                                </CardTitle>
                                            </div>
                                            <ChevronDown className={`h-4 w-4 transition-transform ${historyOpen ? "rotate-180" : ""}`} />
                                        </div>
                                    </CardHeader>
                                </CollapsibleTrigger>
                                <CollapsibleContent>
                                    <CardContent className="space-y-4 pt-0">
                                        {allAvaliacoes.map((eval_item: any, idx: number) => (
                                            <div key={eval_item.id} className={`p-4 rounded-lg border ${idx === 0 ? "bg-primary/5 border-primary/20" : "bg-muted/30"}`}>
                                                <div className="flex items-center justify-between mb-3">
                                                    <div className="flex items-center gap-2">
                                                        <Badge variant={idx === 0 ? "default" : "outline"} className="text-xs">
                                                            {format(new Date(eval_item.data_avaliacao), "dd/MM/yyyy")}
                                                        </Badge>
                                                        {idx === 0 && <Badge variant="secondary" className="text-xs">Atual</Badge>}
                                                    </div>
                                                    <span className="text-xs text-muted-foreground">por {eval_item.profissional_nome}</span>
                                                </div>
                                                <div className="space-y-2 text-sm">
                                                    <p><strong>Queixa:</strong> {eval_item.queixa_principal}</p>
                                                    {eval_item.conduta_inicial && <p><strong>Conduta:</strong> {eval_item.conduta_inicial}</p>}
                                                    {eval_item.objetivos_tratamento && <p><strong>Objetivos:</strong> {eval_item.objetivos_tratamento}</p>}
                                                </div>
                                            </div>
                                        ))}
                                    </CardContent>
                                </CollapsibleContent>
                            </Card>
                        </Collapsible>
                    )}

                    <PatientAttachments pacienteId={id!} />
                    <AIClinicalAssistant pacienteId={id!} modalidade={paciente?.tipo_atendimento} />
                </TabsContent>

                <TabsContent value="evolucoes" className="space-y-4">
                    <div className="flex justify-between items-center">
                        <h3 className="text-lg font-semibold font-[Plus_Jakarta_Sans]">Linha do Tempo</h3>
                        <Button size="sm" onClick={() => setEvolutionOpen(true)}>
                            <Plus className="h-4 w-4 mr-2" />
                            Evoluir Sessão
                        </Button>
                    </div>

                    {evolucoes.length === 0 ? (
                        <Card>
                            <CardContent className="py-12 text-center text-muted-foreground">
                                <p>Ainda não há evoluções clínicas registradas.</p>
                            </CardContent>
                        </Card>
                    ) : (
                        <div className="space-y-4">
                            {evolucoes.map((evol: any) => (
                                <Card key={evol.id}>
                                    <CardHeader className="py-4">
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <Badge variant="outline" className="mb-2">
                                                    {format(new Date(evol.data_evolucao), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                                                </Badge>
                                                <CardTitle className="text-base">Profissional: {evol.profissional_nome}</CardTitle>
                                            </div>
                                        </div>
                                    </CardHeader>
                                    <CardContent className="pb-4">
                                        <p className="text-sm whitespace-pre-wrap">{evol.descricao}</p>
                                        {evol.conduta && (
                                            <div className="mt-4 pt-4 border-t">
                                                <p className="text-xs font-semibold uppercase text-muted-foreground mb-1">Conduta / Plano</p>
                                                <p className="text-sm">{evol.conduta}</p>
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    )}
                </TabsContent>

                <TabsContent value="atendimentos" className="space-y-4">
                    <PatientScheduleTab pacienteId={id!} pacienteTelefone={paciente?.telefone} pacienteNome={paciente?.nome} />
                </TabsContent>

                {(isAdmin || isGestor || isSecretario || isMaster || isProfissional) && (
                    <TabsContent value="pagamentos" className="space-y-4">
                        {activeTab === "pagamentos" && (
                            <PaymentHistoryTab pacienteId={id!} pacienteNome={paciente.nome} />
                        )}
                    </TabsContent>
                )}

                <TabsContent value="cadastro">
                    <Card>
                        <CardHeader>
                            <CardTitle>Dados de Cadastro</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid grid-cols-2 gap-4 text-sm">
                                <div>
                                    <p className="text-muted-foreground">CPF</p>
                                    <p className="font-medium">{paciente.cpf || "Não informado"}</p>
                                </div>
                                <div>
                                    <p className="text-muted-foreground">Telefone</p>
                                    <p className="font-medium">{paciente.telefone}</p>
                                </div>
                                <div>
                                    <p className="text-muted-foreground">Email</p>
                                    <p className="font-medium">{paciente.email || "Não informado"}</p>
                                </div>
                                <div>
                                    <p className="text-muted-foreground">Data Nasc.</p>
                                    <p className="font-medium">{paciente.data_nascimento ? format(new Date(paciente.data_nascimento), "dd/MM/yyyy") : "Não informado"}</p>
                                </div>
                            </div>

                            {(paciente as any).tem_responsavel_legal && (
                                <div className="mt-6 pt-4 border-t">
                                    <h4 className="font-semibold text-sm mb-3">Responsável Legal</h4>
                                    <div className="grid grid-cols-2 gap-4 text-sm">
                                        <div>
                                            <p className="text-muted-foreground">Nome</p>
                                            <p className="font-medium">{(paciente as any).responsavel_nome || "—"}</p>
                                        </div>
                                        <div>
                                            <p className="text-muted-foreground">Parentesco</p>
                                            <p className="font-medium capitalize">{(paciente as any).responsavel_parentesco || "—"}</p>
                                        </div>
                                        <div>
                                            <p className="text-muted-foreground">CPF</p>
                                            <p className="font-medium">{(paciente as any).responsavel_cpf || "—"}</p>
                                        </div>
                                        <div>
                                            <p className="text-muted-foreground">Telefone</p>
                                            <p className="font-medium">{(paciente as any).responsavel_telefone || "—"}</p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            <div className="mt-6">
                                <Button variant="outline" onClick={() => navigate(`/pacientes/${paciente.id}`)}>
                                    Editar Cadastro Completo
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>

            <EvolutionForm open={evolutionOpen} onOpenChange={setEvolutionOpen} pacienteId={id!} />
            <EvaluationForm open={evaluationOpen} onOpenChange={setEvaluationOpen} pacienteId={id!} />
        </div>
    );
};

export default PacienteDetalhes;
