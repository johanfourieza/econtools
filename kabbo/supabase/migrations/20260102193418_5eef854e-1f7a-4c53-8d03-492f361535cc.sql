-- Add explicit deny policies for anonymous users on INSERT, UPDATE, DELETE operations for profiles table
-- This closes the security gap where anonymous users could potentially access data through these operations

-- Deny anonymous INSERT access to profiles
CREATE POLICY "Deny anonymous insert to profiles"
ON public.profiles
FOR INSERT
TO anon
WITH CHECK (false);

-- Deny anonymous UPDATE access to profiles
CREATE POLICY "Deny anonymous update to profiles"
ON public.profiles
FOR UPDATE
TO anon
USING (false);

-- Deny anonymous DELETE access to profiles
CREATE POLICY "Deny anonymous delete to profiles"
ON public.profiles
FOR DELETE
TO anon
USING (false);