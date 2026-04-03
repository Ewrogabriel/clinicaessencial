import { DollarSign } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import type { UseFormReturn } from "react-hook-form";
import type { FormData, FormaPagamento } from "./types";

interface FinancialSectionProps {
  form: UseFormReturn<FormData>;
  formasPagamento: FormaPagamento[];
  showValorMensal?: boolean;
}

function PaymentMethodSelect({ form, formasPagamento }: { form: UseFormReturn<FormData>; formasPagamento: FormaPagamento[] }) {
  return (
    <FormField
      control={form.control}
      name="forma_pagamento"
      render={({ field }) => (
        <FormItem>
          <FormLabel className="text-xs">Forma de Pagamento</FormLabel>
          <Select onValueChange={field.onChange} value={field.value ?? ""}>
            <FormControl>
              <SelectTrigger>
                <SelectValue placeholder="Selecione (opcional)" />
              </SelectTrigger>
            </FormControl>
            <SelectContent>
              {formasPagamento.map((f) => (
                <SelectItem key={f.id} value={f.nome.toLowerCase()}>{f.nome}</SelectItem>
              ))}
              {formasPagamento.length === 0 && (
                <>
                  <SelectItem value="pix">PIX</SelectItem>
                  <SelectItem value="dinheiro">Dinheiro</SelectItem>
                  <SelectItem value="cartao_debito">Cartão de Débito</SelectItem>
                  <SelectItem value="cartao_credito">Cartão de Crédito</SelectItem>
                  <SelectItem value="transferencia">Transferência Bancária</SelectItem>
                  <SelectItem value="convenio">Convênio</SelectItem>
                  <SelectItem value="boleto">Boleto</SelectItem>
                </>
              )}
            </SelectContent>
          </Select>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

export function FinancialSection({ form, formasPagamento, showValorMensal = false }: FinancialSectionProps) {
  return (
    <div className="rounded-lg border p-4 space-y-3">
      <div className="flex items-center gap-2">
        <DollarSign className="h-4 w-4 text-muted-foreground" />
        <Label className="font-medium">{showValorMensal ? "Financeiro Recorrente" : "Financeiro da Sessão"}</Label>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <FormField
          control={form.control}
          name="valor_sessao"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs">{showValorMensal ? "Valor p/ Sessão (R$)" : "Valor (R$)"}</FormLabel>
              <FormControl>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">R$</span>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0,00"
                    className="pl-10"
                    value={field.value ?? ""}
                    onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : undefined)}
                  />
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        {showValorMensal ? (
          <FormField
            control={form.control}
            name="valor_mensal"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs">Valor Mensal (Pacote)</FormLabel>
                <FormControl>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">R$</span>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="Opcional"
                      className="pl-10"
                      value={field.value ?? ""}
                      onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : undefined)}
                    />
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        ) : (
          <FormField
            control={form.control}
            name="data_vencimento"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs">Data de Vencimento</FormLabel>
                <FormControl>
                  <Input type="date" {...field} value={field.value ?? ""} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        )}
      </div>
      {showValorMensal && (
        <div className="grid grid-cols-2 gap-3">
          <FormField
            control={form.control}
            name="data_vencimento"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs">Data de Vencimento</FormLabel>
                <FormControl>
                  <Input type="date" {...field} value={field.value ?? ""} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <PaymentMethodSelect form={form} formasPagamento={formasPagamento} />
        </div>
      )}
      {!showValorMensal && <PaymentMethodSelect form={form} formasPagamento={formasPagamento} />}
    </div>
  );
}
