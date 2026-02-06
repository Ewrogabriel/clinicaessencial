import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Activity, LogIn, UserPlus } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";

const Login = () => {
  const navigate = useNavigate();
  const { signIn, signUp } = useAuth();
  const [loading, setLoading] = useState(false);

  // Login state
  const [loginEmail, setLoginEmail] = useState("");
  const [loginSenha, setLoginSenha] = useState("");

  // Cadastro state
  const [cadastroNome, setCadastroNome] = useState("");
  const [cadastroEmail, setCadastroEmail] = useState("");
  const [cadastroSenha, setCadastroSenha] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { error } = await signIn(loginEmail, loginSenha);

    if (error) {
      toast({
        title: "Erro ao entrar",
        description: error.message === "Invalid login credentials"
          ? "E-mail ou senha incorretos"
          : error.message,
        variant: "destructive",
      });
    } else {
      navigate("/dashboard");
    }

    setLoading(false);
  };

  const handleCadastro = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { error } = await signUp(cadastroEmail, cadastroSenha, cadastroNome);

    if (error) {
      toast({
        title: "Erro ao cadastrar",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Cadastro realizado!",
        description: "Verifique seu e-mail para confirmar a conta.",
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
          <h1 className="text-2xl font-bold font-[Plus_Jakarta_Sans]">FisioClin</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Sistema de Gestão Clínica
          </p>
        </div>

        <Card>
          <Tabs defaultValue="login">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="login">Entrar</TabsTrigger>
              <TabsTrigger value="cadastro">Cadastrar</TabsTrigger>
            </TabsList>

            <TabsContent value="login">
              <CardHeader className="text-center pt-4">
                <CardTitle className="text-xl">Entrar</CardTitle>
                <CardDescription>
                  Acesse sua conta para gerenciar a clínica
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="login-email">E-mail</Label>
                    <Input
                      id="login-email"
                      type="email"
                      placeholder="seu@email.com"
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="login-senha">Senha</Label>
                    <Input
                      id="login-senha"
                      type="password"
                      placeholder="••••••••"
                      value={loginSenha}
                      onChange={(e) => setLoginSenha(e.target.value)}
                      required
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={loading}>
                    <LogIn className="h-4 w-4 mr-2" />
                    {loading ? "Entrando..." : "Entrar"}
                  </Button>
                </form>
              </CardContent>
            </TabsContent>

            <TabsContent value="cadastro">
              <CardHeader className="text-center pt-4">
                <CardTitle className="text-xl">Cadastrar</CardTitle>
                <CardDescription>
                  Crie uma conta para acessar o sistema
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleCadastro} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="cadastro-nome">Nome Completo</Label>
                    <Input
                      id="cadastro-nome"
                      placeholder="Seu nome"
                      value={cadastroNome}
                      onChange={(e) => setCadastroNome(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="cadastro-email">E-mail</Label>
                    <Input
                      id="cadastro-email"
                      type="email"
                      placeholder="seu@email.com"
                      value={cadastroEmail}
                      onChange={(e) => setCadastroEmail(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="cadastro-senha">Senha</Label>
                    <Input
                      id="cadastro-senha"
                      type="password"
                      placeholder="Mínimo 6 caracteres"
                      value={cadastroSenha}
                      onChange={(e) => setCadastroSenha(e.target.value)}
                      required
                      minLength={6}
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={loading}>
                    <UserPlus className="h-4 w-4 mr-2" />
                    {loading ? "Cadastrando..." : "Cadastrar"}
                  </Button>
                </form>
              </CardContent>
            </TabsContent>
          </Tabs>
        </Card>

        <p className="text-center text-xs text-muted-foreground">
          Fisioterapia · Pilates · RPG
        </p>
      </div>
    </div>
  );
};

export default Login;
