import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle, Loader2, Download } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { generateDocumentPDF } from "@/lib/generateDocumentPDF";

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
  const [downloading, setDownloading] = useState(false);

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

        // Fetch professional profile including signature and rubrica
        const { data: prof } = await supabase
          .from("profiles")
          .select("nome, registro_profissional, assinatura_url, rubrica_url")
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

  const handleDownload = async () => {
    if (!doc) return;
    setDownloading(true);
    try {
      await generateDocumentPDF({
        tipo: doc.tipo,
        titulo: doc.titulo,
        conteudo: doc.conteudo,
        profissionalNome: profissional?.nome || "Profissional",
        profissionalRegistro: profissional?.registro_profissional || undefined,
        pacienteNome: (doc.pacientes as any)?.nome || "Paciente",
        pacienteCpf: (doc.pacientes as any)?.cpf || undefined,
        data: format(new Date(doc.created_at), "dd/MM/yyyy"),
        incluirCarimbo: (doc.dados_extras as any)?.incluir_carimbo !== false,
        profissionalSignature: (doc.dados_extras as any)?.incluir_assinatura ? profissional?.assinatura_url : undefined,
        profissionalRubrica: (doc.dados_extras as any)?.rubrica_no_carimbo || (doc.dados_extras as any)?.incluir_rubrica ? profissional?.rubrica_url : undefined,
        rubricaNoCarimbo: (doc.dados_extras as any)?.rubrica_no_carimbo === true,
        documentId: doc.id,
      });
    } catch (error) {
      console.error("Erro ao baixar documento:", error);
    } finally {
      setDownloading(false);
    }
  };

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
      className="min-h-screen bg-gray-50 p-4 flex flex-col items-center pt-12"
      data-testid="verify-document-page"
    >
      <div className="max-w-md w-full space-y-6 flex flex-col items-center">
        
        {/* Header Icon */}
        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mb-2">
          <CheckCircle2 className="h-12 w-12 text-green-600" />
        </div>

        {/* Title */}
        <h1 className="text-3xl font-bold text-green-600 text-center">
          Documento válido
        </h1>

        {/* Description */}
        <p className="text-center text-gray-600 text-sm px-4">
          Este documento foi assinado digitalmente e sua validade pode ser confirmada pelos dados abaixo:
        </p>

        {/* Document Info Card */}
        <Card className="w-full shadow-sm border-gray-200" data-testid="verify-document-info">
          <CardHeader className="bg-gray-100/50 border-b border-gray-100 pb-3 pt-4">
            <CardTitle className="text-base font-semibold text-gray-800">Dados do Documento</CardTitle>
          </CardHeader>
          <CardContent className="p-5 space-y-4">
            <div className="space-y-1">
              <p className="text-xs text-gray-500 font-medium">Tipo:</p>
              <p className="text-sm font-semibold text-gray-900">{doc.titulo || tipoLabels[doc.tipo] || doc.tipo}</p>
            </div>
            
            <div className="space-y-1">
              <p className="text-xs text-gray-500 font-medium">Data de emissão:</p>
              <p className="text-sm font-semibold text-gray-900">
                {format(new Date(doc.created_at), "dd/MM/yyyy", { locale: ptBR })}
              </p>
            </div>

            <div className="space-y-1">
              <p className="text-xs text-gray-500 font-medium">Paciente:</p>
              <p className="text-sm font-semibold text-gray-900">{(doc.pacientes as any)?.nome || "—"}</p>
            </div>

            <div className="space-y-1">
              <p className="text-xs text-gray-500 font-medium">Profissional:</p>
              <p className="text-sm font-semibold text-gray-900">{profissional?.nome || "—"}</p>
            </div>

            {profissional?.registro_profissional && (
              <div className="space-y-1">
                <p className="text-xs text-gray-500 font-medium">Registro:</p>
                <p className="text-sm font-semibold text-gray-900">{profissional.registro_profissional}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Download Button */}
        <Button 
          className="w-full bg-primary hover:bg-primary/90 text-white py-6 text-base font-medium rounded-xl shadow-sm"
          onClick={handleDownload}
          disabled={downloading}
        >
          {downloading ? (
            <Loader2 className="h-5 w-5 animate-spin mr-2" />
          ) : (
            <Download className="h-5 w-5 mr-2" />
          )}
          Baixar documento original
        </Button>

      </div>
    </div>
  );
};

export default VerificarDocumento;
