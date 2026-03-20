import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import {
  Calendar, Users, DollarSign, Brain, BarChart3, Building2,
  Shield, Smartphone, FileText, MessageSquare, Sparkles, Clock,
} from "lucide-react";

const features = [
  { icon: Calendar, title: "Agenda Inteligente", description: "Agendamentos com recorrência, lista de espera, check-in digital e visualização por profissional." },
  { icon: Users, title: "Gestão de Pacientes", description: "Cadastro completo, prontuário digital, avaliações, evoluções e contratos digitais com assinatura." },
  { icon: DollarSign, title: "Financeiro Completo", description: "Pagamentos, mensalidades, comissões automáticas, DRE, notas fiscais e controle de inadimplência." },
  { icon: Brain, title: "Inteligência Artificial", description: "Sugestões de agendamento, predição de churn, geração de documentos, insights de KPIs e marketing com IA." },
  { icon: BarChart3, title: "Relatórios e KPIs", description: "Dashboard com indicadores em tempo real, relatórios de ocupação, desempenho e análise financeira." },
  { icon: Building2, title: "Multi-Clínica", description: "Gerencie múltiplas unidades com base compartilhada, cross-booking e visão consolidada." },
  { icon: Shield, title: "Segurança & Permissões", description: "Controle granular de acesso por cargo, auditoria de ações e conformidade LGPD." },
  { icon: Smartphone, title: "Portal do Paciente", description: "Área exclusiva para pacientes visualizarem agenda, pagamentos, planos e documentos." },
  { icon: FileText, title: "Documentos Clínicos", description: "Atestados, receituários, relatórios e comprovantes gerados com auxílio de IA." },
  { icon: MessageSquare, title: "Comunicação", description: "Mensagens internas, avisos, lembretes automáticos via WhatsApp e mural de avisos." },
  { icon: Sparkles, title: "Gamificação", description: "Conquistas, desafios e ranking para engajar pacientes e equipe na rotina da clínica." },
  { icon: Clock, title: "Automações", description: "Fluxos automatizados para lembretes, cobrança, reagendamento e muito mais." },
];

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06 } },
};

const item = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4 } },
};

export const FeaturesSection = () => (
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
      <motion.div
        className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
        variants={container}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, amount: 0.1 }}
      >
        {features.map((feature, i) => (
          <motion.div key={i} variants={item}>
            <Card className="hover:shadow-lg transition-shadow border-border/50 h-full">
              <CardContent className="pt-6">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary mb-4">
                  <feature.icon className="h-6 w-6" />
                </div>
                <h3 className="font-semibold mb-2">{feature.title}</h3>
                <p className="text-sm text-muted-foreground">{feature.description}</p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </motion.div>
    </div>
  </section>
);
