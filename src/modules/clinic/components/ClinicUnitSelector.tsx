import { useMemo } from "react";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import type { ClinicWithGroup } from "@/types/entities";

interface ClinicUnitSelectorProps {
    /** All selectable clinic units for the current booking flow. */
    units: ClinicWithGroup[];
    /** Currently selected clinic unit id. */
    value: string | null;
    /** Called when the user picks a different unit. */
    onChange: (clinicId: string) => void;
    /** When true, the selector is disabled (e.g. during submission). */
    disabled?: boolean;
    /** Label shown above the selector. Defaults to "Unidade". */
    label?: string;
    /** Placeholder shown when no unit is selected. */
    placeholder?: string;
}

/**
 * ClinicUnitSelector
 *
 * Renders a Select dropdown for choosing a clinic unit during the
 * appointment booking flow. It is used when a patient belongs to a
 * clinic group and can book in any member unit.
 *
 * When only one unit is available the selector is automatically disabled
 * so the user is not presented with a meaningless choice.
 */
export function ClinicUnitSelector({
    units,
    value,
    onChange,
    disabled = false,
    label = "Unidade",
    placeholder = "Selecione a unidade",
}: ClinicUnitSelectorProps) {
    const sortedUnits = useMemo(
        () => [...units].sort((a, b) => a.nome.localeCompare(b.nome)),
        [units],
    );

    const isSingleUnit = sortedUnits.length <= 1;

    return (
        <div className="flex flex-col gap-1.5">
            <Label htmlFor="clinic-unit-selector">{label}</Label>
            <Select
                value={value ?? ""}
                onValueChange={onChange}
                disabled={disabled || isSingleUnit}
            >
                <SelectTrigger id="clinic-unit-selector" className="w-full">
                    <SelectValue placeholder={placeholder} />
                </SelectTrigger>
                <SelectContent>
                    {sortedUnits.map((unit) => (
                        <SelectItem key={unit.id} value={unit.id}>
                            {unit.nome}
                            {unit.cidade ? ` — ${unit.cidade}` : ""}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </div>
    );
}
