import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useClinic } from "@/modules/clinic/hooks/useClinic";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Sparkles, Save, ExternalLink, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

const slugify = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

const SECTIONS_AI = ["hero", "sobre", "servicos", "diferenciais", "faq", "depoimentos", "contato"] as const;

export default function SiteEditor() {
  const { activeClinicId } = useClinic();
  const qc = useQueryClient();
  const [site, setSite] = useState<any>(null);
  const [aiBusy, setAiBusy] = useState<string | null>(null);

  const { data: clinic } = useQuery({
    queryKey: ["clinic", activeClinicId],
    queryFn: async () => {
      if (!activeClinicId) return null;
      const { data } = await supabase.from("clinicas").select("*").eq("id", activeClinicId).single();
      return data;
    },
    enabled: !!activeClinicId,
  });

  const { data: existing, isLoading } = useQuery({
    queryKey: ["clinic-site", activeClinicId],
    queryFn: async () => {
      if (!activeClinicId) return null;
      const { data } = await supabase.from("clinic_sites" as any).select("*").eq("clinic_id", activeClinicId).maybeSingle();
      return data;
    },
    enabled: !!activeClinicId,
  });

  useEffect(() => {
    if (existing) setSite(existing);
    else if (clinic && !site) {
      setSite({
        clinic_id: activeClinicId,
        slug: slugify(clinic.nome || "clinica"),
        publicado: false,
        hero: { titulo: `Bem-vindo à ${clinic.nome}`, subtitulo: "", cta_label: "Agendar avaliação", cta_url: "" },
        sobre: { titulo: "Sobre nós", texto: "" },
        servicos: { titulo: "Serviços", itens: [] },
        equipe_config: { titulo: "Nossa equipe", mostrar: true, profissional_ids: [] },
        diferenciais: { titulo: "Diferenciais", itens: [] },
        depoimentos: { titulo: "Depoimentos", itens: [] },
        faq: { titulo: "Perguntas frequentes", itens: [] },
        contato: { titulo: "Fale conosco", mensagem: "", mostrar_endereco: true, mostrar_telefone: true, mostrar_email: true, mostrar_whatsapp: true },
        galeria: { titulo: "Galeria", imagens: [] },
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existing, clinic]);

  const save = useMutation({
    mutationFn: async () => {
      if (!site) throw new Error("Sem dados");
      const payload = { ...site, clinic_id: activeClinicId };
      if (existing?.id) {
        const { error } = await supabase.from("clinic_sites" as any).update(payload).eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("clinic_sites" as any).insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Site salvo!");
      qc.invalidateQueries({ queryKey: ["clinic-site", activeClinicId] });
    },
    onError: (e: any) => toast.error(e.message || "Erro ao salvar"),
  });

  const generateAI = async (section: typeof SECTIONS_AI[number]) => {
    if (!clinic) return;
    setAiBusy(section);
    try {
      const { data, error } = await supabase.functions.invoke("generate-site-content", {
        body: { section, clinic: { nome: clinic.nome, cidade: clinic.cidade, estado: clinic.estado } },
      });
      if (error) throw error;
      const content = data?.content;
      if (content) {
        setSite((prev: any) => ({ ...prev, [section]: { ...prev[section], ...content } }));
        toast.success(`Seção "${section}" gerada por IA`);
      }
    } catch (e: any) {
      toast.error(e.message || "Falha ao gerar com IA");
    } finally {
      setAiBusy(null);
    }
  };

  if (isLoading || !site) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  const update = (key: string, value: any) => setSite((p: any) => ({ ...p, [key]: value }));
  const updateSection = (section: string, key: string, value: any) =>
    setSite((p: any) => ({ ...p, [section]: { ...p[section], [key]: value } }));

  const publicUrl = `${window.location.origin}/c/${site.slug}`;

  const AiBtn = ({ section }: { section: typeof SECTIONS_AI[number] }) => (
    <Button type="button" variant="outline" size="sm" onClick={() => generateAI(section)} disabled={aiBusy === section}>
      {aiBusy === section ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
      <span className="ml-2">Gerar com IA</span>
    </Button>
  );

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Site da Clínica</h1>
          <p className="text-muted-foreground">Edite o site público da sua clínica e publique quando estiver pronto.</p>
        </div>
        <div className="flex gap-2">
          {site.publicado && (
            <Button variant="outline" asChild>
              <a href={publicUrl} target="_blank" rel="noopener"><ExternalLink className="h-4 w-4 mr-2" />Ver site</a>
            </Button>
          )}
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            <span className="ml-2">Salvar</span>
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="pt-6 grid md:grid-cols-2 gap-4">
          <div>
            <Label>Endereço público (slug)</Label>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">/c/</span>
              <Input value={site.slug} onChange={(e) => update("slug", slugify(e.target.value))} />
            </div>
            <p className="text-xs text-muted-foreground mt-1">URL: {publicUrl}</p>
          </div>
          <div className="flex items-center justify-between md:justify-end gap-3">
            <Label htmlFor="publicado" className="cursor-pointer">Publicado</Label>
            <Switch id="publicado" checked={!!site.publicado} onCheckedChange={(v) => update("publicado", v)} />
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="hero" className="w-full">
        <TabsList className="flex flex-wrap h-auto">
          <TabsTrigger value="hero">Topo</TabsTrigger>
          <TabsTrigger value="sobre">Sobre</TabsTrigger>
          <TabsTrigger value="servicos">Serviços</TabsTrigger>
          <TabsTrigger value="diferenciais">Diferenciais</TabsTrigger>
          <TabsTrigger value="equipe">Equipe</TabsTrigger>
          <TabsTrigger value="depoimentos">Depoimentos</TabsTrigger>
          <TabsTrigger value="faq">FAQ</TabsTrigger>
          <TabsTrigger value="contato">Contato</TabsTrigger>
          <TabsTrigger value="seo">SEO</TabsTrigger>
        </TabsList>

        <TabsContent value="hero">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Topo (Hero)</CardTitle>
              <AiBtn section="hero" />
            </CardHeader>
            <CardContent className="space-y-3">
              <div><Label>Título</Label><Input value={site.hero?.titulo || ""} onChange={(e) => updateSection("hero", "titulo", e.target.value)} /></div>
              <div><Label>Subtítulo</Label><Textarea value={site.hero?.subtitulo || ""} onChange={(e) => updateSection("hero", "subtitulo", e.target.value)} /></div>
              <div className="grid md:grid-cols-2 gap-3">
                <div><Label>Texto do botão</Label><Input value={site.hero?.cta_label || ""} onChange={(e) => updateSection("hero", "cta_label", e.target.value)} /></div>
                <div><Label>Link do botão</Label><Input value={site.hero?.cta_url || ""} placeholder="#contato ou https://..." onChange={(e) => updateSection("hero", "cta_url", e.target.value)} /></div>
              </div>
              <div><Label>URL da imagem de fundo</Label><Input value={site.hero_image_url || ""} onChange={(e) => update("hero_image_url", e.target.value)} /></div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sobre">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Sobre nós</CardTitle>
              <AiBtn section="sobre" />
            </CardHeader>
            <CardContent className="space-y-3">
              <div><Label>Título</Label><Input value={site.sobre?.titulo || ""} onChange={(e) => updateSection("sobre", "titulo", e.target.value)} /></div>
              <div><Label>Texto</Label><Textarea rows={8} value={site.sobre?.texto || ""} onChange={(e) => updateSection("sobre", "texto", e.target.value)} /></div>
            </CardContent>
          </Card>
        </TabsContent>

        {(["servicos", "diferenciais"] as const).map((sec) => (
          <TabsContent key={sec} value={sec}>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>{sec === "servicos" ? "Serviços" : "Diferenciais"}</CardTitle>
                <AiBtn section={sec} />
              </CardHeader>
              <CardContent className="space-y-3">
                <div><Label>Título da seção</Label><Input value={site[sec]?.titulo || ""} onChange={(e) => updateSection(sec, "titulo", e.target.value)} /></div>
                {(site[sec]?.itens || []).map((item: any, i: number) => (
                  <Card key={i}><CardContent className="pt-4 space-y-2">
                    <div className="flex justify-between items-start gap-2">
                      <Input placeholder={sec === "servicos" ? "Nome do serviço" : "Título"} value={item.nome || item.titulo || ""} onChange={(e) => {
                        const itens = [...site[sec].itens];
                        itens[i] = { ...item, [sec === "servicos" ? "nome" : "titulo"]: e.target.value };
                        updateSection(sec, "itens", itens);
                      }} />
                      <Button type="button" variant="ghost" size="icon" onClick={() => {
                        const itens = site[sec].itens.filter((_: any, j: number) => j !== i);
                        updateSection(sec, "itens", itens);
                      }}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                    <Textarea placeholder="Descrição" value={item.descricao || ""} onChange={(e) => {
                      const itens = [...site[sec].itens];
                      itens[i] = { ...item, descricao: e.target.value };
                      updateSection(sec, "itens", itens);
                    }} />
                  </CardContent></Card>
                ))}
                <Button type="button" variant="outline" size="sm" onClick={() => {
                  const itens = [...(site[sec]?.itens || []), sec === "servicos" ? { nome: "", descricao: "" } : { titulo: "", descricao: "" }];
                  updateSection(sec, "itens", itens);
                }}><Plus className="h-4 w-4 mr-2" />Adicionar item</Button>
              </CardContent>
            </Card>
          </TabsContent>
        ))}

        <TabsContent value="equipe">
          <Card>
            <CardHeader><CardTitle>Equipe</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div><Label>Título</Label><Input value={site.equipe_config?.titulo || ""} onChange={(e) => updateSection("equipe_config", "titulo", e.target.value)} /></div>
              <div className="flex items-center gap-2">
                <Switch checked={site.equipe_config?.mostrar !== false} onCheckedChange={(v) => updateSection("equipe_config", "mostrar", v)} />
                <Label>Mostrar seção de equipe (usa profissionais cadastrados na clínica)</Label>
              </div>
              <p className="text-xs text-muted-foreground">Por padrão, todos os profissionais ativos da clínica aparecem. A seleção individual pode ser feita no JSON futuramente.</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="depoimentos">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Depoimentos</CardTitle>
              <AiBtn section="depoimentos" />
            </CardHeader>
            <CardContent className="space-y-3">
              <div><Label>Título</Label><Input value={site.depoimentos?.titulo || ""} onChange={(e) => updateSection("depoimentos", "titulo", e.target.value)} /></div>
              {(site.depoimentos?.itens || []).map((item: any, i: number) => (
                <Card key={i}><CardContent className="pt-4 space-y-2">
                  <div className="flex justify-between gap-2">
                    <Input placeholder="Nome" value={item.nome || ""} onChange={(e) => {
                      const itens = [...site.depoimentos.itens]; itens[i] = { ...item, nome: e.target.value };
                      updateSection("depoimentos", "itens", itens);
                    }} />
                    <Button type="button" variant="ghost" size="icon" onClick={() => {
                      const itens = site.depoimentos.itens.filter((_: any, j: number) => j !== i);
                      updateSection("depoimentos", "itens", itens);
                    }}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                  <Textarea placeholder="Texto do depoimento" value={item.texto || ""} onChange={(e) => {
                    const itens = [...site.depoimentos.itens]; itens[i] = { ...item, texto: e.target.value };
                    updateSection("depoimentos", "itens", itens);
                  }} />
                  <Input placeholder="Cargo / relação (ex: Paciente)" value={item.cargo || ""} onChange={(e) => {
                    const itens = [...site.depoimentos.itens]; itens[i] = { ...item, cargo: e.target.value };
                    updateSection("depoimentos", "itens", itens);
                  }} />
                </CardContent></Card>
              ))}
              <Button type="button" variant="outline" size="sm" onClick={() => {
                const itens = [...(site.depoimentos?.itens || []), { nome: "", texto: "", cargo: "Paciente" }];
                updateSection("depoimentos", "itens", itens);
              }}><Plus className="h-4 w-4 mr-2" />Adicionar depoimento</Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="faq">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>FAQ</CardTitle>
              <AiBtn section="faq" />
            </CardHeader>
            <CardContent className="space-y-3">
              <div><Label>Título</Label><Input value={site.faq?.titulo || ""} onChange={(e) => updateSection("faq", "titulo", e.target.value)} /></div>
              {(site.faq?.itens || []).map((item: any, i: number) => (
                <Card key={i}><CardContent className="pt-4 space-y-2">
                  <div className="flex justify-between gap-2">
                    <Input placeholder="Pergunta" value={item.pergunta || ""} onChange={(e) => {
                      const itens = [...site.faq.itens]; itens[i] = { ...item, pergunta: e.target.value };
                      updateSection("faq", "itens", itens);
                    }} />
                    <Button type="button" variant="ghost" size="icon" onClick={() => {
                      const itens = site.faq.itens.filter((_: any, j: number) => j !== i);
                      updateSection("faq", "itens", itens);
                    }}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                  <Textarea placeholder="Resposta" value={item.resposta || ""} onChange={(e) => {
                    const itens = [...site.faq.itens]; itens[i] = { ...item, resposta: e.target.value };
                    updateSection("faq", "itens", itens);
                  }} />
                </CardContent></Card>
              ))}
              <Button type="button" variant="outline" size="sm" onClick={() => {
                const itens = [...(site.faq?.itens || []), { pergunta: "", resposta: "" }];
                updateSection("faq", "itens", itens);
              }}><Plus className="h-4 w-4 mr-2" />Adicionar pergunta</Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="contato">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Contato</CardTitle>
              <AiBtn section="contato" />
            </CardHeader>
            <CardContent className="space-y-3">
              <div><Label>Título</Label><Input value={site.contato?.titulo || ""} onChange={(e) => updateSection("contato", "titulo", e.target.value)} /></div>
              <div><Label>Mensagem</Label><Textarea value={site.contato?.mensagem || ""} onChange={(e) => updateSection("contato", "mensagem", e.target.value)} /></div>
              <p className="text-sm text-muted-foreground">Os dados de contato são puxados automaticamente do cadastro da clínica.</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="seo">
          <Card>
            <CardHeader><CardTitle>SEO</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div><Label>Título da página (meta title)</Label><Input value={site.meta_titulo || ""} maxLength={60} onChange={(e) => update("meta_titulo", e.target.value)} /></div>
              <div><Label>Descrição (meta description)</Label><Textarea value={site.meta_descricao || ""} maxLength={160} onChange={(e) => update("meta_descricao", e.target.value)} /></div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
