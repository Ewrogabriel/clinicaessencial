import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, FileText, Download, CheckCircle2, AlertCircle } from "lucide-react";
import { generateReceiptPDF, getReceiptNumber } from "@/lib/generateReceiptPDF";
import { formatBRL } from "@/modules/shared/utils/currencyFormatters";
import { dateFormats } from "@/modules/shared/utils/dateFormatters";

const PublicReceipt = () => {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const source = searchParams.get("source") || "pagamentos";
  
  const [loading, setLoading] = useState(true);
  const [payment, setPayment] = useState<any>(null);
  const [paciente, setPaciente] = useState<any>(null);
  const [clinic, setClinic] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    if (id) {
      fetchReceiptData(id);
    }
  }, [id]);

  const fetchReceiptData = async (paymentId: string) => {
    setLoading(true);
    setError(null);
    try {
      // 1. Fetch payment data from specific source
      const { data: payData, error: payError } = await supabase
        .from(source as any)
        .select("*")
        .eq("id", paymentId)
        .maybeSingle();

      if (payError || !payData) {
        setError("Recibo não encontrado ou link expirado.");
        setLoading(false);
        return;
      }

      setPayment(payData);

      // 2. Fetch patient data
      const { data: pacData } = await supabase
        .from("pacientes")
        .select("nome, cpf")
        .eq("id", payData.paciente_id)
        .maybeSingle();

      setPaciente(pacData);

      // 3. Fetch clinic settings
      const { data: clinicData } = await supabase
        .from("clinic_settings")
        .select("nome, cnpj")
        .maybeSingle();
      
      setClinic(clinicData);
    } catch (err) {
      setError("Erro ao carregar os dados do recibo.");
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async () => {
    if (!payment || !paciente) return;
    setDownloading(true);
    try {
      const numero = getReceiptNumber(payment.id, payment.created_at);
      const dateStr = payment.data_pagamento || payment.created_at;
      const dataPgto = dateStr ? dateFormats.date(dateStr) : "—";

      const doc = await generateReceiptPDF({
        numero,
        pacienteNome: paciente.nome || "Paciente",
        cpf: paciente.cpf || "",
        descricao: payment.descricao || "Serviço",
        valor: Math.abs(Number(payment.valor)),
        formaPagamento: payment.forma_pagamento || payment.forma_pagamento_id || "",
        dataPagamento: dataPgto,
        referencia: payment.descricao || "Serviço",
      });

      doc.save(`Recibo_${numero}.pdf`);
    } catch (err) {
      console.error("Erro ao gerar PDF:", err);
    } finally {
      setDownloading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50/50">
        <div className="text-center space-y-3">
          <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto" />
          <p className="text-muted-foreground animate-pulse">Preparando seu recibo...</p>
        </div>
      </div>
    );
  }

  if (error || !payment) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50/50 p-4">
        <Card className="max-w-md w-full shadow-lg border-red-100">
          <CardContent className="py-12 text-center space-y-4">
            <AlertCircle className="h-16 w-16 text-red-500 mx-auto" />
            <h2 className="text-xl font-bold">Ops! Algo deu errado.</h2>
            <p className="text-muted-foreground">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white p-4 flex items-start justify-center pt-10">
      <div className="max-w-lg w-full space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
        <div className="flex flex-col items-center text-center space-y-2 mb-4">
          <div className="h-16 w-16 bg-primary/10 rounded-full flex items-center justify-center mb-2">
            <CheckCircle2 className="h-10 w-10 text-primary" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Recibo Disponível</h1>
          <p className="text-muted-foreground">Seu pagamento foi confirmado com sucesso.</p>
        </div>

        <Card className="shadow-xl border-none ring-1 ring-gray-200">
          <CardHeader className="border-b bg-muted/30 pb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                <CardTitle className="text-lg">Informações do Pagamento</CardTitle>
              </div>
              <p className="text-xs font-mono text-muted-foreground">
                #{payment.id.substring(0, 8).toUpperCase()}
              </p>
            </div>
          </CardHeader>
          <CardContent className="pt-6 space-y-6">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground uppercase font-semibold">Valor Recebido</p>
              <p className="text-3xl font-bold text-primary">{formatBRL(Math.abs(Number(payment.valor)))}</p>
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground uppercase font-semibold">Paciente</p>
                <p className="font-medium">{paciente?.nome || "—"}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground uppercase font-semibold">Data</p>
                <p className="font-medium">{payment.data_pagamento ? dateFormats.date(payment.data_pagamento) : dateFormats.date(payment.created_at)}</p>
              </div>
            </div>

            <div className="space-y-1">
              <p className="text-xs text-muted-foreground uppercase font-semibold">Descrição</p>
              <p className="font-medium">{payment.descricao || "Serviço realizado"}</p>
            </div>

            <Button onClick={handleDownload} disabled={downloading} className="w-full h-12 text-base font-semibold gap-2 shadow-lg hover:shadow-xl transition-all">
              {downloading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Download className="h-5 w-5" />}
              {downloading ? "Gerando..." : "Baixar Recibo (PDF)"}
            </Button>
          </CardContent>
        </Card>

        <p className="text-center text-[10px] text-muted-foreground px-8 leading-relaxed">
          Este documento é uma representação digital do seu recibo. 
          A autenticidade deste registro pode ser verificada junto à administração da clínica.
        </p>
      </div>
    </div>
  );
};

export default PublicReceipt;
