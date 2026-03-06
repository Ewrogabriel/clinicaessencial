import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Lock, LogIn } from "lucide-react";

export default function PacienteAccess() {
  const navigate = useNavigate();
  const [codigoAcesso, setCodigoAcesso] = useState("");
  const [loading, setLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  const handleAccessSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!codigoAcesso.trim()) {
      toast({ title: "Erro", description: "Digite o código de acesso", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      // Search for patient with this access code
      const { data: paciente, error } = await (supabase.from("pacientes") as any)
        .select("id, nome, email, telefone")
        .eq("codigo_acesso", codigoAcesso.trim())
        .single();

      if (error || !paciente) {
        toast({ title: "Erro", description: "Código de acesso inválido", variant: "destructive" });
        setLoading(false);
        return;
      }

      // Create session
      const sessionToken = crypto.randomUUID();
      const expiresAt = new Date();
      expiresAt.setDate(rememberMe ? expiresAt.getDate() + 30 : expiresAt.getDate() + 1);

      const { error: sessionError } = await (supabase.from("paciente_sessions") as any).insert({
        paciente_id: paciente.id,
        session_token: sessionToken,
        remember_me: rememberMe,
        expires_at: expiresAt.toISOString(),
      });

      if (sessionError) throw sessionError;

      // Store session in localStorage
      localStorage.setItem("paciente_session", JSON.stringify({
        paciente_id: paciente.id,
        session_token: sessionToken,
        nome: paciente.nome,
        expires_at: expiresAt.toISOString(),
      }));

      toast({ title: "Bem-vindo!", description: `Olá ${paciente.nome}!` });
      navigate("/dashboard-paciente");
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
            <div className="bg-blue-100 p-3 rounded-lg">
              <Lock className="h-8 w-8 text-blue-600" />
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
                placeholder="Ex: a1b2c3d4-e5f6-7890..."
                value={codigoAcesso}
                onChange={(e) => setCodigoAcesso(e.target.value)}
                disabled={loading}
                className="uppercase"
              />
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="remember"
                checked={rememberMe}
                onCheckedChange={(checked) => setRememberMe(checked as boolean)}
              />
              <Label htmlFor="remember" className="text-sm cursor-pointer font-normal">
                Manter-me conectado por 30 dias
              </Label>
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

          <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
            <p className="text-sm text-slate-600">
              <strong>Precisa de ajuda?</strong> Se você não recebeu o código, entre em contato com seu profissional de atendimento.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
