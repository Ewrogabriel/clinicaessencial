import { useState, useEffect } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { generateReceiptPDF } from "@/lib/generateReceiptPDF";
import { Button } from "@/components/ui/button";
import { FileDown, Loader2, AlertCircle } from "lucide-react";
import { toast } from "sonner";

const PAYMENT_TABLES = ["pagamentos", "pagamentos_sessoes", "pagamentos_mensalidade"] as const;

const PublicReceipt = () => {
    const { id } = useParams();
    const [searchParams] = useSearchParams();
    const [loading, setLoading] = useState(true);
    const [generating, setGenerating] = useState(false);
    const [payment, setPayment] = useState<any>(null);
    const [paciente, setPaciente] = useState<any>(null);
    const [clinic, setClinic] = useState<any>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchData = async () => {
            if (!id) return;
            setLoading(true);
            try {
                let payData: any = null;
                const source = searchParams.get("source");

                // Try the source table first, then fall back to others
                const tablesToTry = source
                    ? [source, ...PAYMENT_TABLES.filter(t => t !== source)]
                    : [...PAYMENT_TABLES];

                for (const table of tablesToTry) {
                    const { data, error: err } = await (supabase as any)
                        .from(table)
                        .select("*")
                        .eq("id", id)
                        .maybeSingle();
                    if (data) {
                        payData = data;
                        break;
                    }
                }

                if (!payData) throw new Error("Pagamento não encontrado.");
                setPayment(payData);

                // Fetch paciente
                if (payData.paciente_id) {
                    const { data: pacData } = await supabase
                        .from("pacientes")
                        .select("*")
                        .eq("id", payData.paciente_id)
                        .maybeSingle();
                    if (pacData) setPaciente(pacData);
                }

                // Fetch clinic settings
                const { data: clinicData } = await supabase
                    .from("clinic_settings")
                    .select("*")
                    .limit(1)
                    .maybeSingle();
                if (clinicData) setClinic(clinicData);

            } catch (err: any) {
                console.error("Error fetching receipt data:", err);
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [id, searchParams]);

    const handleDownload = async () => {
        if (!payment || !paciente) {
            toast.error("Dados incompletos para gerar o recibo.");
            return;
        }

        setGenerating(true);
        try {
            const dataPag = payment.data_pagamento || payment.created_at;
            const dateStr = new Date(dataPag).toLocaleDateString("pt-BR");
            const yy = new Date(dataPag).getFullYear().toString().slice(-2);
            const mm = String(new Date(dataPag).getMonth() + 1).padStart(2, "0");
            const short = payment.id.slice(0, 6).toUpperCase();
            const numero = `${yy}${mm}-${short}`;

            const doc = await generateReceiptPDF({
                numero,
                pacienteNome: paciente.nome,
                cpf: paciente.cpf || "Não informado",
                descricao: payment.descricao || payment.observacoes || "Serviços de fisioterapia",
                valor: payment.valor,
                formaPagamento: payment.metodo_pagamento || payment.forma_pagamento || "",
                dataPagamento: dateStr,
                referencia: payment.referencia || payment.mes_referencia || "",
            });
            doc.save(`recibo-${paciente.nome.replace(/\s+/g, "-")}.pdf`);
            toast.success("Recibo gerado com sucesso!");
        } catch (err) {
            console.error("Error generating PDF:", err);
            toast.error("Erro ao gerar PDF.");
        } finally {
            setGenerating(false);
        }
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen gap-4">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-muted-foreground animate-pulse text-sm font-medium">Carregando seu recibo...</p>
            </div>
        );
    }

    if (error || !payment) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen p-4 text-center">
                <AlertCircle className="h-12 w-12 text-destructive mb-4" />
                <h1 className="text-xl font-bold mb-2">Ops! Recibo não encontrado</h1>
                <p className="text-muted-foreground max-w-md">
                    Não foi possível carregar as informações deste recibo. Por favor, verifique o link ou entre em contato com a clínica.
                </p>
                <div className="mt-8 p-4 bg-muted/30 rounded-lg border border-dashed text-xs text-muted-foreground">
                    ID: {id}
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4 sm:p-8">
            <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden">
                <div className="p-8 text-center space-y-6">
                    <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
                        <FileDown className="h-8 w-8 text-primary" />
                    </div>
                    
                    <div className="space-y-2">
                        <h1 className="text-2xl font-bold text-slate-900">Seu Recibo está pronto!</h1>
                        <p className="text-slate-500 text-sm">
                            Clique no botão abaixo para baixar o recibo do seu pagamento realizado em{" "}
                            <span className="font-semibold text-slate-700">
                                {new Date(payment.data_pagamento || payment.created_at).toLocaleDateString("pt-BR")}
                            </span>
                        </p>
                    </div>

                    <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 space-y-3">
                        <div className="flex justify-between text-sm italic">
                            <span className="text-slate-500">Valor</span>
                            <span className="font-bold text-slate-900">
                                {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(payment.valor)}
                            </span>
                        </div>
                        {paciente && (
                            <div className="flex justify-between text-sm">
                                <span className="text-slate-500">Paciente</span>
                                <span className="text-slate-900 font-medium">{paciente.nome}</span>
                            </div>
                        )}
                    </div>

                    <Button 
                        onClick={handleDownload} 
                        disabled={generating}
                        className="w-full h-12 text-md font-semibold transition-all hover:scale-[1.02] active:scale-[0.98]"
                    >
                        {generating ? (
                            <><Loader2 className="h-5 w-5 mr-2 animate-spin" /> Gerando PDF...</>
                        ) : (
                            <><FileDown className="h-5 w-5 mr-2" /> Baixar Recibo (PDF)</>
                        )}
                    </Button>

                    {clinic?.nome && (
                        <div className="pt-4 border-t border-slate-100">
                            <p className="text-[10px] uppercase tracking-widest text-slate-400 font-bold mb-1">Emitido por</p>
                            <p className="text-sm font-medium text-slate-600">{clinic.nome}</p>
                        </div>
                    )}
                </div>
                
                <div className="bg-slate-900 p-4 text-center">
                    <p className="text-white/40 text-[10px] font-medium tracking-tight">
                        FISIO FLOW CARE — SISTEMA DE GESTÃO CLÍNICA
                    </p>
                </div>
            </div>
            
            <p className="mt-8 text-slate-400 text-xs text-center max-w-xs">
                Este link é temporário e destina-se apenas ao destinatário original.
            </p>
        </div>
    );
};

export default PublicReceipt;
