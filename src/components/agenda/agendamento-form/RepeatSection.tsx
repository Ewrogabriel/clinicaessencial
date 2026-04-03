import { Repeat } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FormControl, FormField, FormItem } from "@/components/ui/form";
import type { UseFormReturn } from "react-hook-form";
import type { FormData } from "./types";

interface RepeatSectionProps {
  form: UseFormReturn<FormData>;
}

export function RepeatSection({ form }: RepeatSectionProps) {
  const isRepetir = form.watch("repetir");
  const repetirTipo = form.watch("repetir_tipo");
  const repetirQuantidade = form.watch("repetir_quantidade");

  return (
    <div className="rounded-lg border p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Repeat className="h-4 w-4 text-muted-foreground" />
          <Label className="font-medium">Repetir esta sessão</Label>
        </div>
        <FormField
          control={form.control}
          name="repetir"
          render={({ field }) => (
            <FormItem>
              <FormControl>
                <Switch checked={field.value} onCheckedChange={field.onChange} />
              </FormControl>
            </FormItem>
          )}
        />
      </div>

      {isRepetir && (
        <div className="space-y-3 pt-1">
          <p className="text-xs text-muted-foreground">
            Repete no mesmo dia da semana e horário, semanalmente.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Repetir por</Label>
              <Input
                type="number"
                min={2}
                max={52}
                className="mt-1"
                value={repetirQuantidade}
                onChange={(e) => form.setValue("repetir_quantidade", Number(e.target.value) || 4)}
              />
            </div>
            <div>
              <Label className="text-xs">Tipo</Label>
              <Select
                value={repetirTipo}
                onValueChange={(v) => form.setValue("repetir_tipo", v as "vezes" | "semanas")}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="vezes">vezes</SelectItem>
                  <SelectItem value="semanas">semanas</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="rounded-md bg-muted/50 p-2 text-xs text-muted-foreground">
            Serão criadas <span className="font-semibold text-foreground">{repetirQuantidade}</span> sessões no mesmo dia/horário, uma por semana.
          </div>
        </div>
      )}
    </div>
  );
}
