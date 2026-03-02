import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { GraduationCap, Award } from "lucide-react";

const PerfilProfissionalPublico = () => {
  const { userId } = useParams();

  const { data: profile, isLoading } = useQuery({
    queryKey: ["public-prof-profile", userId],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("*").eq("user_id", userId!).single();
      return data;
    },
    enabled: !!userId,
  });

  if (isLoading) return <div className="p-8 text-center animate-pulse text-muted-foreground">Carregando perfil...</div>;
  if (!profile) return <div className="p-8 text-center text-muted-foreground">Perfil não encontrado.</div>;

  const p = profile as any;
  const initials = p.nome ? p.nome.split(" ").map((n: string) => n[0]).slice(0, 2).join("").toUpperCase() : "P";

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col items-center gap-4">
            <Avatar className="h-24 w-24">
              <AvatarImage src={p.foto_url || ""} />
              <AvatarFallback className="text-2xl">{initials}</AvatarFallback>
            </Avatar>
            <div className="text-center">
              <h2 className="text-xl font-bold">{p.nome}</h2>
              {p.especialidade && <Badge variant="secondary" className="mt-1 capitalize">{p.especialidade}</Badge>}
              {p.registro_profissional && <p className="text-xs text-muted-foreground mt-1">{p.registro_profissional}</p>}
            </div>
          </div>
          {p.bio && (
            <div className="mt-6 pt-4 border-t">
              <p className="text-sm text-muted-foreground">{p.bio}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {p.graduacao && (
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 text-base"><GraduationCap className="h-5 w-5" /> Formação</CardTitle></CardHeader>
          <CardContent><p className="text-sm">{p.graduacao}</p></CardContent>
        </Card>
      )}

      {p.cursos?.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Award className="h-5 w-5" /> Cursos & Especializações</CardTitle></CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {p.cursos.map((c: string, i: number) => (
                <Badge key={i} variant="outline">{c}</Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default PerfilProfissionalPublico;
