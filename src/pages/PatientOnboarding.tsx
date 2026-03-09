import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Activity, CheckCircle, Lock, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

const PatientOnboarding = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [paciente, setPaciente] = useState<any>(null);
  
  // Form fields
  const [cpf, setCpf] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [confirmSenha, setConfirmSenha] = useState("");

  useEffect(() => {
    const fetchPaciente = async () => {
      if (!id) return;
      
      const { data, error } = await supabase
        .from("pacientes")
        .select("*")
        .eq("id", id)
        .single();
        
      if (error || !data) {
        toast({ title: "Convite inválido ou expirado.", variant: "destructive" });
        navigate("/login");
        return;
      }
      
      if ((data as any).user_id) {
        toast({ title: "Cadastro já finalizado", description: "Você já possui acesso. Faça o login." });
        navigate("/login");
        return;
      }
      
      setPaciente(data);
      if (data.cpf) setCpf(data.cpf);
      if (data.email) setEmail(data.email);
      setLoading(false);
    };

    fetchPaciente();
  }, [id, navigate]);

  const formatCpf = (value: string) => {
    const clean = value.replace(/\D/g, "");
    const match = clean.match(/^(\d{0,3})(\d{0,3})(\d{0,3})(\d{0,2})$/);
    if (!match) return value;
    return !match[2] ? match[1] : 
           !match[3] ? `${match[1]}.${match[2]}` : 
           !match[4] ? `${match[1]}.${match[2]}.${match[3]}` : 
           `${match[1]}.${match[2]}.${match[3]}-${match[4]}`;
  };

  const handleCpfChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCpf(formatCpf(e.target.value));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paciente) return;

    const cleanCpf = cpf.replace(/\D/g, "");
    
    if (cleanCpf.length !== 11) {
      toast({ title: "CPF Inválido", description: "O CPF deve ter 11 dígitos.", variant: "destructive" });
      return;
    }
    
    if (senha.length < 6) {
      toast({ title: "Senha muito curta", description: "A senha deve ter pelo menos 6 caracteres.", variant: "destructive" });
      return;
    }
    
    if (senha !== confirmSenha) {
      toast({ title: "Senhas diferentes", description: "A confirmação de senha não confere.", variant: "destructive" });
      return;
    }

    setSaving(true);
    
    // Use the provided email, OR generate a pseudo-email based on CPF if none provided
    const authEmail = email.trim() ? email.trim() : `${cleanCpf}@paciente.essencial.com`;

    try {
      // 1. Check if user auth already exists (in case they tried before)
      // Supabase sign up
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: authEmail,
        password: senha,
        options: {
          data: {
            nome: paciente.nome,
            role: "paciente",
            cpf: cleanCpf
          }
        }
      });

      if (authError) throw authError;

      // 2. Link the new user_id to the existing paciente record
      // And update their CPF/Email
      const userId = authData?.user?.id;
      if (userId) {
          const { error: updateError } = await supabase
            .from("pacientes")
            .update({ 
               user_id: userId,
               cpf: formatCpf(cpf),
               email: email.trim() || authEmail
            })
            .eq("id", paciente.id);
            
          if (updateError) {
              console.error("Erro ao vincular paciente", updateError);
          }
      }

      toast({
        title: "Conta criada com sucesso! 🎉",
        description: "Você já pode acessar o seu portal.",
      });
      
      // Auto-login or redirect
      navigate("/dashboard");
      
    } catch (error: any) {
      toast({
        title: "Erro ao criar conta",
        description: error.message || "Tente novamente mais tarde.",
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="animate-pulse text-muted-foreground">Carregando seu convite...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-8">
        <div className="flex flex-col items-center text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground mb-4">
            <Activity className="h-7 w-7" />
          </div>
          <h1 className="text-2xl font-bold font-[Plus_Jakarta_Sans]">Bem-vindo(a), {paciente?.nome?.split(' ')[0]}!</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Finalize seu cadastro na clínica
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Crie seu Acesso</CardTitle>
            <CardDescription>
              Você usará seu CPF (ou E-mail) e a Senha definida aqui para acessar o portal.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="cpf">Seu CPF *</Label>
                <div className="relative">
                  <User className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="cpf"
                    className="pl-9"
                    placeholder="000.000.000-00"
                    value={cpf}
                    onChange={handleCpfChange}
                    required
                    maxLength={14}
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="email">E-mail (Opcional)</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="Se tiver, preencha aqui"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
                <p className="text-[10px] text-muted-foreground leading-tight">
                  Se não preencher, você poderá acessar usando apenas seu CPF e senha criados aqui.
                </p>
              </div>

              <div className="space-y-2 pt-2">
                <Label htmlFor="senha">Crie uma Senha *</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="senha"
                    type="password"
                    className="pl-9"
                    placeholder="Mínimo 6 caracteres"
                    value={senha}
                    onChange={(e) => setSenha(e.target.value)}
                    required
                    minLength={6}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirm_senha">Confirme sua Senha *</Label>
                <div className="relative">
                  <CheckCircle className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="confirm_senha"
                    type="password"
                    className="pl-9"
                    placeholder="Digite a mesma senha"
                    value={confirmSenha}
                    onChange={(e) => setConfirmSenha(e.target.value)}
                    required
                    minLength={6}
                  />
                </div>
              </div>

              <Button type="submit" className="w-full mt-4" disabled={saving}>
                {saving ? "Salvando..." : "Finalizar Cadastro"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default PatientOnboarding;
