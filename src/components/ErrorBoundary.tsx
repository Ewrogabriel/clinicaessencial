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
        <div className="flex flex-col items-center justify-center min-h-[300px] gap-4 p-8 text-center">
          <AlertTriangle className="h-12 w-12 text-destructive" />
          <h2 className="text-lg font-semibold text-foreground">Algo deu errado</h2>
          <p className="text-sm text-muted-foreground max-w-md">
            {this.state.error?.message || "Erro inesperado. Tente novamente."}
          </p>
          <Button variant="outline" onClick={this.handleReset}>
            <RefreshCw className="h-4 w-4 mr-2" /> Tentar novamente
          </Button>
        </div>
      );
    }
    return this.props.children;
  }
}
