import { Component, ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  isChunkError: boolean;
}

function isDynamicImportError(error: Error): boolean {
  const msg = error?.message ?? "";
  return (
    msg.includes("Failed to fetch dynamically imported module") ||
    msg.includes("Importing a module script failed") ||
    msg.includes("error loading dynamically imported module") ||
    msg.includes("Unable to preload CSS for") ||
    (error?.name === "TypeError" && msg.includes("import("))
  );
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null, isChunkError: false };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, isChunkError: isDynamicImportError(error) };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("[ErrorBoundary]", error, info.componentStack);
    if (isDynamicImportError(error)) {
      window.location.reload();
    }
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      if (this.state.isChunkError) {
        return (
          <div className="flex flex-col items-center justify-center min-h-[300px] gap-4 p-8 text-center">
            <AlertTriangle className="h-12 w-12 text-destructive" />
            <h2 className="text-lg font-semibold text-foreground">Atualização disponível</h2>
            <p className="text-sm text-muted-foreground max-w-md">
              Uma nova versão do aplicativo está disponível. A página será recarregada automaticamente.
            </p>
            <Button variant="outline" onClick={this.handleReload}>
              <RefreshCw className="h-4 w-4 mr-2" /> Recarregar agora
            </Button>
          </div>
        );
      }

      return (
        <div className="flex flex-col items-center justify-center min-h-[400px] gap-6 p-6 md:p-12 text-center animate-in fade-in zoom-in duration-300">
          <div className="bg-destructive/10 p-4 rounded-full mb-2">
            <AlertTriangle className="h-12 w-12 text-destructive" />
          </div>
          
          <div className="space-y-2 max-w-md">
            <h2 className="text-2xl font-bold tracking-tight text-foreground">Ops! Algo deu errado</h2>
            <p className="text-muted-foreground">
              Ocorreu um erro inesperado ao carregar esta parte do sistema. Não se preocupe, seus dados estão seguros.
            </p>
          </div>

          <div className="w-full max-w-sm p-4 bg-muted/30 rounded-lg border border-muted text-left">
            <p className="text-xs font-mono text-muted-foreground break-words leading-relaxed">
              {this.state.error?.message || "Erro desconhecido"}
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <Button variant="outline" onClick={this.handleReset} className="min-w-[140px]">
              <RefreshCw className="h-4 w-4 mr-2" /> Tentar novamente
            </Button>
            <Button 
                variant="ghost" 
                onClick={() => window.location.href = '/'}
                className="text-muted-foreground hover:text-foreground"
            >
              Ir para o Início
            </Button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
