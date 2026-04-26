import { useEffect } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Loader2, Phone, Mail, MapPin, Instagram, MessageCircle } from "lucide-react";

interface SiteData {
  site: any;
  clinic: any;
  profissionais: any[];
}

export default function PublicClinicSite() {
  const { slug } = useParams<{ slug: string }>();

  const { data, isLoading, error } = useQuery({
    queryKey: ["public-site", slug],
    queryFn: async (): Promise<SiteData | null> => {
      const { data, error } = await supabase.rpc("get_public_clinic_site" as any, { p_slug: slug });
      if (error) throw error;
      return data as any;
    },
    enabled: !!slug,
  });

  useEffect(() => {
    if (data?.site?.meta_titulo) document.title = data.site.meta_titulo;
    else if (data?.clinic?.nome) document.title = data.clinic.nome;
    if (data?.site?.meta_descricao) {
      let meta = document.querySelector('meta[name="description"]');
      if (!meta) {
        meta = document.createElement("meta");
        meta.setAttribute("name", "description");
        document.head.appendChild(meta);
      }
      meta.setAttribute("content", data.site.meta_descricao);
    }
  }, [data]);

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }
  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">Site não encontrado</h1>
          <p className="text-muted-foreground">Verifique o endereço ou aguarde a publicação pela clínica.</p>
        </div>
      </div>
    );
  }

  const { site, clinic, profissionais } = data;
  const primary = site.cor_primaria || "hsl(var(--primary))";
  const heroBg = site.hero_image_url ? `url(${site.hero_image_url})` : `linear-gradient(135deg, ${primary}, hsl(var(--accent)))`;
  const wppLink = clinic.whatsapp ? `https://wa.me/55${String(clinic.whatsapp).replace(/\D/g, "")}` : null;

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur border-b">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {clinic.logo_url && <img src={clinic.logo_url} alt={clinic.nome} className="h-10 w-10 rounded object-contain" />}
            <span className="font-bold text-lg">{clinic.nome}</span>
          </div>
          <nav className="hidden md:flex gap-6 text-sm">
            <a href="#sobre" className="hover:text-primary">Sobre</a>
            <a href="#servicos" className="hover:text-primary">Serviços</a>
            <a href="#equipe" className="hover:text-primary">Equipe</a>
            <a href="#contato" className="hover:text-primary">Contato</a>
          </nav>
          {wppLink && (
            <Button asChild size="sm" className="gap-2">
              <a href={wppLink} target="_blank" rel="noopener"><MessageCircle className="h-4 w-4" /> WhatsApp</a>
            </Button>
          )}
        </div>
      </header>

      {/* Hero */}
      <section className="relative min-h-[60vh] flex items-center" style={{ backgroundImage: heroBg, backgroundSize: "cover", backgroundPosition: "center" }}>
        <div className="absolute inset-0 bg-black/40" />
        <div className="container mx-auto px-4 relative text-white py-20">
          <h1 className="text-4xl md:text-6xl font-bold mb-4 max-w-3xl">{site.hero?.titulo || `Bem-vindo à ${clinic.nome}`}</h1>
          <p className="text-lg md:text-xl mb-8 max-w-2xl opacity-90">{site.hero?.subtitulo || "Cuidado especializado para o seu bem-estar."}</p>
          {site.hero?.cta_label && (
            <Button size="lg" asChild>
              <a href={site.hero.cta_url || "#contato"}>{site.hero.cta_label}</a>
            </Button>
          )}
        </div>
      </section>

      {/* Sobre */}
      {site.sobre?.texto && (
        <section id="sobre" className="py-20 container mx-auto px-4">
          <h2 className="text-3xl font-bold mb-6 text-center">{site.sobre.titulo || "Sobre nós"}</h2>
          <div className="max-w-3xl mx-auto text-lg text-muted-foreground whitespace-pre-line">{site.sobre.texto}</div>
        </section>
      )}

      {/* Serviços */}
      {site.servicos?.itens?.length > 0 && (
        <section id="servicos" className="py-20 bg-muted/30">
          <div className="container mx-auto px-4">
            <h2 className="text-3xl font-bold mb-10 text-center">{site.servicos.titulo || "Serviços"}</h2>
            <div className="grid md:grid-cols-3 gap-6">
              {site.servicos.itens.map((s: any, i: number) => (
                <Card key={i}>
                  <CardContent className="p-6">
                    <h3 className="font-semibold text-lg mb-2">{s.nome}</h3>
                    <p className="text-muted-foreground text-sm">{s.descricao}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Diferenciais */}
      {site.diferenciais?.itens?.length > 0 && (
        <section className="py-20 container mx-auto px-4">
          <h2 className="text-3xl font-bold mb-10 text-center">{site.diferenciais.titulo || "Diferenciais"}</h2>
          <div className="grid md:grid-cols-3 gap-6">
            {site.diferenciais.itens.map((d: any, i: number) => (
              <div key={i} className="text-center p-6">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4 text-primary font-bold">{i + 1}</div>
                <h3 className="font-semibold text-lg mb-2">{d.titulo}</h3>
                <p className="text-muted-foreground text-sm">{d.descricao}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Equipe */}
      {site.equipe_config?.mostrar !== false && profissionais?.length > 0 && (
        <section id="equipe" className="py-20 bg-muted/30">
          <div className="container mx-auto px-4">
            <h2 className="text-3xl font-bold mb-10 text-center">{site.equipe_config?.titulo || "Nossa equipe"}</h2>
            <div className="grid md:grid-cols-3 lg:grid-cols-4 gap-6">
              {profissionais.map((p: any, i: number) => (
                <Card key={i}>
                  <CardContent className="p-6 text-center">
                    <Avatar className="w-24 h-24 mx-auto mb-4">
                      <AvatarImage src={p.foto_url} />
                      <AvatarFallback>{p.nome?.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <h3 className="font-semibold">{p.nome}</h3>
                    {p.conselho && <p className="text-xs text-muted-foreground mt-1">{p.conselho} {p.registro}</p>}
                    {p.especialidades?.length > 0 && (
                      <p className="text-sm text-muted-foreground mt-2">{p.especialidades.slice(0, 3).join(" • ")}</p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Depoimentos */}
      {site.depoimentos?.itens?.length > 0 && (
        <section className="py-20 container mx-auto px-4">
          <h2 className="text-3xl font-bold mb-10 text-center">{site.depoimentos.titulo || "Depoimentos"}</h2>
          <div className="grid md:grid-cols-3 gap-6">
            {site.depoimentos.itens.map((d: any, i: number) => (
              <Card key={i}>
                <CardContent className="p-6">
                  <p className="italic mb-4">"{d.texto}"</p>
                  <p className="font-semibold text-sm">{d.nome}</p>
                  {d.cargo && <p className="text-xs text-muted-foreground">{d.cargo}</p>}
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}

      {/* Galeria */}
      {site.galeria?.imagens?.length > 0 && (
        <section className="py-20 bg-muted/30">
          <div className="container mx-auto px-4">
            <h2 className="text-3xl font-bold mb-10 text-center">{site.galeria.titulo || "Galeria"}</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {site.galeria.imagens.map((img: string, i: number) => (
                <img key={i} src={img} alt={`Galeria ${i + 1}`} className="w-full h-48 object-cover rounded-lg" />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* FAQ */}
      {site.faq?.itens?.length > 0 && (
        <section className="py-20 container mx-auto px-4 max-w-3xl">
          <h2 className="text-3xl font-bold mb-10 text-center">{site.faq.titulo || "Perguntas frequentes"}</h2>
          <Accordion type="single" collapsible>
            {site.faq.itens.map((f: any, i: number) => (
              <AccordionItem key={i} value={`item-${i}`}>
                <AccordionTrigger className="text-left">{f.pergunta}</AccordionTrigger>
                <AccordionContent>{f.resposta}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </section>
      )}

      {/* Contato */}
      <section id="contato" className="py-20 bg-muted/30">
        <div className="container mx-auto px-4 max-w-4xl">
          <h2 className="text-3xl font-bold mb-4 text-center">{site.contato?.titulo || "Fale conosco"}</h2>
          {site.contato?.mensagem && <p className="text-center text-muted-foreground mb-10">{site.contato.mensagem}</p>}
          <div className="grid md:grid-cols-2 gap-6">
            {site.contato?.mostrar_endereco !== false && (clinic.endereco || clinic.cidade) && (
              <Card><CardContent className="p-6 flex items-start gap-4">
                <MapPin className="h-5 w-5 text-primary shrink-0 mt-1" />
                <div>
                  <p className="font-semibold mb-1">Endereço</p>
                  <p className="text-sm text-muted-foreground">
                    {[clinic.endereco, clinic.numero, clinic.bairro, clinic.cidade && `${clinic.cidade}/${clinic.estado}`].filter(Boolean).join(", ")}
                  </p>
                </div>
              </CardContent></Card>
            )}
            {site.contato?.mostrar_telefone !== false && clinic.telefone && (
              <Card><CardContent className="p-6 flex items-start gap-4">
                <Phone className="h-5 w-5 text-primary shrink-0 mt-1" />
                <div>
                  <p className="font-semibold mb-1">Telefone</p>
                  <a href={`tel:${clinic.telefone}`} className="text-sm hover:text-primary">{clinic.telefone}</a>
                </div>
              </CardContent></Card>
            )}
            {site.contato?.mostrar_email !== false && clinic.email && (
              <Card><CardContent className="p-6 flex items-start gap-4">
                <Mail className="h-5 w-5 text-primary shrink-0 mt-1" />
                <div>
                  <p className="font-semibold mb-1">E-mail</p>
                  <a href={`mailto:${clinic.email}`} className="text-sm hover:text-primary">{clinic.email}</a>
                </div>
              </CardContent></Card>
            )}
            {clinic.instagram && (
              <Card><CardContent className="p-6 flex items-start gap-4">
                <Instagram className="h-5 w-5 text-primary shrink-0 mt-1" />
                <div>
                  <p className="font-semibold mb-1">Instagram</p>
                  <a href={`https://instagram.com/${clinic.instagram.replace("@", "")}`} target="_blank" rel="noopener" className="text-sm hover:text-primary">{clinic.instagram}</a>
                </div>
              </CardContent></Card>
            )}
          </div>
        </div>
      </section>

      <footer className="py-8 border-t text-center text-sm text-muted-foreground">
        <div className="container mx-auto px-4">
          © {new Date().getFullYear()} {clinic.nome}. Todos os direitos reservados.
        </div>
      </footer>
    </div>
  );
}
