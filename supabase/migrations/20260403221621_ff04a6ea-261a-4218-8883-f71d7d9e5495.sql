
-- Allow anon users to read teleconsulta sessions by room_id (for public patient access)
CREATE POLICY "anon_read_teleconsulta_by_room"
ON public.teleconsulta_sessions
FOR SELECT
TO anon
USING (true);

-- Allow anon users to update session status (e.g. waiting_room_entered_at)
CREATE POLICY "anon_update_teleconsulta_session"
ON public.teleconsulta_sessions
FOR UPDATE
TO anon
USING (true)
WITH CHECK (true);

-- Allow anon users to read chat messages for a session
CREATE POLICY "anon_read_teleconsulta_messages"
ON public.teleconsulta_messages
FOR SELECT
TO anon
USING (true);

-- Allow anon users to insert chat messages
CREATE POLICY "anon_insert_teleconsulta_messages"
ON public.teleconsulta_messages
FOR INSERT
TO anon
WITH CHECK (true);
