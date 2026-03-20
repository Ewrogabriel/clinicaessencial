import { useQuery } from "@tanstack/react-query";
import { financeService } from "../services/financeService";

export function usePatientFinance(patientId: string | null, enabled: boolean = true) {
    const pendencias = useQuery({
        queryKey: ["patient-pendencias", patientId],
        queryFn: () => financeService.getPatientPendencias(patientId!),
        enabled: !!patientId && enabled,
    });

    const formasPagamento = useQuery({
        queryKey: ["formas-pagamento-ativas"],
        queryFn: () => financeService.getFormasPagamento(),
        enabled,
    });

    const pagamentosMensalidade = useQuery({
        queryKey: ["pagamentos-mensalidade-paciente", patientId],
        queryFn: () => financeService.getPagamentosMensalidade(patientId!),
        enabled: !!patientId && enabled,
    });

    const pagamentosSessoes = useQuery({
        queryKey: ["pagamentos-sessoes-paciente", patientId],
        queryFn: () => financeService.getPagamentosSessoes(patientId!),
        enabled: !!patientId && enabled,
    });

    const configPixMap = useQuery({
        queryKey: ["config-pix-map"],
        queryFn: () => financeService.getConfigPix(),
        enabled,
    });

    return {
        pendencias: pendencias.data || [],
        formasPagamento: formasPagamento.data || [],
        pagamentosMensalidade: pagamentosMensalidade.data || [],
        pagamentosSessoes: pagamentosSessoes.data || [],
        configPixMap: configPixMap.data || {},
        isLoading: pendencias.isLoading || formasPagamento.isLoading ||
            pagamentosMensalidade.isLoading || pagamentosSessoes.isLoading,
    };
}
