import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Activity, Calendar, Users, DollarSign, BarChart3, Shield,
  CheckCircle2, ArrowRight, Star, Sparkles, Building2, Clock,
  Brain, FileText, MessageSquare, Smartphone, ChevronRight,
  Mail, Phone, Instagram, Send,
} from "lucide-react";

const features = [
  {
    icon: Calendar,
    title: "Agenda Inteligente",
    description: "Agendamentos com recorrência, lista de espera, check-in digital e visualização por profissional.",
  },
  {
    icon: Users,
    title: "Gestão de Pacientes",
    description: "Cadastro completo, prontuário digital, avaliações, evoluções e contratos digitais com assinatura.",
  },
  {
    icon: DollarSign,
    title: "Financeiro Completo",
    description: "Pagamentos, mensalidades, comissões automáticas, DRE, notas fiscais e controle de inadimplência.",
  },
  {
    icon: Brain,
    title: "Inteligência Artificial",
    description: "Sugestões de agendamento, predição de churn, geração de documentos, insights de KPIs e marketing com IA.",
  },
  {
    icon: BarChart3,
    title: "Relatórios e KPIs",
    description: "Dashboard com indicadores em tempo real, relatórios de ocupação, desempenho e análise financeira.",
  },
  {
    icon: Building2,
    title: "Multi-Clínica",
    description: "Gerencie múltiplas unidades com base compartilhada, cross-booking e visão consolidada.",
  },
  {
    icon: Shield,
    title: "Segurança & Permissões",
    description: "Controle granular de acesso por cargo, auditoria de ações e conformidade LGPD.",
  },
  {
    icon: Smartphone,
    title: "Portal do Paciente",
    description: "Área exclusiva para pacientes visualizarem agenda, pagamentos, planos e documentos.",
  },
  {
    icon: FileText,
    title: "Documentos Clínicos",
    description: "Atestados, receituários, relatórios e comprovantes gerados com auxílio de IA.",
  },
  {
    icon: MessageSquare,
    title: "Comunicação",
    description: "Mensagens internas, avisos, lembretes automáticos via WhatsApp e mural de avisos.",
  },
  {
    icon: Sparkles,
    title: "Gamificação",
    description: "Conquistas, desafios e ranking para engajar pacientes e equipe na rotina da clínica.",
  },
  {
    icon: Clock,
    title: "Automações",
    description: "Fluxos automatizados para lembretes, cobrança, reagendamento e muito mais.",
  },
];

const plans = [
  {
    name: "Starter",
    price: "97",
    description: "Ideal para clínicas iniciando a digitalização",
    highlighted: false,
    features: [
      "Até 100 pacientes",
      "2 profissionais",
      "Agenda com recorrência",
      "Prontuário digital",
      "Financeiro básico",
      "Portal do paciente",
      "Suporte por email",
    ],
  },
  {
    name: "Professional",
    price: "197",
    description: "Para clínicas em crescimento que precisam de mais",
    highlighted: true,
    features: [
      "Até 500 pacientes",
      "10 profissionais",
      "Tudo do Starter +",
      "Inteligência Artificial",
      "Relatórios avançados",
      "Comissões automáticas",
      "Multi-clínica (2 unidades)",
      "Marketing com IA",
      "Suporte prioritário",
    ],
  },
  {
    name: "Enterprise",
    price: "397",
    description: "Para redes de clínicas e operações avançadas",
    highlighted: false,
    features: [
      "Pacientes ilimitados",
      "Profissionais ilimitados",
      "Tudo do Professional +",
      "Multi-clínica ilimitada",
      "Notas fiscais (NFS-e)",
      "API personalizada",
      "Onboarding dedicado",
      "Gerente de sucesso",
      "SLA 99.9%",
    ],
  },
];

const testimonials = [
  {
    name: "Dra. Maria Silva",
    role: "Fisioterapeuta",
    text: "O sistema transformou a gestão da minha clínica. Reduzi 70% do tempo administrativo e aumentei a retenção de pacientes.",
    rating: 5,
  },
  {
    name: "Dr. Carlos Santos",
    role: "Psicólogo",
    text: "A IA para geração de documentos e insights me ajuda muito no dia a dia. Recomendo para qualquer profissional de saúde.",
    rating: 5,
  },
  {
    name: "Ana Costa",
    role: "Gestora de Clínica",
    text: "Gerenciar 3 unidades nunca foi tão fácil. Os relatórios consolidados são excelentes para tomada de decisão.",
    rating: 5,
  },
];

const LandingPage = () => {
  const navigate = useNavigate();

  const scrollToSection = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Activity className="h-5 w-5" />
            </div>
            <div>
              <span className="font-bold font-[Plus_Jakarta_Sans]">Essencial</span>
              <span className="text-muted-foreground text-xs ml-1">Clínicas</span>
            </div>
          </div>
          <nav className="hidden md:flex items-center gap-6 text-sm">
            <button onClick={() => scrollToSection("recursos")} className="text-muted-foreground hover:text-foreground transition-colors">
              Recursos
            </button>
            <button onClick={() => scrollToSection("planos")} className="text-muted-foreground hover:text-foreground transition-colors">
              Planos
            </button>
            <button onClick={() => scrollToSection("depoimentos")} className="text-muted-foreground hover:text-foreground transition-colors">
              Depoimentos
            </button>
            <button onClick={() => scrollToSection("contato")} className="text-muted-foreground hover:text-foreground transition-colors">
              Contato
            </button>
          </nav>
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => navigate("/login")}>
              Entrar
            </Button>
            <Button size="sm" onClick={() => scrollToSection("contato")} className="gap-1">
              Começar agora <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="py-20 md:py-32">
        <div className="container mx-auto px-4 text-center max-w-4xl">
          <Badge variant="secondary" className="mb-6 px-4 py-1.5 text-sm">
            <Sparkles className="h-3 w-3 mr-1" /> Potencializado por Inteligência Artificial
          </Badge>
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight font-[Plus_Jakarta_Sans] mb-6">
            Gestão inteligente para{" "}
            <span className="text-primary">clínicas de saúde</span>
          </h1>
          <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            Sistema completo para fisioterapia, psicologia, nutrição, pilates, estética e muito mais. 
            Agenda, prontuários, financeiro e IA — tudo em um só lugar.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" onClick={() => scrollToSection("contato")} className="gap-2 text-base px-8">
              Agendar demonstração <ArrowRight className="h-5 w-5" />
            </Button>
            <Button size="lg" variant="outline" onClick={() => scrollToSection("planos")} className="gap-2 text-base px-8">
              Ver planos
            </Button>
          </div>
          <div className="flex items-center justify-center gap-8 mt-12 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-primary" />
              <span>Sem fidelidade</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-primary" />
              <span>Setup gratuito</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-primary" />
              <span>Suporte humanizado</span>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="recursos" className="py-20 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold font-[Plus_Jakarta_Sans] mb-4">
              Tudo que sua clínica precisa
            </h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              Mais de 50 funcionalidades integradas para automatizar e otimizar a gestão da sua clínica
            </p>
          </div>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {features.map((feature, i) => (
              <Card key={i} className="hover:shadow-lg transition-shadow border-border/50">
                <CardContent className="pt-6">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary mb-4">
                    <feature.icon className="h-6 w-6" />
                  </div>
                  <h3 className="font-semibold mb-2">{feature.title}</h3>
                  <p className="text-sm text-muted-foreground">{feature.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Plans */}
      <section id="planos" className="py-20">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold font-[Plus_Jakarta_Sans] mb-4">
              Planos que cabem no seu bolso
            </h2>
            <p className="text-muted-foreground text-lg">
              Escolha o plano ideal para o tamanho da sua clínica
            </p>
          </div>
          <div className="grid gap-8 md:grid-cols-3 max-w-5xl mx-auto">
            {plans.map((plan, i) => (
              <Card
                key={i}
                className={`relative hover:shadow-lg transition-shadow ${
                  plan.highlighted ? "border-primary shadow-lg scale-105" : "border-border/50"
                }`}
              >
                {plan.highlighted && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge className="px-4 py-1">Mais popular</Badge>
                  </div>
                )}
                <CardHeader className="text-center pb-4">
                  <CardTitle className="text-xl">{plan.name}</CardTitle>
                  <CardDescription>{plan.description}</CardDescription>
                  <div className="mt-4">
                    <span className="text-sm text-muted-foreground">R$</span>
                    <span className="text-4xl font-bold">{plan.price}</span>
                    <span className="text-muted-foreground">/mês</span>
                  </div>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-3 mb-6">
                    {plan.features.map((feature, j) => (
                      <li key={j} className="flex items-start gap-2 text-sm">
                        <CheckCircle2 className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                  <Button
                    className="w-full gap-2"
                    variant={plan.highlighted ? "default" : "outline"}
                    onClick={() => scrollToSection("contato")}
                  >
                    Começar agora <ChevronRight className="h-4 w-4" />
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section id="depoimentos" className="py-20 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold font-[Plus_Jakarta_Sans] mb-4">
              O que dizem nossos clientes
            </h2>
          </div>
          <div className="grid gap-6 md:grid-cols-3 max-w-5xl mx-auto">
            {testimonials.map((t, i) => (
              <Card key={i} className="hover:shadow-lg transition-shadow">
                <CardContent className="pt-6">
                  <div className="flex gap-1 mb-4">
                    {Array.from({ length: t.rating }).map((_, j) => (
                      <Star key={j} className="h-4 w-4 fill-primary text-primary" />
                    ))}
                  </div>
                  <p className="text-sm text-muted-foreground mb-4 italic">"{t.text}"</p>
                  <div>
                    <p className="font-semibold text-sm">{t.name}</p>
                    <p className="text-xs text-muted-foreground">{t.role}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA / Contact */}
      <section id="contato" className="py-20">
        <div className="container mx-auto px-4 max-w-3xl">
          <Card className="border-primary/20">
            <CardContent className="pt-8 text-center space-y-6">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary text-primary-foreground mx-auto">
                <Activity className="h-8 w-8" />
              </div>
              <h2 className="text-3xl font-bold font-[Plus_Jakarta_Sans]">
                Pronto para transformar sua clínica?
              </h2>
              <p className="text-muted-foreground max-w-xl mx-auto">
                Entre em contato conosco para uma demonstração personalizada. 
                Nossa equipe vai te ajudar a escolher o plano ideal.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
                <Button size="lg" className="gap-2" asChild>
                  <a href="https://wa.me/5500000000000" target="_blank" rel="noopener noreferrer">
                    <Send className="h-5 w-5" /> WhatsApp
                  </a>
                </Button>
                <Button size="lg" variant="outline" className="gap-2" asChild>
                  <a href="mailto:contato@essencialclinicas.com.br">
                    <Mail className="h-5 w-5" /> Email
                  </a>
                </Button>
                <Button size="lg" variant="outline" className="gap-2" asChild>
                  <a href="https://instagram.com/essencialclinicas" target="_blank" rel="noopener noreferrer">
                    <Instagram className="h-5 w-5" /> Instagram
                  </a>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-8">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Activity className="h-4 w-4 text-primary" />
            <span className="font-semibold">Essencial Clínicas</span>
          </div>
          <p>© {new Date().getFullYear()} Essencial Clínicas. Todos os direitos reservados.</p>
          <p className="mt-1">Gestão inteligente para clínicas de saúde multiespecialidade.</p>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
