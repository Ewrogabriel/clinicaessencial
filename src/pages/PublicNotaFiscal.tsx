import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { FileText, Download, Loader2 } from "lucide-react";
import { notasFiscaisService } from "@/modules/finance/services/notasFiscaisService";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function PublicNotaFiscal() {
  const { token } = useParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      if (!token) return;
      try {
        const result = await notasFiscaisService.getByPublicToken(token);
        if (!result) {
          setError("Link inválido ou expirado.");
          return;
        }
        setData(result);
        const url = await notasFiscaisService.getSignedUrl(result.arquivo_path, 600);
        setSignedUrl(url);
      } catch (e: any) {
        setError(e.message || "Erro ao carregar nota.");
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle>Link indisponível</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              {error || "Nota fiscal não encontrada."}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30 p-4">
      <div className="max-w-4xl mx-auto space-y-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              {data.clinic_logo && (
                <img
                  src={data.clinic_logo}
                  alt="Logo"
                  className="h-12 w-12 rounded object-contain"
                />
              )}
              <div>
                <CardTitle className="text-lg">{data.clinic_nome || "Nota Fiscal"}</CardTitle>
                <p className="text-xs text-muted-foreground">
                  {data.paciente_nome} • Ref. {data.mes_referencia}
                </p>
              </div>
            </div>
            {signedUrl && (
              <Button asChild>
                <a href={signedUrl} target="_blank" rel="noreferrer">
                  <Download className="h-4 w-4 mr-2" /> Baixar
                </a>
              </Button>
            )}
          </CardHeader>
          <CardContent>
            {signedUrl ? (
              <iframe
                src={signedUrl}
                title={data.nome_arquivo}
                className="w-full h-[75vh] rounded-md border"
              />
            ) : (
              <div className="flex items-center justify-center py-12 text-muted-foreground">
                <FileText className="h-10 w-10 opacity-30" />
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
