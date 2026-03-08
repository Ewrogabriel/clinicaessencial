import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { AlertCircle, Building2, MessageCircle, PartyPopper, TrendingUp } from "lucide-react";

interface PatientInfoTabProps {
  avisos: any[];
  feriados: any[];
  frequencyStats: any;
  clinicSettings: any;
  openWhatsAppClinic: () => void;
}

export const PatientInfoTab = ({
  avisos, feriados, frequencyStats, clinicSettings, openWhatsAppClinic
}: PatientInfoTabProps) => {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {/* Feriados */}
      {feriados.length > 0 && (
        <Card className="border-primary/30 bg-primary/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <PartyPopper className="h-5 w-5 text-primary" />
              Feriados – Clínica Fechada
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {feriados.map((f: any) => (
                <div key={f.id} className="flex items-center justify-between p-2 rounded-md bg-background border text-sm">
                  <span className="font-medium">{f.descricao}</span>
                  <Badge variant="outline">{format(new Date(f.data + "T12:00:00"), "dd/MM/yyyy (EEE)", { locale: ptBR })}</Badge>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-3">⚠️ Não haverá atendimentos nestas datas.</p>
          </CardContent>
        </Card>
      )}

      {/* Avisos */}
      <Card className="bg-primary/5 border-primary/20">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-primary" />
            Mural de Avisos
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm space-y-3">
          {avisos.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">Nenhum aviso no momento.</p>
          ) : (
            avisos.map((aviso: any) => (
              <div key={aviso.id} className="bg-background p-3 rounded-md border shadow-sm">
                <h4 className="font-semibold text-primary">{aviso.titulo}</h4>
                <p className="mt-1 text-muted-foreground whitespace-pre-wrap">{aviso.mensagem}</p>
                <span className="text-[10px] text-muted-foreground mt-2 block">
                  {format(new Date(aviso.created_at), "dd/MM/yyyy", { locale: ptBR })}
                </span>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* Estatísticas */}
      {frequencyStats && frequencyStats.total > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              Estatísticas de Frequência
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
              <div className="p-3 rounded-lg bg-muted">
                <p className="text-2xl font-bold">{frequencyStats.total}</p>
                <p className="text-xs text-muted-foreground">Total</p>
              </div>
              <div className="p-3 rounded-lg bg-muted">
                <p className="text-2xl font-bold text-primary">{frequencyStats.realizados}</p>
                <p className="text-xs text-muted-foreground">Realizadas</p>
              </div>
              <div className="p-3 rounded-lg bg-muted">
                <p className="text-2xl font-bold text-destructive">{frequencyStats.cancelados}</p>
                <p className="text-xs text-muted-foreground">Canceladas</p>
              </div>
              <div className="p-3 rounded-lg bg-muted">
                <p className="text-2xl font-bold text-destructive">{frequencyStats.faltas}</p>
                <p className="text-xs text-muted-foreground">Faltas</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Sobre a Clínica */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            Sobre a Clínica
          </CardTitle>
        </CardHeader>
        <CardContent>
          {clinicSettings ? (
            <div className="flex items-start gap-4">
              {clinicSettings.logo_url && (
                <img src={clinicSettings.logo_url} alt="Logo" className="h-16 w-16 rounded-lg object-cover border shrink-0" />
              )}
              <div className="space-y-1 text-sm">
                <p className="font-semibold text-base">{clinicSettings.nome}</p>
                {clinicSettings.cnpj && <p className="text-muted-foreground">CNPJ: {clinicSettings.cnpj}</p>}
                {clinicSettings.endereco && (
                  <p className="text-muted-foreground">
                    {[clinicSettings.endereco, clinicSettings.numero ? `nº ${clinicSettings.numero}` : "", clinicSettings.bairro, clinicSettings.cidade, clinicSettings.estado].filter(Boolean).join(", ")}
                  </p>
                )}
                {clinicSettings.telefone && <p className="text-muted-foreground">Tel: {clinicSettings.telefone}</p>}
                {clinicSettings.instagram && <p className="text-muted-foreground">Instagram: {clinicSettings.instagram}</p>}
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground animate-pulse">Carregando...</p>
          )}
          <div className="flex gap-2 mt-4">
            {clinicSettings?.whatsapp && (
              <Button variant="outline" size="sm" onClick={openWhatsAppClinic} className="gap-2">
                <MessageCircle className="h-4 w-4" /> WhatsApp Clínica
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
