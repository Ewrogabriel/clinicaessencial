import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useClinicSettings } from "@/hooks/useClinicSettings";
import { useClinic } from "@/hooks/useClinic";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import {
  Sparkles, Loader2, Copy, Instagram, Globe, Target,
  Megaphone, Image, Clock, Hash, ExternalLink, RefreshCw, FileText,
  Save, History, Trash2
} from "lucide-react";
import { MarketingImageGenerator } from "@/components/marketing/MarketingImageGenerator";

interface Ad {
  titulo: string;
  texto: string;
  cta: string;
  hashtags: string[];
  sugestao_imagem: string;
  plataforma?: string;
  plano_destaque?: string;
}

interface SocialPost {
  legenda: string;
  hashtags: string[];
  sugestao_visual: string;
  melhor_horario: string;
}

const Marketing = () => {
  const { data: settings } = useClinicSettings();
  const { activeClinicId } = useClinic();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [savingCampaign, setSavingCampaign] = useState(false);
  const [activeTab, setActiveTab] = useState("clinic-ads");

  // Clinic Ads state
  const [clinicAds, setClinicAds] = useState<Ad[]>([]);
  const [specialties, setSpecialties] = useState("");
  const [targetAudience, setTargetAudience] = useState("Adultos 25-55 anos");
  const [differentials, setDifferentials] = useState("");
  const [objective, setObjective] = useState("Atrair novos pacientes");
  const [platform, setPlatform] = useState("Instagram");
  const [tone, setTone] = useState("Profissional e acolhedor");

  // App Plans Ads state
  const [planAds, setPlanAds] = useState<Ad[]>([]);
  const [highlightPlan, setHighlightPlan] = useState("Professional");
  const [planPlatform, setPlanPlatform] = useState("Instagram");
  const [planAudience, setPlanAudience] = useState("Donos e gestores de clínicas de saúde");

  // Social Posts state
  const [socialPosts, setSocialPosts] = useState<SocialPost[]>([]);
  const [postTheme, setPostTheme] = useState("Saúde e bem-estar");
  const [postPlatform, setPostPlatform] = useState("Instagram");
  const [postType, setPostType] = useState("Educativo");

  const generateClinicAds = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("ai-marketing", {
        body: {
          type: "clinic_ads",
          context: {
            clinicName: settings?.nome || "Clínica",
            specialties: specialties || "Saúde e bem-estar",
            targetAudience,
            differentials,
            objective,
            platform,
            tone,
          },
        },
      });
      if (error) throw error;
      setClinicAds(data?.ads || []);
      toast({ title: "Anúncios gerados com sucesso!" });
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const generatePlanAds = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("ai-marketing", {
        body: {
          type: "app_plans",
          context: {
            targetAudience: planAudience,
            platform: planPlatform,
            highlightPlan,
          },
        },
      });
      if (error) throw error;
      setPlanAds(data?.ads || []);
      toast({ title: "Anúncios de planos gerados!" });
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const generateSocialPosts = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("ai-marketing", {
        body: {
          type: "social_post",
          context: {
            clinicName: settings?.nome || "Clínica",
            theme: postTheme,
            platform: postPlatform,
            postType,
          },
        },
      });
      if (error) throw error;
      setSocialPosts(data?.posts || []);
      toast({ title: "Posts gerados com sucesso!" });
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  // Saved campaigns
  const { data: savedCampaigns = [], refetch: refetchCampaigns } = useQuery({
    queryKey: ["marketing-campaigns", activeClinicId],
    queryFn: async () => {
      const { data, error } = await supabase.from("marketing_campaigns")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data || [];
    },
  });

  const saveCampaign = async (tipo: string, conteudo: any, titulo?: string) => {
    if (!user) return;
    setSavingCampaign(true);
    try {
      const { error } = await supabase.from("marketing_campaigns").insert({
        clinic_id: activeClinicId || null,
        tipo,
        plataforma: tipo === "clinic_ads" ? platform : tipo === "app_plans" ? planPlatform : postPlatform,
        conteudo,
        titulo: titulo || `Campanha ${tipo} - ${new Date().toLocaleDateString("pt-BR")}`,
        created_by: user.id,
      });
      if (error) throw error;
      toast({ title: "Campanha salva!", description: "Você pode acessá-la no histórico." });
      refetchCampaigns();
    } catch (err: any) {
      toast({ title: "Erro ao salvar", description: err.message, variant: "destructive" });
    } finally {
      setSavingCampaign(false);
    }
  };

  const deleteCampaign = async (id: string) => {
    const { error } = await supabase.from("marketing_campaigns").delete().eq("id", id);
    if (error) {
      toast({ title: "Erro ao excluir", variant: "destructive" });
    } else {
      toast({ title: "Campanha excluída" });
      refetchCampaigns();
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copiado!", description: "Texto copiado para a área de transferência" });
  };

  const renderAdCard = (ad: Ad, index: number) => (
    <Card key={index} className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-base flex items-center gap-2">
              <Target className="h-4 w-4 text-primary" />
              {ad.titulo}
            </CardTitle>
            {ad.plano_destaque && (
              <Badge variant="secondary" className="mt-1">{ad.plano_destaque}</Badge>
            )}
          </div>
          <Badge variant="outline" className="gap-1">
            <Instagram className="h-3 w-3" />
            {ad.plataforma || platform}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label className="text-xs text-muted-foreground">Texto do Anúncio</Label>
          <p className="text-sm mt-1">{ad.texto}</p>
        </div>

        <div className="flex items-center gap-2">
          <Label className="text-xs text-muted-foreground">CTA:</Label>
          <Badge variant="default">{ad.cta}</Badge>
        </div>

        <div>
          <Label className="text-xs text-muted-foreground flex items-center gap-1">
            <Image className="h-3 w-3" /> Sugestão de Imagem
          </Label>
          <p className="text-xs mt-1 text-muted-foreground italic">{ad.sugestao_imagem}</p>
        </div>

        <div className="flex flex-wrap gap-1">
          {ad.hashtags?.map((tag, i) => (
            <Badge key={i} variant="outline" className="text-xs gap-1">
              <Hash className="h-3 w-3" />
              {tag.replace("#", "")}
            </Badge>
          ))}
        </div>

        <div className="flex gap-2 pt-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            className="gap-1"
            onClick={() => copyToClipboard(`${ad.titulo}\n\n${ad.texto}\n\n${ad.cta}\n\n${ad.hashtags?.map(h => h.startsWith("#") ? h : `#${h}`).join(" ")}`)}
          >
            <Copy className="h-3 w-3" /> Copiar Tudo
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="gap-1"
            onClick={() => copyToClipboard(ad.texto)}
          >
            <FileText className="h-3 w-3" /> Só Texto
          </Button>
          <MarketingImageGenerator
            prompt={ad.sugestao_imagem}
            context={`${ad.titulo} - ${ad.texto}`}
          />
        </div>
      </CardContent>
    </Card>
  );

  const renderPostCard = (post: SocialPost, index: number) => (
    <Card key={index} className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Megaphone className="h-4 w-4 text-primary" />
          Post {index + 1}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label className="text-xs text-muted-foreground">Legenda</Label>
          <p className="text-sm mt-1 whitespace-pre-line">{post.legenda}</p>
        </div>

        <div className="flex items-center gap-2">
          <Clock className="h-3 w-3 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">Melhor horário: {post.melhor_horario}</span>
        </div>

        <div>
          <Label className="text-xs text-muted-foreground flex items-center gap-1">
            <Image className="h-3 w-3" /> Sugestão Visual
          </Label>
          <p className="text-xs mt-1 text-muted-foreground italic">{post.sugestao_visual}</p>
        </div>

        <div className="flex flex-wrap gap-1">
          {post.hashtags?.map((tag, i) => (
            <Badge key={i} variant="outline" className="text-xs gap-1">
              <Hash className="h-3 w-3" />
              {tag.replace("#", "")}
            </Badge>
          ))}
        </div>

        <div className="flex gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            className="gap-1"
            onClick={() => copyToClipboard(`${post.legenda}\n\n${post.hashtags?.map(h => h.startsWith("#") ? h : `#${h}`).join(" ")}`)}
          >
            <Copy className="h-3 w-3" /> Copiar Post
          </Button>
          <MarketingImageGenerator
            prompt={post.sugestao_visual}
            context={post.legenda.substring(0, 200)}
          />
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight font-[Plus_Jakarta_Sans]">Marketing</h1>
        <p className="text-muted-foreground">Gere anúncios e conteúdos com IA para atrair pacientes e divulgar serviços</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-4 lg:w-[800px]">
          <TabsTrigger value="clinic-ads" className="gap-2">
            <Target className="h-4 w-4" /> Anúncios da Clínica
          </TabsTrigger>
          <TabsTrigger value="plan-ads" className="gap-2">
            <Megaphone className="h-4 w-4" /> Venda de Planos
          </TabsTrigger>
          <TabsTrigger value="social-posts" className="gap-2">
            <Instagram className="h-4 w-4" /> Posts Sociais
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-2">
            <History className="h-4 w-4" /> Histórico
          </TabsTrigger>
        </TabsList>

        {/* CLINIC ADS TAB */}
        <TabsContent value="clinic-ads" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Gerador de Anúncios para Clínica</CardTitle>
              <CardDescription>Use IA para criar anúncios que atraiam novos pacientes</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Especialidades da Clínica</Label>
                  <Input
                    value={specialties}
                    onChange={(e) => setSpecialties(e.target.value)}
                    placeholder="Ex: Fisioterapia, Pilates, Psicologia..."
                  />
                </div>
                <div className="space-y-2">
                  <Label>Público-alvo</Label>
                  <Input
                    value={targetAudience}
                    onChange={(e) => setTargetAudience(e.target.value)}
                    placeholder="Ex: Adultos 25-55 anos"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Diferenciais</Label>
                  <Input
                    value={differentials}
                    onChange={(e) => setDifferentials(e.target.value)}
                    placeholder="Ex: Atendimento humanizado, equipamentos modernos"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Objetivo</Label>
                  <Select value={objective} onValueChange={setObjective}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Atrair novos pacientes">Atrair novos pacientes</SelectItem>
                      <SelectItem value="Promover serviço específico">Promover serviço específico</SelectItem>
                      <SelectItem value="Aumentar agendamentos">Aumentar agendamentos</SelectItem>
                      <SelectItem value="Divulgar promoção">Divulgar promoção</SelectItem>
                      <SelectItem value="Fortalecer marca">Fortalecer marca</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Plataforma</Label>
                  <Select value={platform} onValueChange={setPlatform}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Instagram">Instagram</SelectItem>
                      <SelectItem value="Facebook">Facebook</SelectItem>
                      <SelectItem value="Google Ads">Google Ads</SelectItem>
                      <SelectItem value="WhatsApp">WhatsApp</SelectItem>
                      <SelectItem value="TikTok">TikTok</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Tom de Voz</Label>
                  <Select value={tone} onValueChange={setTone}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Profissional e acolhedor">Profissional e acolhedor</SelectItem>
                      <SelectItem value="Jovem e descontraído">Jovem e descontraído</SelectItem>
                      <SelectItem value="Técnico e informativo">Técnico e informativo</SelectItem>
                      <SelectItem value="Urgente e persuasivo">Urgente e persuasivo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button onClick={generateClinicAds} disabled={loading} className="gap-2">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                {loading ? "Gerando..." : "Gerar Anúncios com IA"}
              </Button>
            </CardContent>
          </Card>

          {clinicAds.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">Anúncios Gerados</h3>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => saveCampaign("clinic_ads", { ads: clinicAds })} disabled={savingCampaign} className="gap-1">
                    <Save className="h-3 w-3" /> Salvar
                  </Button>
                  <Button variant="outline" size="sm" onClick={generateClinicAds} disabled={loading} className="gap-1">
                    <RefreshCw className="h-3 w-3" /> Regenerar
                  </Button>
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {clinicAds.map((ad, i) => renderAdCard(ad, i))}
              </div>
            </div>
          )}
        </TabsContent>

        {/* PLAN ADS TAB */}
        <TabsContent value="plan-ads" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Anúncios para Venda de Planos</CardTitle>
              <CardDescription>Gere campanhas para vender os planos do sistema para outras clínicas</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Plano em Destaque</Label>
                  <Select value={highlightPlan} onValueChange={setHighlightPlan}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Starter">Starter (R$97/mês)</SelectItem>
                      <SelectItem value="Professional">Professional (R$197/mês)</SelectItem>
                      <SelectItem value="Enterprise">Enterprise (R$397/mês)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Público-alvo</Label>
                  <Input
                    value={planAudience}
                    onChange={(e) => setPlanAudience(e.target.value)}
                    placeholder="Donos de clínicas..."
                  />
                </div>
                <div className="space-y-2">
                  <Label>Plataforma</Label>
                  <Select value={planPlatform} onValueChange={setPlanPlatform}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Instagram">Instagram</SelectItem>
                      <SelectItem value="Facebook">Facebook</SelectItem>
                      <SelectItem value="LinkedIn">LinkedIn</SelectItem>
                      <SelectItem value="Google Ads">Google Ads</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button onClick={generatePlanAds} disabled={loading} className="gap-2">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                {loading ? "Gerando..." : "Gerar Anúncios de Planos"}
              </Button>
            </CardContent>
          </Card>

          {planAds.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">Anúncios de Planos Gerados</h3>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => saveCampaign("app_plans", { ads: planAds })} disabled={savingCampaign} className="gap-1">
                    <Save className="h-3 w-3" /> Salvar
                  </Button>
                  <Button variant="outline" size="sm" onClick={generatePlanAds} disabled={loading} className="gap-1">
                    <RefreshCw className="h-3 w-3" /> Regenerar
                  </Button>
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {planAds.map((ad, i) => renderAdCard(ad, i))}
              </div>
            </div>
          )}
        </TabsContent>

        {/* SOCIAL POSTS TAB */}
        <TabsContent value="social-posts" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Gerador de Posts para Redes Sociais</CardTitle>
              <CardDescription>Crie conteúdo educativo e engajante para suas redes sociais</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Tema</Label>
                  <Input
                    value={postTheme}
                    onChange={(e) => setPostTheme(e.target.value)}
                    placeholder="Ex: Dor nas costas, Postura..."
                  />
                </div>
                <div className="space-y-2">
                  <Label>Tipo de Conteúdo</Label>
                  <Select value={postType} onValueChange={setPostType}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Educativo">Educativo</SelectItem>
                      <SelectItem value="Motivacional">Motivacional</SelectItem>
                      <SelectItem value="Bastidores">Bastidores</SelectItem>
                      <SelectItem value="Depoimento">Depoimento / Prova social</SelectItem>
                      <SelectItem value="Dica rápida">Dica rápida</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Plataforma</Label>
                  <Select value={postPlatform} onValueChange={setPostPlatform}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Instagram">Instagram</SelectItem>
                      <SelectItem value="Facebook">Facebook</SelectItem>
                      <SelectItem value="TikTok">TikTok</SelectItem>
                      <SelectItem value="LinkedIn">LinkedIn</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button onClick={generateSocialPosts} disabled={loading} className="gap-2">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                {loading ? "Gerando..." : "Gerar Posts com IA"}
              </Button>
            </CardContent>
          </Card>

          {socialPosts.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">Posts Gerados</h3>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => saveCampaign("social_post", { posts: socialPosts })} disabled={savingCampaign} className="gap-1">
                    <Save className="h-3 w-3" /> Salvar
                  </Button>
                  <Button variant="outline" size="sm" onClick={generateSocialPosts} disabled={loading} className="gap-1">
                    <RefreshCw className="h-3 w-3" /> Regenerar
                  </Button>
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {socialPosts.map((post, i) => renderPostCard(post, i))}
              </div>
            </div>
          )}
        </TabsContent>

        {/* HISTORY TAB */}
        <TabsContent value="history" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <History className="h-5 w-5" /> Campanhas Salvas
              </CardTitle>
              <CardDescription>Histórico de conteúdos gerados e salvos pela IA</CardDescription>
            </CardHeader>
            <CardContent>
              {savedCampaigns.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  Nenhuma campanha salva ainda. Gere conteúdos nas abas acima e clique em "Salvar".
                </p>
              ) : (
                <div className="space-y-4">
                  {savedCampaigns.map((campaign: any) => (
                    <Card key={campaign.id} className="border-border/50">
                      <CardHeader className="py-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <CardTitle className="text-sm">{campaign.titulo || "Campanha"}</CardTitle>
                            <CardDescription className="text-xs">
                              {campaign.tipo === "clinic_ads" ? "Anúncios da Clínica" :
                               campaign.tipo === "app_plans" ? "Venda de Planos" : "Posts Sociais"}
                              {campaign.plataforma && ` • ${campaign.plataforma}`}
                              {" • "}
                              {new Date(campaign.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })}
                            </CardDescription>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="gap-1 text-xs"
                              onClick={() => {
                                const content = campaign.conteudo;
                                if (campaign.tipo === "clinic_ads" || campaign.tipo === "app_plans") {
                                  setClinicAds(content.ads || []);
                                  setActiveTab(campaign.tipo === "clinic_ads" ? "clinic-ads" : "plan-ads");
                                } else {
                                  setSocialPosts(content.posts || []);
                                  setActiveTab("social-posts");
                                }
                                toast({ title: "Campanha carregada!" });
                              }}
                            >
                              <ExternalLink className="h-3 w-3" /> Ver
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="gap-1 text-xs text-destructive hover:text-destructive"
                              onClick={() => deleteCampaign(campaign.id)}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      </CardHeader>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Marketing;
