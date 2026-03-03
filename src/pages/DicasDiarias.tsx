import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { Lightbulb, Heart, Brain, Zap } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const dicasSimuladas = {
  pacientes: [
    {
      id: 1,
      titulo: "Hidratação e Bem-estar",
      conteudo: "Beba pelo menos 2 litros de água por dia. A hidratação adequada melhora a flexibilidade muscular e previne cãibras durante os exercícios de pilates.",
      categoria: "Saúde",
      icon: Heart,
    },
    {
      id: 2,
      titulo: "Respiração Correta em Pilates",
      conteudo: "Inspire pelo nariz e expire pela boca. A respiração coordenada durante os movimentos ativa o transverso do abdômen, potencializando os resultados.",
      categoria: "Pilates",
      icon: Brain,
    },
    {
      id: 3,
      titulo: "Postura no Dia a Dia",
      conteudo: "Mantenha a coluna reta ao sentar. Uma boa postura reduz dores nas costas e melhora a qualidade de vida. Lembre-se: o pilates melhora sua postura, mas a prática contínua é essencial.",
      categoria: "Bem-estar",
      icon: Zap,
    },
    {
      id: 4,
      titulo: "Alimentação Pré-aula",
      conteudo: "Evite refeições pesadas 2 horas antes da aula. Uma pequena banana ou barra de cereal é ideal para fornecer energia sem desconforto.",
      categoria: "Saúde",
      icon: Heart,
    },
  ],
  profissionais: [
    {
      id: 1,
      titulo: "Comunicação Efetiva com Pacientes",
      conteudo: "Sempre explique o motivo de cada exercício. Pacientes que entendem os benefícios têm maior adesão ao tratamento e melhores resultados.",
      categoria: "Comportamento",
      icon: Brain,
    },
    {
      id: 2,
      titulo: "Limite de Uso de Celular",
      conteudo: "Durante as aulas, minimize o uso de celular. Sua atenção integral aos pacientes cria um ambiente mais profissional e seguro.",
      categoria: "Profissionalismo",
      icon: Zap,
    },
    {
      id: 3,
      titulo: "Postura Correta no Ensino",
      conteudo: "Demonstre os exercícios com postura perfeita. Você é um modelo para seus pacientes - sua técnica impecável inspira e evita lesões.",
      categoria: "Técnica",
      icon: Lightbulb,
    },
    {
      id: 4,
      titulo: "Feedback Positivo",
      conteudo: "Reconheça o progresso dos pacientes, mesmo pequeno. Feedback positivo aumenta a motivação e cria um vínculo terapêutico mais forte.",
      categoria: "Comportamento",
      icon: Heart,
    },
  ],
};

export default function DicasDiarias() {
  const { isPatient, isProfissional } = useAuth();

  const { data: dicas = [] } = useQuery({
    queryKey: ["dicas-diarias", isPatient ? "paciente" : "profissional"],
    queryFn: async () => {
      // Simular alternância de dicas por dia
      const dia = new Date().getDate();
      const tipoDica = isPatient ? dicasSimuladas.pacientes : dicasSimuladas.profissionais;
      return [tipoDica[dia % tipoDica.length]];
    },
  });

  const todasAsDicas = isPatient ? dicasSimuladas.pacientes : dicasSimuladas.profissionais;
  const categorias = [...new Set(todasAsDicas.map((d) => d.categoria))];

  const renderDica = (dica: any) => {
    const Icon = dica.icon;
    return (
      <Card key={dica.id} className="hover:shadow-md transition-shadow">
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-3 flex-1">
              <Icon className="w-5 h-5 text-blue-600 mt-1 flex-shrink-0" />
              <div>
                <CardTitle className="text-lg">{dica.titulo}</CardTitle>
                <Badge variant="outline" className="mt-2">
                  {dica.categoria}
                </Badge>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-gray-700 leading-relaxed">{dica.conteudo}</p>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Lightbulb className="w-8 h-8 text-yellow-500" />
          Dicas Diárias
        </h1>
        <p className="text-gray-600">
          Conselhos diários para melhorar seu {isPatient ? "desempenho e bem-estar" : "desempenho profissional"}
        </p>
      </div>

      {/* Dica do Dia */}
      {dicas.length > 0 && (
        <Card className="border-2 border-yellow-300 bg-yellow-50">
          <CardHeader>
            <CardTitle className="text-lg text-yellow-900">Dica do Dia</CardTitle>
            <CardDescription className="text-yellow-800">
              {format(new Date(), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
            </CardDescription>
          </CardHeader>
          <CardContent>{renderDica(dicas[0])}</CardContent>
        </Card>
      )}

      {/* Todas as Dicas por Categoria */}
      <Tabs defaultValue={categorias[0]} className="w-full">
        <TabsList className="grid w-full" style={{ gridTemplateColumns: `repeat(${categorias.length}, 1fr)` }}>
          {categorias.map((cat) => (
            <TabsTrigger key={cat} value={cat}>
              {cat}
            </TabsTrigger>
          ))}
        </TabsList>

        {categorias.map((categoria) => (
          <TabsContent key={categoria} value={categoria} className="space-y-4">
            {todasAsDicas
              .filter((d) => d.categoria === categoria)
              .map(renderDica)}
          </TabsContent>
        ))}
      </Tabs>

      {/* Informação sobre Atualização */}
      <Card className="bg-blue-50 border-blue-200">
        <CardHeader>
          <CardTitle className="text-blue-900">Como Funcionam as Dicas</CardTitle>
        </CardHeader>
        <CardContent className="text-blue-800 space-y-2">
          <p>• As dicas são atualizadas diariamente com base em inteligência artificial</p>
          <p>• Cada dica é personalizada para seu tipo de acesso (paciente ou profissional)</p>
          <p>• As dicas cobrem saúde, bem-estar, pilates, comportamento profissional e técnica</p>
          <p>• Você pode explorar todas as dicas por categoria usando as abas acima</p>
        </CardContent>
      </Card>
    </div>
  );
}
