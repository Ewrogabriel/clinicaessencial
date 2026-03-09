import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sparkles, ArrowRight, CheckCircle2 } from "lucide-react";

interface HeroSectionProps {
  onScrollTo: (id: string) => void;
  content?: {
    badge?: string;
    titulo?: string;
    subtitulo?: string;
    cta_primario?: string;
    cta_secundario?: string;
    destaques?: string[];
  };
}

export const HeroSection = ({ onScrollTo, content }: HeroSectionProps) => {
  const badge = content?.badge || "Potencializado por Inteligência Artificial";
  const titulo = content?.titulo || "Gestão inteligente para clínicas de saúde";
  const subtitulo = content?.subtitulo || "Sistema completo para fisioterapia, psicologia, nutrição, pilates, estética e muito mais. Agenda, prontuários, financeiro e IA — tudo em um só lugar.";
  const ctaPrimario = content?.cta_primario || "Agendar demonstração";
  const ctaSecundario = content?.cta_secundario || "Ver planos";
  const destaques = content?.destaques || ["Sem fidelidade", "Setup gratuito", "Suporte humanizado"];

  return (
    <section className="py-20 md:py-32 overflow-hidden">
      <div className="container mx-auto px-4 text-center max-w-4xl">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
          <Badge variant="secondary" className="mb-6 px-4 py-1.5 text-sm">
            <Sparkles className="h-3 w-3 mr-1" /> {badge}
          </Badge>
        </motion.div>

        <motion.h1
          className="text-4xl md:text-6xl font-bold tracking-tight font-[Plus_Jakarta_Sans] mb-6"
          initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.1 }}
        >
          {titulo.includes("clínicas de saúde") ? (
            <>
              {titulo.split("clínicas de saúde")[0]}
              <span className="text-primary">clínicas de saúde</span>
              {titulo.split("clínicas de saúde")[1]}
            </>
          ) : (
            titulo
          )}
        </motion.h1>

        <motion.p
          className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto"
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.25 }}
        >
          {subtitulo}
        </motion.p>

        <motion.div
          className="flex flex-col sm:flex-row gap-4 justify-center"
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.4 }}
        >
          <Button size="lg" onClick={() => onScrollTo("contato")} className="gap-2 text-base px-8">
            {ctaPrimario} <ArrowRight className="h-5 w-5" />
          </Button>
          <Button size="lg" variant="outline" onClick={() => onScrollTo("planos")} className="gap-2 text-base px-8">
            {ctaSecundario}
          </Button>
        </motion.div>

        <motion.div
          className="flex items-center justify-center gap-8 mt-12 text-sm text-muted-foreground flex-wrap"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5, delay: 0.6 }}
        >
          {destaques.map((text) => (
            <div key={text} className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-primary" />
              <span>{text}</span>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
};
