import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { Lock, LogIn } from "lucide-react";
import { toast } from "sonner";

export default function PacienteAccess() {
  const navigate = useNavigate();
  const [codigoAcesso, setCodigoAcesso] = useState("");
  const [loading, setLoading] = useState(false);

  const handleAccessSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!codigoAcesso.trim()) {
      toast.error("Erro", { description: "Digite o código de acesso" });
      return;
    }

    setLoading(true);
    try {
      const cleanCode = codigoAcesso.trim().toUpperCase();

      // Ensure auth account exists & patient is linked to a clinic.
      // The function returns the email/password we should use to sign in.
      const { data: ensured, error: ensureError } = await supabase.functions.invoke(
        "ensure-patient-auth",
        { body: { codigo_acesso: cleanCode } }
      );

      if (ensureError || !ensured?.ok) {
        const msg = (ensured as any)?.error || ensureError?.message || "Código de acesso inválido";
        toast.error("Erro", { description: msg });
        setLoading(false);
        return;
      }

      const { email, password, paciente } = ensured as { email: string; password: string; paciente: { id: string; nome: string } };

      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });

      if (signInError) {
        console.error("Sign in error:", signInError);
        toast.error("Erro", { description: "Erro ao autenticar. Entre em contato com a clínica." });
        setLoading(false);
        return;
      }

      toast.success("Bem-vindo!", { description: `Olá ${paciente.nome}!` });
      navigate("/dashboard");
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Erro ao acessar";
      toast.error("Erro", { description: errorMessage });
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
