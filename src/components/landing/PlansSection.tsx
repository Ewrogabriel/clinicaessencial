import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle2, ChevronRight } from "lucide-react";

const plans = [
  {
    name: "Starter",
    price: "97",
    description: "Ideal para clínicas iniciando a digitalização",
    highlighted: false,
    features: [
      "Até 100 pacientes", "2 profissionais", "Agenda com recorrência",
      "Prontuário digital", "Financeiro básico", "Portal do paciente", "Suporte por email",
    ],
  },
  {
    name: "Professional",
    price: "197",
    description: "Para clínicas em crescimento que precisam de mais",
    highlighted: true,
    features: [
      "Até 500 pacientes", "10 profissionais", "Tudo do Starter +",
      "Inteligência Artificial", "Relatórios avançados", "Comissões automáticas",
      "Multi-clínica (2 unidades)", "Marketing com IA", "Suporte prioritário",
    ],
  },
  {
    name: "Enterprise",
    price: "397",
    description: "Para redes de clínicas e operações avançadas",
    highlighted: false,
    features: [
      "Pacientes ilimitados", "Profissionais ilimitados", "Tudo do Professional +",
      "Multi-clínica ilimitada", "Notas fiscais (NFS-e)", "API personalizada",
      "Onboarding dedicado", "Gerente de sucesso", "SLA 99.9%",
    ],
  },
];

interface PlansSectionProps {
  onScrollTo: (id: string) => void;
}

export const PlansSection = ({ onScrollTo }: PlansSectionProps) => (
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
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: i * 0.15 }}
          >
            <Card
              className={`relative hover:shadow-lg transition-all h-full ${
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
                  onClick={() => onScrollTo("contato")}
                >
                  Começar agora <ChevronRight className="h-4 w-4" />
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>
    </div>
  </section>
);
