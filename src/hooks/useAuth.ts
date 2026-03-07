import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface PatientSession {
  paciente_id: string;
  session_token: string;
  nome: string;
  expires_at: string;
}

export const useAuth = () => {
  const [patientId, setPatientId] = useState<string | null>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initializeAuth = async () => {
      try {
        // Check localStorage for patient session
        const sessionStr = localStorage.getItem('paciente_session');
        
        if (!sessionStr) {
          setLoading(false);
          return;
        }

        const session: PatientSession = JSON.parse(sessionStr);
        
        // Check if session is expired
        const expiresAt = new Date(session.expires_at);
        if (expiresAt < new Date()) {
          localStorage.removeItem('paciente_session');
          setLoading(false);
          return;
        }

        setPatientId(session.paciente_id);
        
        // Fetch full patient profile
        const { data: paciente, error } = await (supabase
          .from('pacientes')
          .select('*')
          .eq('id', session.paciente_id)
          .single() as any);

        if (error) {
          console.error('Error fetching patient profile:', error);
          setLoading(false);
          return;
        }

        setProfile(paciente);
      } catch (error) {
        console.error('Auth initialization error:', error);
      } finally {
        setLoading(false);
      }
    };

    initializeAuth();
  }, []);

  const logout = () => {
    localStorage.removeItem('paciente_session');
    setPatientId(null);
    setProfile(null);
  };

  return {
    patientId,
    profile,
    loading,
    logout,
    isAuthenticated: !!patientId,
  };
};
