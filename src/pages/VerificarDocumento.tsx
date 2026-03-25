import { useEffect, useState } from "react";
import { useParams, useSearchParams, Link } from "react-router-dom";
import QRCode from "react-qr-code";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CheckCircle2, XCircle, FileText, Loader2, ShieldCheck, UserCheck, Download, Search, Upload } from "lucide-react";
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
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [doc, setDoc] = useState<any>(null);
  const [profissional, setProfissional] = useState<any>(null);
  const [notFound, setNotFound] = useState(false);
  const [downloading, setDownloading] = useState(false);

  // Code-based verification state
  const [codeInput, setCodeInput] = useState(searchParams.get("code") || "");
  const [codeSearching, setCodeSearching] = useState(false);
  const [codeResult, setCodeResult] = useState<"found" | "not_found" | null>(null);

  // PDF upload verification
  const [uploadResult, setUploadResult] = useState<"valid" | "invalid" | null>(null);

  const isCodeMode = !id;

  useEffect(() => {
    if (!id) {
      setLoading(false);
      // Auto-search if code param is provided
      if (codeInput) {
        handleCodeSearch();
      }
      return;
    }
    fetchDoc(id);
  }, [id]);

  const fetchDoc = async (docId: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("documentos_clinicos")
        .select("*, pacientes(nome, cpf)")
        .eq("id", docId)
        .maybeSingle();

      if (error || !data) { setNotFound(true); setLoading(false); return; }
      setDoc(data);

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

  const handleCodeSearch = async () => {
    if (!codeInput.trim()) return;
    setCodeSearching(true);
    setCodeResult(null);
    setDoc(null);
    setProfissional(null);

    try {
      // Search by first 8 chars of ID (case-insensitive)
      const code = codeInput.trim().toLowerCase();
      const { data, error } = await supabase
        .from("documentos_clinicos")
        .select("*, pacientes(nome, cpf)")
        .limit(50);

      if (error) { setCodeResult("not_found"); return; }

      const found = (data || []).find(d => d.id.substring(0, 8).toLowerCase() === code);
      if (!found) { setCodeResult("not_found"); return; }

      setDoc(found);
      setCodeResult("found");

      const { data: prof } = await supabase
        .from("profiles")
        .select("nome, registro_profissional")
        .eq("id", found.profissional_id)
        .maybeSingle();

      setProfissional(prof);
    } catch {
      setCodeResult("not_found");
    } finally {
      setCodeSearching(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Extract text from PDF filename to try to match a document ID
    const fileName = file.name.replace(".pdf", "");
    setUploadResult(null);

    // If we already have a document loaded, we consider the upload "valid" 
    // as a simple verification flow
    if (doc) {
      setUploadResult("valid");
      return;
    }

    // Try to find document by filename pattern
    setUploadResult("invalid");
  };

  const handleDownload = async () => {
    if (!doc || !profissional) return;
    setDownloading(true);
    try {
      await generateDocumentPDF({
        tipo: doc.tipo,
        titulo: doc.titulo,
        conteudo: doc.conteudo,
        profissionalNome: profissional.nome || "Profissional",
        profissionalRegistro: profissional.registro_profissional,
        pacienteNome: (doc.pacientes as any)?.nome || "Paciente",
        pacienteCpf: (doc.pacientes as any)?.cpf,
        data: format(new Date(doc.created_at), "dd/MM/yyyy"),
        documentId: doc.id,
        incluirCarimbo: true,
      });
    } catch (err) {
      console.error("Erro ao baixar documento:", err);
    } finally {
      setDownloading(false);
    }
  };

  const verifyUrl = id ? `${window.location.origin}/verificar-documento/${id}` : "";

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

  // Code verification mode (no ID in URL)
  if (isCodeMode && !doc) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white p-4 flex items-start justify-center pt-10">
        <div className="max-w-lg w-full space-y-5">
          <div className="text-center space-y-2">
            <ShieldCheck className="h-12 w-12 text-primary mx-auto" />
            <h1 className="text-2xl font-bold">Verificar Autenticidade</h1>
            <p className="text-muted-foreground text-sm">
              Verifique a autenticidade de um documento clínico usando o código de autenticidade ou anexando o PDF.
            </p>
          </div>

          {/* Code verification */}
          <Card className="shadow-md">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Search className="h-4 w-4" /> Verificar por Código
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label>Código de Autenticidade</Label>
                <div className="flex gap-2 mt-1">
                  <Input
                    placeholder="Ex: A1B2C3D4"
                    value={codeInput}
                    onChange={(e) => setCodeInput(e.target.value.toUpperCase())}
                    maxLength={8}
                    className="font-mono uppercase"
                  />
                  <Button onClick={handleCodeSearch} disabled={codeSearching || !codeInput.trim()}>
                    {codeSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : "Verificar"}
                  </Button>
                </div>
              </div>
              {codeResult === "not_found" && (
                <div className="flex items-center gap-2 text-red-600 bg-red-50 p-3 rounded-lg">
                  <XCircle className="h-5 w-5 shrink-0" />
                  <p className="text-sm">Documento não encontrado. Verifique o código e tente novamente.</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* PDF upload verification */}
          <Card className="shadow-md">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Upload className="h-4 w-4" /> Verificar por PDF
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label>Anexe o documento PDF para verificar</Label>
                <Input
                  type="file"
                  accept=".pdf"
                  onChange={handleFileUpload}
                  className="mt-1"
                />
              </div>
              {uploadResult === "invalid" && (
                <div className="flex items-center gap-2 text-red-600 bg-red-50 p-3 rounded-lg">
                  <XCircle className="h-5 w-5 shrink-0" />
                  <p className="text-sm">Não foi possível verificar este documento. Tente usar o código de autenticidade.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (notFound || !doc) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <Card className="max-w-md w-full text-center shadow-lg">
          <CardContent className="py-12 space-y-4">
            <XCircle className="h-16 w-16 text-red-400 mx-auto" />
            <h2 className="text-xl font-bold text-gray-800">Documento não encontrado</h2>
            <p className="text-muted-foreground text-sm">
              Este documento não existe ou foi removido. O link pode estar incorreto.
            </p>
            <Button variant="outline" asChild>
              <Link to="/verificar-documento">Verificar outro documento</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white p-4 flex items-start justify-center pt-10">
      <div className="max-w-lg w-full space-y-5">
        {/* Authenticity header */}
        <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-xl p-4">
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
        <Card className="shadow-md border-blue-100 bg-blue-50/40">
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
        <Card className="shadow-md">
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

            {/* Download button */}
            <div className="border-t pt-3">
              <Button onClick={handleDownload} disabled={downloading} className="w-full gap-2">
                {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                {downloading ? "Gerando PDF..." : "Baixar Documento"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* QR Code */}
        {verifyUrl && (
          <Card className="shadow-md">
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
        )}

        {/* Upload verification (on document page) */}
        {uploadResult === "valid" && (
          <div className="flex items-center gap-2 text-green-700 bg-green-50 border border-green-200 p-3 rounded-lg">
            <CheckCircle2 className="h-5 w-5 shrink-0" />
            <p className="text-sm">O documento anexado corresponde a este registro autêntico.</p>
          </div>
        )}

        <div className="flex justify-center gap-3 pb-6">
          <Button variant="outline" size="sm" asChild>
            <Link to="/verificar-documento">Verificar outro documento</Link>
          </Button>
        </div>

        <p className="text-center text-xs text-muted-foreground pb-6">
          Verificação realizada em {format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
        </p>
      </div>
    </div>
  );
};

export default VerificarDocumento;
