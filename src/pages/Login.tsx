import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity, LogIn } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useI18n } from "@/hooks/useI18n";
import { toast } from "@/hooks/use-toast";

const Login = () => {
  const navigate = useNavigate();
  const { signIn, resetPassword } = useAuth();
  const { t } = useI18n();
  const [loading, setLoading] = useState(false);

  const [loginEmail, setLoginEmail] = useState("");
  const [loginSenha, setLoginSenha] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    let authEmail = loginEmail.trim();

    if (!authEmail.includes("@")) {
      const cleanCpf = authEmail.replace(/\D/g, "");
      if (cleanCpf.length === 11) {
        authEmail = `${cleanCpf}@paciente.essencial.com`;
      } else {
        toast({
          title: t("common.error"),
          description: "CPF deve conter 11 dígitos ou informe um e-mail válido.",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }
    }

    const { error } = await signIn(authEmail, loginSenha);

    if (error) {
      toast({
        title: t("common.error"),
        description: error.message === "Invalid login credentials"
          ? "E-mail ou senha incorretos"
          : error.message,
        variant: "destructive",
      });
    } else {
      navigate("/selecionar-clinica");
    }

    setLoading(false);
  };

  const handleResetPassword = async () => {
    if (!loginEmail) {
      toast({
        title: t("common.error"),
        description: "Por favor, insira seu e-mail para redefinir a senha.",
        variant: "destructive",
      });
      return;
    }

    let resetEmail = loginEmail.trim();

    if (!resetEmail.includes("@")) {
      const cleanCpf = resetEmail.replace(/\D/g, "");
      if (cleanCpf.length === 11) {
        toast({
          title: t("common.error"),
          description: "Para redefinir a senha da sua conta via CPF, entre em contato com a recepção da clínica.",
          variant: "destructive",
        });
        return;
      } else {
        toast({
          title: t("common.error"),
          description: "CPF deve conter 11 dígitos ou informe um e-mail válido.",
          variant: "destructive",
        });
        return;
      }
    }

    setLoading(true);
    const { error } = await resetPassword(resetEmail);

    if (error) {
      toast({
        title: t("common.error"),
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: t("common.success"),
        description: "Verifique sua caixa de entrada para redefinir sua senha.",
      });
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-8">
        <div className="flex flex-col items-center text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground mb-4">
            <Activity className="h-7 w-7" />
          </div>
          <h1 className="text-2xl font-bold font-[Plus_Jakarta_Sans]">Essencial Clínicas</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Gestão Inteligente para Clínicas de Saúde
          </p>
        </div>

        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-xl">{t("auth.login")} - {t("nav.professionals")}</CardTitle>
            <CardDescription>
              Acesse sua conta para gerenciar a clínica
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="login-email">{t("auth.email")}</Label>
                <Input
                  id="login-email"
                  type="email"
                  placeholder="seu@email.com"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  required
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="login-senha">{t("auth.password")}</Label>
                <Input
                  id="login-senha"
                  type="password"
                  placeholder="••••••••"
                  value={loginSenha}
                  onChange={(e) => setLoginSenha(e.target.value)}
                  required
                />
              </div>
              <div className="flex flex-col space-y-2">
                <Button type="submit" className="w-full" disabled={loading}>
                  <LogIn className="h-4 w-4 mr-2" />
                  {loading ? t("auth.logging_in") : t("auth.login")}
                </Button>
                <Button
                  type="button"
                  variant="link"
                  size="sm"
                  onClick={handleResetPassword}
                  className="text-muted-foreground"
                >
                  {t("auth.forgot_password")}
                </Button>
              </div>
            </form>

            <div className="mt-6 pt-6 border-t">
              <p className="text-center text-sm font-semibold mb-3">Acesso de Paciente</p>
              <p className="text-center text-xs text-muted-foreground mb-3">
                Se você é paciente, clique no botão abaixo para acessar sua área usando o código enviado
              </p>
              <Button variant="outline" className="w-full" onClick={() => navigate("/paciente-access")}>
                Acessar como Paciente
              </Button>
            </div>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground">
          Sistema de Gestão para Clínicas de Saúde
        </p>
      </div>
    </div>
  );
};

export default Login;
