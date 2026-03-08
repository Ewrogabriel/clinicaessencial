import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Lock, LogIn } from "lucide-react";

export default function PacienteAccess() {
  const navigate = useNavigate();
  const [codigoAcesso, setCodigoAcesso] = useState("");
  const [loading, setLoading] = useState(false);

  const handleAccessSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!codigoAcesso.trim()) {
      toast({ title: "Erro", description: "Digite o código de acesso", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const cleanCode = codigoAcesso.trim().toUpperCase();
      
      // Find patient by access code
      const { data: pacientes, error: searchError } = await supabase.from("pacientes")
        .select("id, nome, cpf")
        .eq("codigo_acesso", cleanCode);
      
      if (searchError) {
        console.error("Search error:", searchError);
        toast({ title: "Erro", description: "Erro ao buscar código", variant: "destructive" });
        setLoading(false);
        return;
      }
      
      if (!pacientes || pacientes.length === 0) {
        toast({ title: "Erro", description: "Código de acesso inválido", variant: "destructive" });
        setLoading(false);
        return;
      }

      const paciente = pacientes[0];
      const cpfClean = paciente.cpf?.replace(/\D/g, "");

      if (!cpfClean || cpfClean.length !== 11) {
        toast({ title: "Erro", description: "Paciente sem CPF cadastrado. Entre em contato com a clínica.", variant: "destructive" });
        setLoading(false);
        return;
      }

      // Sign in via Supabase Auth using CPF-based credentials
      const email = `${cpfClean}@paciente.essencial.com`;
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password: cpfClean,
      });

      if (signInError) {
        console.error("Sign in error:", signInError);
        toast({ title: "Erro", description: "Erro ao autenticar. Sua conta pode não estar configurada. Entre em contato com a clínica.", variant: "destructive" });
        setLoading(false);
        return;
      }

      toast({ title: "Bem-vindo!", description: `Olá ${paciente.nome}!` });
      navigate("/dashboard");
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Erro ao acessar";
      toast({ title: "Erro", description: errorMessage, variant: "destructive" });
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-2 text-center">
          <div className="flex justify-center mb-4">
            <div className="bg-primary/10 p-3 rounded-lg">
              <Lock className="h-8 w-8 text-primary" />
            </div>
          </div>
          <CardTitle className="text-2xl">Acesso do Paciente</CardTitle>
          <CardDescription>
            Digite o código enviado para acessar sua área
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleAccessSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="codigo">Código de Acesso</Label>
              <Input
                id="codigo"
                type="text"
                placeholder="Ex: ABC12XYZ"
                value={codigoAcesso.toUpperCase()}
                onChange={(e) => setCodigoAcesso(e.target.value)}
                disabled={loading}
                className="uppercase text-center text-lg tracking-widest font-semibold"
              />
            </div>

            <Button
              type="submit"
              disabled={loading || !codigoAcesso.trim()}
              className="w-full gap-2"
            >
              <LogIn className="h-4 w-4" />
              {loading ? "Autenticando..." : "Acessar"}
            </Button>
          </form>

          <div className="mt-6 p-4 bg-muted rounded-lg border">
            <p className="text-sm text-muted-foreground">
              <strong>Precisa de ajuda?</strong> Se você não recebeu o código, entre em contato com seu profissional de atendimento.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
