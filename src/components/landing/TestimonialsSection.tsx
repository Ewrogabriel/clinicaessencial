import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Star } from "lucide-react";

const testimonials = [
  {
    name: "Dra. Maria Silva", role: "Fisioterapeuta", rating: 5,
    text: "O sistema transformou a gestão da minha clínica. Reduzi 70% do tempo administrativo e aumentei a retenção de pacientes.",
  },
  {
    name: "Dr. Carlos Santos", role: "Psicólogo", rating: 5,
    text: "A IA para geração de documentos e insights me ajuda muito no dia a dia. Recomendo para qualquer profissional de saúde.",
  },
  {
    name: "Ana Costa", role: "Gestora de Clínica", rating: 5,
    text: "Gerenciar 3 unidades nunca foi tão fácil. Os relatórios consolidados são excelentes para tomada de decisão.",
  },
];

export const TestimonialsSection = () => (
  <section id="depoimentos" className="py-20 bg-muted/30">
    <div className="container mx-auto px-4">
      <div className="text-center mb-16">
        <h2 className="text-3xl md:text-4xl font-bold font-[Plus_Jakarta_Sans] mb-4">
          O que dizem nossos clientes
        </h2>
      </div>
      <div className="grid gap-6 md:grid-cols-3 max-w-5xl mx-auto">
        {testimonials.map((t, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: i * 0.1 }}
          >
            <Card className="hover:shadow-lg transition-shadow h-full">
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
          </motion.div>
        ))}
      </div>
    </div>
  </section>
);
