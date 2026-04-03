CREATE POLICY "public_profile_verification"
ON public.profiles
FOR SELECT
TO anon
USING (true);