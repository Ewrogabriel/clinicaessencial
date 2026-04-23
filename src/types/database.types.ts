/**
 * Re-export of the auto-generated Supabase database types so the rest of the
 * codebase can import from `@/types/database.types` without coupling directly
 * to the integrations file.
 *
 * NOTE: The canonical source is `src/integrations/supabase/types.ts`, which is
 * regenerated automatically and must NOT be edited by hand.
 */
export type {
  Json,
  Database,
  Tables,
  TablesInsert,
  TablesUpdate,
  Enums,
} from "@/integrations/supabase/types";

/**
 * The unified-payments view is no longer present in the database.
 * Finance services now build these objects in code (see `financeService.ts`),
 * so we expose a structural shape that mirrors what the previous view returned.
 */
export type Payment = {
  id: string;
  paciente_id: string | null;
  paciente_nome?: string | null;
  valor: number;
  data_pagamento: string | null;
  data_vencimento?: string | null;
  status: string;
  forma_pagamento?: string | null;
  descricao?: string | null;
  origem?: string | null;
  origem_tipo?: string | null;
  source_table?: string | null;
  clinic_id?: string | null;
  created_at?: string | null;
};

export type UnifiedPayment = Payment & {
  tipo?: string | null;
  referencia?: string | null;
  profissional_id?: string | null;
  profissional_nome?: string | null;
  mes_referencia?: string | null;
};
