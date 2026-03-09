import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Activity, ArrowRight } from "lucide-react";
import { HeroSection } from "@/components/landing/HeroSection";
import { FeaturesSection } from "@/components/landing/FeaturesSection";
import { PlansSection } from "@/components/landing/PlansSection";
import { TestimonialsSection } from "@/components/landing/TestimonialsSection";
import { ContactSection } from "@/components/landing/ContactSection";

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

      <HeroSection onScrollTo={scrollToSection} />
      <FeaturesSection />
      <PlansSection onScrollTo={scrollToSection} />
      <TestimonialsSection />
      <ContactSection />

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
