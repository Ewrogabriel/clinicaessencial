import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import QRCode from "react-qr-code";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, FileText, Loader2, ShieldCheck, UserCheck } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const tipoLabels: Record<string, string> = {
  receituario: "Receituário",
  relatorio: "Relatório Clínico",
  atestado: "Atestado",
  encaminhamento: "Encaminhamento",
  comparecimento: "Comprovante de Comparecimento",
  outros: "Outros",
};

const VerificarDocumento = () => {
  const { id } = useParams<{ id: string }>();
  const [loading, setLoading] = useState(true);
  const [doc, setDoc] = useState<any>(null);
  const [profissional, setProfissional] = useState<any>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    const fetchDoc = async () => {
      if (!id) { setNotFound(true); setLoading(false); return; }
      try {
        const { data, error } = await supabase
          .from("documentos_clinicos")
          .select("*, pacientes(nome, cpf)")
          .eq("id", id)
          .maybeSingle();

        if (error || !data) { setNotFound(true); setLoading(false); return; }
        setDoc(data);

        // Fetch professional profile
        const { data: prof } = await supabase
          .from("profiles")
          .select("nome, registro_profissional")
          .eq("id", data.profissional_id)
          .maybeSingle();

        setProfissional(prof);
      } catch {
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    };
    fetchDoc();
  }, [id]);

  const verifyUrl = `${window.location.origin}/verificar-documento/${id}`;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin" />
          <p>Verificando documento...</p>
        </div>
      </div>
    );
  }

  if (notFound || !doc) {
    return (
      <div
        className="min-h-screen flex items-center justify-center bg-gray-50 p-4"
        data-testid="verify-not-found"
      >
        <Card className="max-w-md w-full text-center shadow-lg">
          <CardContent className="py-12 space-y-4">
            <XCircle className="h-16 w-16 text-red-400 mx-auto" />
            <h2 className="text-xl font-bold text-gray-800">Documento não encontrado</h2>
            <p className="text-muted-foreground text-sm">
              Este documento não existe ou foi removido. O link pode estar incorreto.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen bg-gradient-to-b from-gray-50 to-white p-4 flex items-start justify-center pt-10"
      data-testid="verify-document-page"
    >
      <div className="max-w-lg w-full space-y-5">
        {/* Authenticity header */}
        <div
          className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-xl p-4"
          data-testid="verify-status-badge"
        >
          <CheckCircle2 className="h-7 w-7 text-green-600 shrink-0" />
          <div>
            <p className="font-semibold text-green-800">Documento Autêntico</p>
            <p className="text-xs text-green-700">
              A autenticidade deste documento foi verificada com sucesso.
            </p>
          </div>
          <ShieldCheck className="h-6 w-6 text-green-400 ml-auto shrink-0" />
        </div>

        {/* Professional Card */}
        <Card className="shadow-md border-blue-100 bg-blue-50/40" data-testid="verify-professional-card">
          <CardContent className="py-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                <UserCheck className="h-5 w-5 text-blue-600" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-bold text-blue-900 text-base leading-tight">{profissional?.nome || "—"}</p>
                  <Badge className="bg-blue-100 text-blue-700 border-blue-200 text-xs gap-1 font-medium">
                    <UserCheck className="h-3 w-3" /> Profissional Verificado
                  </Badge>
                </div>
                {profissional?.registro_profissional && (
                  <p className="text-sm text-blue-700 mt-0.5 font-medium">
                    Registro: {profissional.registro_profissional}
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Document Info */}
        <Card className="shadow-md" data-testid="verify-document-info">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              <CardTitle className="text-base">{doc.titulo || tipoLabels[doc.tipo] || doc.tipo}</CardTitle>
            </div>
            <Badge className="w-fit mt-1">{tipoLabels[doc.tipo] || doc.tipo}</Badge>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Paciente</p>
                <p className="font-semibold">{(doc.pacientes as any)?.nome || "—"}</p>
              </div>
              {(doc.pacientes as any)?.cpf && (
                <div>
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">CPF</p>
                  <p className="font-semibold">{(doc.pacientes as any)?.cpf}</p>
                </div>
              )}
              <div>
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Data de emissão</p>
                <p className="font-semibold">
                  {format(new Date(doc.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">ID do documento</p>
                <p className="font-mono text-xs text-muted-foreground break-all">{doc.id}</p>
              </div>
            </div>

            <div className="border-t pt-3">
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-1">Conteúdo resumido</p>
              <p className="text-sm text-gray-700 line-clamp-4">{doc.conteudo}</p>
            </div>
          </CardContent>
        </Card>

        {/* QR Code */}
        <Card className="shadow-md" data-testid="verify-qrcode-card">
          <CardContent className="py-5 flex flex-col items-center gap-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              QR Code de Autenticidade
            </p>
            <div className="bg-white p-4 rounded-xl border shadow-sm">
              <QRCode
                value={verifyUrl}
                size={140}
                style={{ height: "auto", maxWidth: "100%", width: "100%" }}
                viewBox="0 0 256 256"
              />
            </div>
            <p className="text-xs text-center text-muted-foreground max-w-xs">
              Este QR Code é único para este documento e pode ser usado para verificar sua autenticidade a qualquer momento.
            </p>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground pb-6">
          Verificação realizada em {format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
        </p>
      </div>
    </div>
  );
};

export default VerificarDocumento;
