import { motion } from "framer-motion";
import { Users, Calendar, Brain, Building2 } from "lucide-react";

const stats = [
  { icon: Users, value: "500+", label: "Clínicas ativas" },
  { icon: Calendar, value: "50k+", label: "Agendamentos/mês" },
  { icon: Brain, value: "10k+", label: "Documentos com IA" },
  { icon: Building2, value: "12+", label: "Especialidades" },
];

export const StatsSection = () => (
  <section className="py-16 border-y bg-primary/5">
    <div className="container mx-auto px-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-8 max-w-4xl mx-auto">
        {stats.map((stat, i) => (
          <motion.div
            key={i}
            className="text-center"
            initial={{ opacity: 0, scale: 0.8 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4, delay: i * 0.1 }}
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary mx-auto mb-3">
              <stat.icon className="h-6 w-6" />
            </div>
            <p className="text-3xl font-bold font-[Plus_Jakarta_Sans] text-foreground">{stat.value}</p>
            <p className="text-sm text-muted-foreground mt-1">{stat.label}</p>
          </motion.div>
        ))}
      </div>
    </div>
  </section>
);
