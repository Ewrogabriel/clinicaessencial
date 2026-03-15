-- ============================================================
-- Extend pagamentos / pagamentos_mensalidade / pagamentos_sessoes
-- RLS so that gestor, master, and secretario roles can properly
-- view and manage clinic payments via the Financeiro module.
-- ============================================================

-- ── pagamentos ──────────────────────────────────────────────

-- gestor: full visibility and write access over all clinic payments
CREATE POLICY "pagamentos_gestor_select" ON public.pagamentos
  FOR SELECT USING (public.has_role(auth.uid(), 'gestor'::app_role));

CREATE POLICY "pagamentos_gestor_insert" ON public.pagamentos
  FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'gestor'::app_role));

CREATE POLICY "pagamentos_gestor_update" ON public.pagamentos
  FOR UPDATE USING (public.has_role(auth.uid(), 'gestor'::app_role));

CREATE POLICY "pagamentos_gestor_delete" ON public.pagamentos
  FOR DELETE USING (public.has_role(auth.uid(), 'gestor'::app_role));

-- master: read and confirm payments (update) but not delete
CREATE POLICY "pagamentos_master_select" ON public.pagamentos
  FOR SELECT USING (public.has_role(auth.uid(), 'master'::app_role));

CREATE POLICY "pagamentos_master_update" ON public.pagamentos
  FOR UPDATE USING (public.has_role(auth.uid(), 'master'::app_role));

-- secretario: read-only
CREATE POLICY "pagamentos_secretario_select" ON public.pagamentos
  FOR SELECT USING (public.has_role(auth.uid(), 'secretario'::app_role));

-- ── pagamentos_mensalidade ───────────────────────────────────

-- master: read and confirm
CREATE POLICY "pag_mensalidade_master_select" ON public.pagamentos_mensalidade
  FOR SELECT USING (public.has_role(auth.uid(), 'master'::app_role));

CREATE POLICY "pag_mensalidade_master_update" ON public.pagamentos_mensalidade
  FOR UPDATE USING (public.has_role(auth.uid(), 'master'::app_role));

-- secretario: read-only
CREATE POLICY "pag_mensalidade_secretario_select" ON public.pagamentos_mensalidade
  FOR SELECT USING (public.has_role(auth.uid(), 'secretario'::app_role));

-- ── pagamentos_sessoes ───────────────────────────────────────

-- master: read and confirm
CREATE POLICY "pag_sessoes_master_select" ON public.pagamentos_sessoes
  FOR SELECT USING (public.has_role(auth.uid(), 'master'::app_role));

CREATE POLICY "pag_sessoes_master_update" ON public.pagamentos_sessoes
  FOR UPDATE USING (public.has_role(auth.uid(), 'master'::app_role));

-- secretario: read-only
CREATE POLICY "pag_sessoes_secretario_select" ON public.pagamentos_sessoes
  FOR SELECT USING (public.has_role(auth.uid(), 'secretario'::app_role));
