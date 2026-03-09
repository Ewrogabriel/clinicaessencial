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
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import {
  Sparkles, Loader2, Copy, Instagram, Globe, Target,
  Megaphone, Image, Clock, Hash, RefreshCw, FileText,
  Save, History, Trash2, ExternalLink, Rocket, TrendingUp,
  Mail, MessageSquare
} from "lucide-react";
import { MarketingImageGenerator } from "@/components/marketing/MarketingImageGenerator";
import { LandingSiteEditor } from "@/components/marketing/LandingSiteEditor";

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

export function MasterMarketingTab() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [savingCampaign, setSavingCampaign] = useState(false);
  const [activeTab, setActiveTab] = useState("sell-app");

  // Sell App Ads state
  const [appAds, setAppAds] = useState<Ad[]>([]);
  const [appPlatform, setAppPlatform] = useState("Instagram");
  const [appAudience, setAppAudience] = useState("Donos e gestores de clínicas de saúde");
  const [appObjective, setAppObjective] = useState("Captar novas clínicas");
  const [appHighlightPlan, setAppHighlightPlan] = useState("Professional");
  const [appDifferentials, setAppDifferentials] = useState("IA integrada, multi-clínica, prontuário digital");
  const [appTone, setAppTone] = useState("Profissional e persuasivo");

  // Email Campaigns state
  const [emailCampaigns, setEmailCampaigns] = useState<Ad[]>([]);
  const [emailAudience, setEmailAudience] = useState("Leads que solicitaram demonstração");
  const [emailObjective, setEmailObjective] = useState("Converter lead em cliente");

  // Social Selling state
  const [socialPosts, setSocialPosts] = useState<SocialPost[]>([]);
  const [postTheme, setPostTheme] = useState("Gestão de clínicas com tecnologia");
  const [postPlatform, setPostPlatform] = useState("LinkedIn");
  const [postType, setPostType] = useState("Case de sucesso");

  const generateAppAds = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("ai-marketing", {
        body: {
          type: "app_plans",
          context: {
            targetAudience: appAudience,
            platform: appPlatform,
            highlightPlan: appHighlightPlan,
            objective: appObjective,
            differentials: appDifferentials,
            tone: appTone,
            appName: "Essencial Clínicas",
            appFeatures: [
              "Agenda inteligente com IA",
              "Prontuário digital completo",
              "Financeiro automatizado com comissões",
              "Multi-clínica e cross-booking",
              "Portal do paciente",
              "Gamificação e metas",
              "Marketing com IA",
              "Relatórios e KPIs em tempo real",
              "Documentos clínicos com IA",
              "12+ especialidades suportadas",
            ],
          },
        },
      });
      if (error) throw error;
      setAppAds(data?.ads || []);
      toast({ title: "Anúncios de venda do app gerados!" });
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const generateEmailCampaigns = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("ai-marketing", {
        body: {
          type: "app_plans",
          context: {
            targetAudience: emailAudience,
            platform: "Email Marketing",
            highlightPlan: appHighlightPlan,
            objective: emailObjective,
            appName: "Essencial Clínicas",
            tone: "Profissional e consultivo",
          },
        },
      });
      if (error) throw error;
      setEmailCampaigns(data?.ads || []);
      toast({ title: "Campanhas de email geradas!" });
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
            clinicName: "Essencial Clínicas",
            theme: postTheme,
            platform: postPlatform,
            postType,
            appSelling: true,
          },
        },
      });
      if (error) throw error;
      setSocialPosts(data?.posts || []);
      toast({ title: "Posts de social selling gerados!" });
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  // Saved campaigns
  const { data: savedCampaigns = [], refetch: refetchCampaigns } = useQuery({
    queryKey: ["master-marketing-campaigns"],
    queryFn: async () => {
      const { data, error } = await supabase.from("marketing_campaigns")
        .select("*")
        .is("clinic_id", null)
        .order("created_at", { ascending: false })
        .limit(30);
      if (error) throw error;
      return data || [];
    },
  });

  const saveCampaign = async (tipo: string, conteudo: any, titulo?: string) => {
    if (!user) return;
    setSavingCampaign(true);
    try {
      const { error } = await supabase.from("marketing_campaigns").insert({
        clinic_id: null,
        tipo,
        plataforma: tipo === "sell_app" ? appPlatform : tipo === "email_campaign" ? "Email" : postPlatform,
        conteudo,
        titulo: titulo || `Master ${tipo} - ${new Date().toLocaleDateString("pt-BR")}`,
        created_by: user.id,
      });
      if (error) throw error;
      toast({ title: "Campanha salva!", description: "Disponível no histórico." });
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
          <Badge variant="outline" className="gap-1 text-xs">
            {ad.plataforma || appPlatform}
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
          <Button variant="outline" size="sm" className="gap-1"
            onClick={() => copyToClipboard(`${ad.titulo}\n\n${ad.texto}\n\n${ad.cta}\n\n${ad.hashtags?.map(h => h.startsWith("#") ? h : `#${h}`).join(" ")}`)}>
            <Copy className="h-3 w-3" /> Copiar Tudo
          </Button>
          <Button variant="ghost" size="sm" className="gap-1" onClick={() => copyToClipboard(ad.texto)}>
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
          <Button variant="outline" size="sm" className="gap-1"
            onClick={() => copyToClipboard(`${post.legenda}\n\n${post.hashtags?.map(h => h.startsWith("#") ? h : `#${h}`).join(" ")}`)}>
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
      <div className="flex items-center gap-3 mb-2">
        <Rocket className="h-5 w-5 text-primary" />
        <div>
          <h2 className="text-lg font-semibold">Marketing de Venda do App</h2>
          <p className="text-sm text-muted-foreground">Gere anúncios e conteúdos com IA para vender o Essencial Clínicas para outras clínicas</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-5 lg:w-[850px]">
          <TabsTrigger value="sell-app" className="gap-2 text-xs sm:text-sm">
            <Target className="h-4 w-4" /> Anúncios
          </TabsTrigger>
          <TabsTrigger value="email-campaigns" className="gap-2 text-xs sm:text-sm">
            <Mail className="h-4 w-4" /> Email
          </TabsTrigger>
          <TabsTrigger value="social-selling" className="gap-2 text-xs sm:text-sm">
            <TrendingUp className="h-4 w-4" /> Social
          </TabsTrigger>
          <TabsTrigger value="site-editor" className="gap-2 text-xs sm:text-sm">
            <Globe className="h-4 w-4" /> Site
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-2 text-xs sm:text-sm">
            <History className="h-4 w-4" /> Histórico
          </TabsTrigger>
        </TabsList>

        {/* SELL APP ADS */}
        <TabsContent value="sell-app" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Rocket className="h-5 w-5 text-primary" />
                Anúncios para Vender o App
              </CardTitle>
              <CardDescription>
                Gere campanhas publicitárias para atrair novas clínicas para a plataforma Essencial Clínicas
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Público-alvo</Label>
                  <Input value={appAudience} onChange={(e) => setAppAudience(e.target.value)}
                    placeholder="Ex: Donos de clínicas de fisioterapia" />
                </div>
                <div className="space-y-2">
                  <Label>Objetivo</Label>
                  <Select value={appObjective} onValueChange={setAppObjective}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Captar novas clínicas">Captar novas clínicas</SelectItem>
                      <SelectItem value="Gerar leads para demonstração">Gerar leads para demonstração</SelectItem>
                      <SelectItem value="Promover plano específico">Promover plano específico</SelectItem>
                      <SelectItem value="Remarketing para leads">Remarketing para leads</SelectItem>
                      <SelectItem value="Lançamento de feature">Lançamento de feature</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Plano em Destaque</Label>
                  <Select value={appHighlightPlan} onValueChange={setAppHighlightPlan}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Starter">Starter (R$97/mês)</SelectItem>
                      <SelectItem value="Professional">Professional (R$197/mês)</SelectItem>
                      <SelectItem value="Enterprise">Enterprise (R$397/mês)</SelectItem>
                      <SelectItem value="Todos os planos">Todos os planos</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Diferenciais</Label>
                  <Input value={appDifferentials} onChange={(e) => setAppDifferentials(e.target.value)}
                    placeholder="Ex: IA, multi-clínica, prontuário digital" />
                </div>
                <div className="space-y-2">
                  <Label>Plataforma</Label>
                  <Select value={appPlatform} onValueChange={setAppPlatform}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Instagram">Instagram</SelectItem>
                      <SelectItem value="Facebook">Facebook</SelectItem>
                      <SelectItem value="LinkedIn">LinkedIn</SelectItem>
                      <SelectItem value="Google Ads">Google Ads</SelectItem>
                      <SelectItem value="YouTube">YouTube</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Tom de Voz</Label>
                  <Select value={appTone} onValueChange={setAppTone}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Profissional e persuasivo">Profissional e persuasivo</SelectItem>
                      <SelectItem value="Jovem e inovador">Jovem e inovador</SelectItem>
                      <SelectItem value="Consultivo e educativo">Consultivo e educativo</SelectItem>
                      <SelectItem value="Urgente e direto">Urgente e direto</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button onClick={generateAppAds} disabled={loading} className="gap-2">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                {loading ? "Gerando..." : "Gerar Anúncios com IA"}
              </Button>
            </CardContent>
          </Card>

          {appAds.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">Anúncios Gerados</h3>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => saveCampaign("sell_app", { ads: appAds })} disabled={savingCampaign} className="gap-1">
                    <Save className="h-3 w-3" /> Salvar
                  </Button>
                  <Button variant="outline" size="sm" onClick={generateAppAds} disabled={loading} className="gap-1">
                    <RefreshCw className="h-3 w-3" /> Regenerar
                  </Button>
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {appAds.map((ad, i) => renderAdCard(ad, i))}
              </div>
            </div>
          )}
        </TabsContent>

        {/* EMAIL CAMPAIGNS */}
        <TabsContent value="email-campaigns" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Mail className="h-5 w-5 text-primary" />
                Campanhas de Email Marketing
              </CardTitle>
              <CardDescription>
                Crie sequências de email para converter leads em clientes da plataforma
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Público do Email</Label>
                  <Select value={emailAudience} onValueChange={setEmailAudience}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Leads que solicitaram demonstração">Leads que solicitaram demo</SelectItem>
                      <SelectItem value="Clínicas em período de trial">Clínicas em trial</SelectItem>
                      <SelectItem value="Clínicas que cancelaram">Clínicas que cancelaram (win-back)</SelectItem>
                      <SelectItem value="Contatos frios de clínicas">Contatos frios (prospecção)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Objetivo do Email</Label>
                  <Select value={emailObjective} onValueChange={setEmailObjective}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Converter lead em cliente">Converter lead em cliente</SelectItem>
                      <SelectItem value="Agendar demonstração">Agendar demonstração</SelectItem>
                      <SelectItem value="Upgrade de plano">Upgrade de plano</SelectItem>
                      <SelectItem value="Retenção e engajamento">Retenção e engajamento</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Plano em Destaque</Label>
                  <Select value={appHighlightPlan} onValueChange={setAppHighlightPlan}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Starter">Starter</SelectItem>
                      <SelectItem value="Professional">Professional</SelectItem>
                      <SelectItem value="Enterprise">Enterprise</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button onClick={generateEmailCampaigns} disabled={loading} className="gap-2">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                {loading ? "Gerando..." : "Gerar Emails com IA"}
              </Button>
            </CardContent>
          </Card>

          {emailCampaigns.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">Emails Gerados</h3>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => saveCampaign("email_campaign", { ads: emailCampaigns })} disabled={savingCampaign} className="gap-1">
                    <Save className="h-3 w-3" /> Salvar
                  </Button>
                  <Button variant="outline" size="sm" onClick={generateEmailCampaigns} disabled={loading} className="gap-1">
                    <RefreshCw className="h-3 w-3" /> Regenerar
                  </Button>
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                {emailCampaigns.map((ad, i) => renderAdCard(ad, i))}
              </div>
            </div>
          )}
        </TabsContent>

        {/* SOCIAL SELLING */}
        <TabsContent value="social-selling" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-primary" />
                Social Selling
              </CardTitle>
              <CardDescription>
                Crie posts para redes sociais que posicionem o Essencial Clínicas como referência em gestão clínica
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Tema</Label>
                  <Input value={postTheme} onChange={(e) => setPostTheme(e.target.value)}
                    placeholder="Ex: Transformação digital em clínicas" />
                </div>
                <div className="space-y-2">
                  <Label>Tipo de Conteúdo</Label>
                  <Select value={postType} onValueChange={setPostType}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Case de sucesso">Case de sucesso</SelectItem>
                      <SelectItem value="Dor do mercado">Dor do mercado</SelectItem>
                      <SelectItem value="Feature highlight">Feature highlight</SelectItem>
                      <SelectItem value="Comparativo">Comparativo (antes/depois)</SelectItem>
                      <SelectItem value="Dados e métricas">Dados e métricas</SelectItem>
                      <SelectItem value="Depoimento">Depoimento de cliente</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Plataforma</Label>
                  <Select value={postPlatform} onValueChange={setPostPlatform}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="LinkedIn">LinkedIn</SelectItem>
                      <SelectItem value="Instagram">Instagram</SelectItem>
                      <SelectItem value="Facebook">Facebook</SelectItem>
                      <SelectItem value="TikTok">TikTok</SelectItem>
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
                  <Button variant="outline" size="sm" onClick={() => saveCampaign("social_selling", { posts: socialPosts })} disabled={savingCampaign} className="gap-1">
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

        {/* SITE EDITOR */}
        <TabsContent value="site-editor" className="space-y-6">
          <LandingSiteEditor />
        </TabsContent>

        {/* HISTORY */}
        <TabsContent value="history" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <History className="h-5 w-5" /> Campanhas Salvas
              </CardTitle>
              <CardDescription>Histórico de campanhas de venda do app geradas pela IA</CardDescription>
            </CardHeader>
            <CardContent>
              {savedCampaigns.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  Nenhuma campanha salva ainda. Gere conteúdos e clique em "Salvar".
                </p>
              ) : (
                <div className="space-y-3">
                  {savedCampaigns.map((campaign: any) => (
                    <Card key={campaign.id} className="border-border/50">
                      <CardHeader className="py-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <CardTitle className="text-sm">{campaign.titulo || "Campanha"}</CardTitle>
                            <CardDescription className="text-xs">
                              {campaign.tipo === "sell_app" ? "Anúncios do App" :
                               campaign.tipo === "email_campaign" ? "Email Marketing" :
                               campaign.tipo === "social_selling" ? "Social Selling" : campaign.tipo}
                              {campaign.plataforma && ` • ${campaign.plataforma}`}
                              {" • "}
                              {new Date(campaign.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })}
                            </CardDescription>
                          </div>
                          <div className="flex gap-2">
                            <Button variant="ghost" size="sm" className="gap-1 text-xs"
                              onClick={() => {
                                const content = campaign.conteudo as any;
                                if (content.ads) {
                                  setAppAds(content.ads);
                                  setActiveTab(campaign.tipo === "email_campaign" ? "email-campaigns" : "sell-app");
                                } else if (content.posts) {
                                  setSocialPosts(content.posts);
                                  setActiveTab("social-selling");
                                }
                                toast({ title: "Campanha carregada!" });
                              }}>
                              <ExternalLink className="h-3 w-3" /> Ver
                            </Button>
                            <Button variant="ghost" size="sm" className="gap-1 text-xs text-destructive hover:text-destructive"
                              onClick={() => deleteCampaign(campaign.id)}>
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
}
