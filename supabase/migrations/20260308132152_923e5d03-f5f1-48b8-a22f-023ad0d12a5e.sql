
-- Allow profissional to insert into lista_espera
CREATE POLICY "lista_espera_prof_insert" ON public.lista_espera
  FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'profissional'));

-- Allow profissional to update lista_espera
CREATE POLICY "lista_espera_prof_update" ON public.lista_espera
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'profissional'));

-- Allow profissional to delete from lista_espera
CREATE POLICY "lista_espera_prof_delete" ON public.lista_espera
  FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'profissional'));
