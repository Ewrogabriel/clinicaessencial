import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useClinic } from "@/modules/clinic/hooks/useClinic";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Building2, Activity } from "lucide-react";

const SelecionarClinica = () => {
  const navigate = useNavigate();
  const { clinics, setActiveClinicId, isLoading, isMultiClinic } = useClinic();

  // If only one clinic, auto-select and redirect
  useEffect(() => {
    if (!isLoading && clinics.length === 1) {
      setActiveClinicId(clinics[0].id);
      navigate("/dashboard");
    }
    if (!isLoading && clinics.length === 0) {
      navigate("/dashboard");
    }
  }, [isLoading, clinics, setActiveClinicId, navigate]);

  const handleSelect = (clinicId: string) => {
    setActiveClinicId(clinicId);
    navigate("/dashboard");
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground">Carregando clínicas...</p>
      </div>
    );
  }

  if (!isMultiClinic) return null;

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="flex flex-col items-center text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground mb-4">
            <Activity className="h-7 w-7" />
          </div>
          <h1 className="text-2xl font-bold font-[Plus_Jakarta_Sans]">Selecionar Unidade</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Escolha a clínica que deseja acessar
          </p>
        </div>

        <div className="space-y-3">
          {clinics.map((clinic) => (
            <Card
              key={clinic.id}
              className="cursor-pointer transition-all hover:border-primary hover:shadow-md"
              onClick={() => handleSelect(clinic.id)}
            >
              <CardContent className="flex items-center gap-4 py-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary shrink-0">
                  <Building2 className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm">{clinic.nome}</p>
                  {clinic.cidade && (
                    <p className="text-xs text-muted-foreground">
                      {clinic.cidade}{clinic.estado ? ` - ${clinic.estado}` : ""}
                    </p>
                  )}
                </div>
                <Button variant="ghost" size="sm">Acessar</Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
};

export default SelecionarClinica;
