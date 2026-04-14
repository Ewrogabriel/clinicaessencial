
-- Allow authenticated users to insert into pagamentos_mensalidade
CREATE POLICY "authenticated_insert_pagamentos_mensalidade"
ON public.pagamentos_mensalidade
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Allow authenticated users to update pagamentos_mensalidade
CREATE POLICY "authenticated_update_pagamentos_mensalidade"
ON public.pagamentos_mensalidade
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

-- Allow authenticated users to select pagamentos_mensalidade
CREATE POLICY "authenticated_select_pagamentos_mensalidade"
ON public.pagamentos_mensalidade
FOR SELECT
TO authenticated
USING (true);
