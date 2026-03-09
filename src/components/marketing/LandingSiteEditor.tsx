import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Sparkles, Loader2, Save, ExternalLink, RefreshCw,
  Type, CreditCard, MessageSquare, Phone, Plus, Trash2, Star
} from "lucide-react";

interface HeroContent {
  badge: string;
  titulo: string;
  subtitulo: string;
  cta_primario: string;
  cta_secundario: string;
  destaques: string[];
}

interface PlanoItem {
  name: string;
  price: string;
  description: string;
  highlighted?: boolean;
  features: string[];
}

interface PlanosContent {
  titulo: string;
  subtitulo: string;
  planos: PlanoItem[];
}

interface DepoimentoItem {
  name: string;
  role: string;
  rating: number;
  text: string;
}

interface DepoimentosContent {
  titulo: string;
  depoimentos: DepoimentoItem[];
}

interface ContatoContent {
  whatsapp: string;
  email: string;
  instagram: string;
  titulo: string;
  subtitulo: string;
}

export function LandingSiteEditor() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [aiLoading, setAiLoading] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState("hero");

  // Fetch all sections
  const { data: sections, isLoading } = useQuery({
    queryKey: ["landing-content"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("landing_content")
        .select("*");
      if (error) throw error;
      return data as { id: string; secao: string; conteudo: any }[];
    },
  });

  const getSection = <T,>(name: string, fallback: T): T => {
    const found = sections?.find((s) => s.secao === name);
    return found ? (found.conteudo as T) : fallback;
  };

  // Local state for editing
  const [hero, setHero] = useState<HeroContent | null>(null);
  const [planos, setPlanos] = useState<PlanosContent | null>(null);
  const [depoimentos, setDepoimentos] = useState<DepoimentosContent | null>(null);
  const [contato, setContato] = useState<ContatoContent | null>(null);

  // Initialize state from DB
  const heroData = hero ?? getSection<HeroContent>("hero", {
    badge: "Potencializado por Inteligência Artificial",
    titulo: "Gestão inteligente para clínicas de saúde",
    subtitulo: "Sistema completo para fisioterapia, psicologia, nutrição, pilates, estética e muito mais.",
    cta_primario: "Agendar demonstração",
    cta_secundario: "Ver planos",
    destaques: ["Sem fidelidade", "Setup gratuito", "Suporte humanizado"],
  });

  const planosData = planos ?? getSection<PlanosContent>("planos", {
    titulo: "Planos que cabem no seu bolso",
    subtitulo: "Escolha o plano ideal para o tamanho da sua clínica",
    planos: [],
  });

  const depoimentosData = depoimentos ?? getSection<DepoimentosContent>("depoimentos", {
    titulo: "O que dizem nossos clientes",
    depoimentos: [],
  });

  const contatoData = contato ?? getSection<ContatoContent>("contato", {
    whatsapp: "5500000000000",
    email: "contato@essencialclinicas.com.br",
    instagram: "essencialclinicas",
    titulo: "Pronto para transformar sua clínica?",
    subtitulo: "Preencha o formulário ou entre em contato diretamente.",
  });

  const saveSection = async (secao: string, conteudo: any) => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from("landing_content")
        .upsert(
          { secao, conteudo, updated_by: user?.id, updated_at: new Date().toISOString() },
          { onConflict: "secao" }
        );
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["landing-content"] });
      toast({ title: "Seção salva!", description: `A seção "${secao}" foi atualizada.` });
    } catch (err: any) {
      toast({ title: "Erro ao salvar", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const generateWithAI = async (section: string, prompt: string) => {
    setAiLoading(section);
    try {
      const { data, error } = await supabase.functions.invoke("ai-marketing", {
        body: {
          type: "landing_section",
          context: {
            section,
            currentContent: section === "hero" ? heroData : section === "planos" ? planosData : section === "depoimentos" ? depoimentosData : contatoData,
            prompt,
            appName: "Essencial Clínicas",
            appDescription: "Sistema de gestão inteligente para clínicas de saúde multiespecialidade com IA integrada",
          },
        },
      });
      if (error) throw error;

      const content = data?.content || data;
      if (content) {
        if (section === "hero") setHero(content);
        else if (section === "planos") setPlanos(content);
        else if (section === "depoimentos") setDepoimentos(content);
        else if (section === "contato") setContato(content);
        toast({ title: "Conteúdo gerado!", description: "Revise e salve as alterações." });
      }
    } catch (err: any) {
      toast({ title: "Erro na IA", description: err.message, variant: "destructive" });
    } finally {
      setAiLoading(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with preview button */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Editor do Site de Vendas</h3>
          <p className="text-sm text-muted-foreground">Edite cada seção do site com auxílio da IA</p>
        </div>
        <Button variant="outline" className="gap-2" onClick={() => window.open("/site", "_blank")}>
          <ExternalLink className="h-4 w-4" /> Visualizar site
        </Button>
      </div>

      <Tabs value={activeSection} onValueChange={setActiveSection}>
        <TabsList className="grid grid-cols-4 w-full">
          <TabsTrigger value="hero" className="gap-1 text-xs">
            <Type className="h-3 w-3" /> Hero
          </TabsTrigger>
          <TabsTrigger value="planos" className="gap-1 text-xs">
            <CreditCard className="h-3 w-3" /> Planos
          </TabsTrigger>
          <TabsTrigger value="depoimentos" className="gap-1 text-xs">
            <Star className="h-3 w-3" /> Depoimentos
          </TabsTrigger>
          <TabsTrigger value="contato" className="gap-1 text-xs">
            <Phone className="h-3 w-3" /> Contato
          </TabsTrigger>
        </TabsList>

        {/* HERO SECTION */}
        <TabsContent value="hero">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">Seção Hero</CardTitle>
                  <CardDescription>Título principal, subtítulo e CTAs</CardDescription>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1"
                  disabled={aiLoading === "hero"}
                  onClick={() => generateWithAI("hero", "Gere um hero section persuasivo para vender um sistema SaaS de gestão de clínicas de saúde com IA integrada. Retorne JSON com: badge, titulo, subtitulo, cta_primario, cta_secundario, destaques (array de 3 strings).")}
                >
                  {aiLoading === "hero" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                  Gerar com IA
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1">
                <Label className="text-xs">Badge</Label>
                <Input value={heroData.badge} onChange={(e) => setHero({ ...heroData, badge: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Título Principal</Label>
                <Input value={heroData.titulo} onChange={(e) => setHero({ ...heroData, titulo: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Subtítulo</Label>
                <Textarea value={heroData.subtitulo} rows={2} onChange={(e) => setHero({ ...heroData, subtitulo: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">CTA Primário</Label>
                  <Input value={heroData.cta_primario} onChange={(e) => setHero({ ...heroData, cta_primario: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">CTA Secundário</Label>
                  <Input value={heroData.cta_secundario} onChange={(e) => setHero({ ...heroData, cta_secundario: e.target.value })} />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Destaques (separados por vírgula)</Label>
                <Input
                  value={heroData.destaques?.join(", ") || ""}
                  onChange={(e) => setHero({ ...heroData, destaques: e.target.value.split(",").map((s) => s.trim()) })}
                />
              </div>
              <Button className="w-full gap-2" disabled={saving} onClick={() => saveSection("hero", heroData)}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Salvar Hero
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* PLANOS SECTION */}
        <TabsContent value="planos">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">Seção Planos</CardTitle>
                  <CardDescription>Configure preços e funcionalidades de cada plano</CardDescription>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1"
                  disabled={aiLoading === "planos"}
                  onClick={() => generateWithAI("planos", "Gere 3 planos de preços para um SaaS de gestão de clínicas de saúde. Retorne JSON com: titulo, subtitulo, planos (array com name, price, description, highlighted (boolean), features (array de strings)).")}
                >
                  {aiLoading === "planos" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                  Gerar com IA
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Título</Label>
                  <Input value={planosData.titulo} onChange={(e) => setPlanos({ ...planosData, titulo: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Subtítulo</Label>
                  <Input value={planosData.subtitulo} onChange={(e) => setPlanos({ ...planosData, subtitulo: e.target.value })} />
                </div>
              </div>

              {planosData.planos?.map((plano, idx) => (
                <Card key={idx} className={`${plano.highlighted ? "border-primary" : ""}`}>
                  <CardContent className="pt-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <Badge variant={plano.highlighted ? "default" : "secondary"}>{plano.name || `Plano ${idx + 1}`}</Badge>
                      <div className="flex gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-6 w-6"
                          onClick={() => {
                            const updated = [...planosData.planos];
                            updated[idx] = { ...updated[idx], highlighted: !updated[idx].highlighted };
                            setPlanos({ ...planosData, planos: updated });
                          }}
                        >
                          <Star className={`h-3 w-3 ${plano.highlighted ? "fill-primary text-primary" : ""}`} />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-6 w-6 text-destructive"
                          onClick={() => {
                            const updated = planosData.planos.filter((_, i) => i !== idx);
                            setPlanos({ ...planosData, planos: updated });
                          }}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="space-y-1">
                        <Label className="text-xs">Nome</Label>
                        <Input value={plano.name} onChange={(e) => {
                          const updated = [...planosData.planos];
                          updated[idx] = { ...updated[idx], name: e.target.value };
                          setPlanos({ ...planosData, planos: updated });
                        }} />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Preço (R$)</Label>
                        <Input value={plano.price} onChange={(e) => {
                          const updated = [...planosData.planos];
                          updated[idx] = { ...updated[idx], price: e.target.value };
                          setPlanos({ ...planosData, planos: updated });
                        }} />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Descrição</Label>
                        <Input value={plano.description} onChange={(e) => {
                          const updated = [...planosData.planos];
                          updated[idx] = { ...updated[idx], description: e.target.value };
                          setPlanos({ ...planosData, planos: updated });
                        }} />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Funcionalidades (uma por linha)</Label>
                      <Textarea
                        value={plano.features?.join("\n") || ""}
                        rows={4}
                        onChange={(e) => {
                          const updated = [...planosData.planos];
                          updated[idx] = { ...updated[idx], features: e.target.value.split("\n").filter(Boolean) };
                          setPlanos({ ...planosData, planos: updated });
                        }}
                      />
                    </div>
                  </CardContent>
                </Card>
              ))}

              <Button
                variant="outline"
                size="sm"
                className="gap-1"
                onClick={() => {
                  setPlanos({
                    ...planosData,
                    planos: [...(planosData.planos || []), { name: "Novo Plano", price: "0", description: "", features: [] }],
                  });
                }}
              >
                <Plus className="h-3 w-3" /> Adicionar plano
              </Button>

              <Button className="w-full gap-2" disabled={saving} onClick={() => saveSection("planos", planosData)}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Salvar Planos
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* DEPOIMENTOS SECTION */}
        <TabsContent value="depoimentos">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">Depoimentos</CardTitle>
                  <CardDescription>Depoimentos de clientes exibidos no site</CardDescription>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1"
                  disabled={aiLoading === "depoimentos"}
                  onClick={() => generateWithAI("depoimentos", "Gere 3 depoimentos realistas de profissionais de saúde sobre um sistema de gestão de clínicas. Retorne JSON com: titulo, depoimentos (array com name, role, rating, text).")}
                >
                  {aiLoading === "depoimentos" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                  Gerar com IA
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1">
                <Label className="text-xs">Título da seção</Label>
                <Input value={depoimentosData.titulo} onChange={(e) => setDepoimentos({ ...depoimentosData, titulo: e.target.value })} />
              </div>

              {depoimentosData.depoimentos?.map((dep, idx) => (
                <Card key={idx}>
                  <CardContent className="pt-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <Badge variant="secondary">{dep.name || `Depoimento ${idx + 1}`}</Badge>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6 text-destructive"
                        onClick={() => {
                          const updated = depoimentosData.depoimentos.filter((_, i) => i !== idx);
                          setDepoimentos({ ...depoimentosData, depoimentos: updated });
                        }}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <Label className="text-xs">Nome</Label>
                        <Input value={dep.name} onChange={(e) => {
                          const updated = [...depoimentosData.depoimentos];
                          updated[idx] = { ...updated[idx], name: e.target.value };
                          setDepoimentos({ ...depoimentosData, depoimentos: updated });
                        }} />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Cargo / Especialidade</Label>
                        <Input value={dep.role} onChange={(e) => {
                          const updated = [...depoimentosData.depoimentos];
                          updated[idx] = { ...updated[idx], role: e.target.value };
                          setDepoimentos({ ...depoimentosData, depoimentos: updated });
                        }} />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Depoimento</Label>
                      <Textarea value={dep.text} rows={2} onChange={(e) => {
                        const updated = [...depoimentosData.depoimentos];
                        updated[idx] = { ...updated[idx], text: e.target.value };
                        setDepoimentos({ ...depoimentosData, depoimentos: updated });
                      }} />
                    </div>
                  </CardContent>
                </Card>
              ))}

              <Button
                variant="outline"
                size="sm"
                className="gap-1"
                onClick={() => {
                  setDepoimentos({
                    ...depoimentosData,
                    depoimentos: [...(depoimentosData.depoimentos || []), { name: "", role: "", rating: 5, text: "" }],
                  });
                }}
              >
                <Plus className="h-3 w-3" /> Adicionar depoimento
              </Button>

              <Button className="w-full gap-2" disabled={saving} onClick={() => saveSection("depoimentos", depoimentosData)}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Salvar Depoimentos
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* CONTATO SECTION */}
        <TabsContent value="contato">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Dados de Contato</CardTitle>
              <CardDescription>Informações exibidas na seção de contato do site</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1">
                <Label className="text-xs">Título</Label>
                <Input value={contatoData.titulo} onChange={(e) => setContato({ ...contatoData, titulo: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Subtítulo</Label>
                <Textarea value={contatoData.subtitulo} rows={2} onChange={(e) => setContato({ ...contatoData, subtitulo: e.target.value })} />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">WhatsApp (com DDI)</Label>
                  <Input value={contatoData.whatsapp} onChange={(e) => setContato({ ...contatoData, whatsapp: e.target.value })} placeholder="5511999999999" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Email</Label>
                  <Input value={contatoData.email} onChange={(e) => setContato({ ...contatoData, email: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Instagram (sem @)</Label>
                  <Input value={contatoData.instagram} onChange={(e) => setContato({ ...contatoData, instagram: e.target.value })} />
                </div>
              </div>
              <Button className="w-full gap-2" disabled={saving} onClick={() => saveSection("contato", contatoData)}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Salvar Contato
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
