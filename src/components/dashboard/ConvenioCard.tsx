import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useClinicSettings } from "@/modules/clinic/hooks/useClinicSettings";
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
  const [selectedConvenio, setSelectedConvenio] = useState<Convenio | null>(null);
  const navigate = useNavigate();
  const { data: clinicSettings } = useClinicSettings();

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

  // Auto-rotate every 8 seconds – pauses while detail dialog is open
  useEffect(() => {
    if (convenios.length <= 1 || detailOpen) return;
    setCurrentIndex(Math.floor(Math.random() * convenios.length));
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % convenios.length);
    }, 8000);
    return () => clearInterval(interval);
  }, [convenios.length, detailOpen]);

  if (convenios.length === 0) return null;

  const convenio = convenios[currentIndex];
  if (!convenio) return null;

  const getWhatsappUrl = (c: Convenio) => {
    const clinicName = clinicSettings?.nome || "nossa clínica";
    const whatsappMessage = encodeURIComponent(
      `Olá! 😊 Sou cliente da *${clinicName}* e vim através da parceria. Gostaria de saber mais sobre os serviços oferecidos. Poderia me ajudar?`
    );
    return c.whatsapp
      ? `https://wa.me/${c.whatsapp.replace(/\D/g, "")}?text=${whatsappMessage}`
      : null;
  };

  const whatsappUrl = getWhatsappUrl(convenio);
  const detailWhatsappUrl = selectedConvenio ? getWhatsappUrl(selectedConvenio) : null;

  return (
    <>
      <Card
        className="cursor-pointer hover:shadow-md transition-shadow border-primary/20 overflow-hidden"
        onClick={() => { setSelectedConvenio(convenio); setDetailOpen(true); }}
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
          <div className="flex items-center justify-between mt-2">
            <p className="text-xs text-muted-foreground">
              {convenios.length} parceiro{convenios.length !== 1 ? "s" : ""} disponíve{convenios.length !== 1 ? "is" : "l"}
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
        </CardContent>
      </Card>

      {/* Detail Dialog */}
      <Dialog open={detailOpen} onOpenChange={(open) => { setDetailOpen(open); if (!open) setSelectedConvenio(null); }}>
        <DialogContent className="sm:max-w-[500px] max-h-[85vh] overflow-y-auto">
          {selectedConvenio && (
          <>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5 text-primary" />
              {selectedConvenio.nome}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {selectedConvenio.imagem_descricao_url && (
              <img
                src={selectedConvenio.imagem_descricao_url}
                alt={selectedConvenio.nome}
                className="w-full rounded-lg object-cover max-h-56"
              />
            )}
            {!selectedConvenio.imagem_descricao_url && selectedConvenio.imagem_card_url && (
              <img
                src={selectedConvenio.imagem_card_url}
                alt={selectedConvenio.nome}
                className="w-full rounded-lg object-cover max-h-56"
              />
            )}

            {selectedConvenio.descricao && (
              <p className="text-sm text-muted-foreground leading-relaxed">{selectedConvenio.descricao}</p>
            )}

            <div className="space-y-2 text-sm">
              {selectedConvenio.endereco && (
                <div className="flex items-start gap-2">
                  <span className="text-muted-foreground">📍</span>
                  <span>{selectedConvenio.endereco}</span>
                </div>
              )}
              {selectedConvenio.telefone && (
                <div className="flex items-start gap-2">
                  <span className="text-muted-foreground">📞</span>
                  <span>{selectedConvenio.telefone}</span>
                </div>
              )}
              {selectedConvenio.email && (
                <div className="flex items-start gap-2">
                  <span className="text-muted-foreground">✉️</span>
                  <a href={`mailto:${selectedConvenio.email}`} className="text-primary hover:underline">{selectedConvenio.email}</a>
                </div>
              )}
              {selectedConvenio.site && (
                <div className="flex items-start gap-2">
                  <span className="text-muted-foreground">🌐</span>
                  <a href={selectedConvenio.site} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">{selectedConvenio.site}</a>
                </div>
              )}
              {selectedConvenio.instagram && (
                <div className="flex items-start gap-2">
                  <span className="text-muted-foreground">📸</span>
                  <a
                    href={`https://instagram.com/${selectedConvenio.instagram.replace("@", "")}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    {selectedConvenio.instagram}
                  </a>
                </div>
              )}
            </div>

            {detailWhatsappUrl && (
              <Button
                className="w-full gap-2 bg-green-600 hover:bg-green-700 text-white"
                onClick={() => window.open(detailWhatsappUrl, "_blank")}
              >
                <MessageCircle className="h-4 w-4" />
                Enviar WhatsApp
              </Button>
            )}
          </div>
          </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
