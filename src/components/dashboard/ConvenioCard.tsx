import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Globe, MessageCircle, ChevronRight, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";

interface Convenio {
  id: string;
  nome: string;
  descricao: string | null;
  whatsapp: string | null;
  site: string | null;
  instagram: string | null;
  email: string | null;
  endereco: string | null;
  telefone: string | null;
  imagem_card_url: string | null;
  imagem_descricao_url: string | null;
}

export function ConvenioCard() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [detailOpen, setDetailOpen] = useState(false);
  const navigate = useNavigate();

  const { data: convenios = [] } = useQuery<Convenio[]>({
    queryKey: ["convenios-ativos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("convenios")
        .select("id, nome, descricao, whatsapp, site, instagram, email, endereco, telefone, imagem_card_url, imagem_descricao_url")
        .eq("ativo", true)
        .order("nome");
      if (error) throw error;
      return (data || []) as Convenio[];
    },
  });

  // Rotate on each page load / component mount
  useEffect(() => {
    if (convenios.length > 0) {
      setCurrentIndex(Math.floor(Math.random() * convenios.length));
    }
  }, [convenios.length]);

  if (convenios.length === 0) return null;

  const convenio = convenios[currentIndex];
  if (!convenio) return null;

  const whatsappUrl = convenio.whatsapp
    ? `https://wa.me/${convenio.whatsapp.replace(/\D/g, "")}`
    : null;

  return (
    <>
      <Card
        className="cursor-pointer hover:shadow-md transition-shadow border-primary/20 overflow-hidden"
        onClick={() => setDetailOpen(true)}
      >
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-bold flex items-center gap-2">
            <Globe className="h-5 w-5 text-primary" />
            Parceiros
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="flex items-center gap-4 p-3 rounded-lg bg-muted/40">
            {convenio.imagem_card_url ? (
              <img
                src={convenio.imagem_card_url}
                alt={convenio.nome}
                className="h-16 w-16 rounded-lg object-cover shrink-0"
              />
            ) : (
              <div className="h-16 w-16 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <Globe className="h-8 w-8 text-primary" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-base truncate">{convenio.nome}</p>
              {convenio.descricao && (
                <p className="text-sm text-muted-foreground line-clamp-2 mt-1">{convenio.descricao}</p>
              )}
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {whatsappUrl && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-9 w-9 p-0 text-green-600 hover:text-green-700 hover:bg-green-50 dark:hover:bg-green-950/20"
                  onClick={(e) => {
                    e.stopPropagation();
                    window.open(whatsappUrl, "_blank");
                  }}
                  title="Enviar WhatsApp"
                >
                  <MessageCircle className="h-5 w-5" />
                </Button>
              )}
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            </div>
          </div>
          {convenios.length > 1 && (
            <div className="flex items-center justify-between mt-2">
              <p className="text-xs text-muted-foreground">
                {convenios.length} parceiros disponíveis
              </p>
              <Button
                variant="link"
                size="sm"
                className="text-xs h-auto p-0"
                onClick={(e) => {
                  e.stopPropagation();
                  navigate("/convenios");
                }}
              >
                Ver todos →
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detail Dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="sm:max-w-[500px] max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5 text-primary" />
              {convenio.nome}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {convenio.imagem_descricao_url && (
              <img
                src={convenio.imagem_descricao_url}
                alt={convenio.nome}
                className="w-full rounded-lg object-cover max-h-56"
              />
            )}
            {!convenio.imagem_descricao_url && convenio.imagem_card_url && (
              <img
                src={convenio.imagem_card_url}
                alt={convenio.nome}
                className="w-full rounded-lg object-cover max-h-56"
              />
            )}

            {convenio.descricao && (
              <p className="text-sm text-muted-foreground leading-relaxed">{convenio.descricao}</p>
            )}

            <div className="space-y-2 text-sm">
              {convenio.endereco && (
                <div className="flex items-start gap-2">
                  <span className="text-muted-foreground">📍</span>
                  <span>{convenio.endereco}</span>
                </div>
              )}
              {convenio.telefone && (
                <div className="flex items-start gap-2">
                  <span className="text-muted-foreground">📞</span>
                  <span>{convenio.telefone}</span>
                </div>
              )}
              {convenio.email && (
                <div className="flex items-start gap-2">
                  <span className="text-muted-foreground">✉️</span>
                  <a href={`mailto:${convenio.email}`} className="text-primary hover:underline">{convenio.email}</a>
                </div>
              )}
              {convenio.site && (
                <div className="flex items-start gap-2">
                  <span className="text-muted-foreground">🌐</span>
                  <a href={convenio.site} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">{convenio.site}</a>
                </div>
              )}
              {convenio.instagram && (
                <div className="flex items-start gap-2">
                  <span className="text-muted-foreground">📸</span>
                  <a
                    href={`https://instagram.com/${convenio.instagram.replace("@", "")}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    {convenio.instagram}
                  </a>
                </div>
              )}
            </div>

            {whatsappUrl && (
              <Button
                className="w-full gap-2 bg-green-600 hover:bg-green-700 text-white"
                onClick={() => window.open(whatsappUrl, "_blank")}
              >
                <MessageCircle className="h-4 w-4" />
                Enviar WhatsApp
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
