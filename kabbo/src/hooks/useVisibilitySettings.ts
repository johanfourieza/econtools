import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { VisibilitySettings, PipelineStage } from '@/types/team';

interface UseVisibilitySettingsReturn {
  settings: VisibilitySettings[];
  loading: boolean;
  getSettingForTeam: (teamId: string) => VisibilitySettings | undefined;
  updateVisibility: (teamId: string, minVisibleStage: PipelineStage) => Promise<boolean>;
  refetch: () => Promise<void>;
}

export function useVisibilitySettings(userId?: string): UseVisibilitySettingsReturn {
  const [settings, setSettings] = useState<VisibilitySettings[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchSettings = useCallback(async () => {
    if (!userId) {
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('visibility_settings')
        .select('*')
        .eq('user_id', userId);

      if (error) throw error;

      setSettings(data?.map(s => ({
        id: s.id,
        userId: s.user_id,
        teamId: s.team_id,
        minVisibleStage: s.min_visible_stage as PipelineStage,
        createdAt: s.created_at,
        updatedAt: s.updated_at,
      })) || []);
    } catch (error: any) {
      console.error('Error fetching visibility settings:', error);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const getSettingForTeam = useCallback((teamId: string): VisibilitySettings | undefined => {
    return settings.find(s => s.teamId === teamId);
  }, [settings]);

  const updateVisibility = useCallback(async (teamId: string, minVisibleStage: PipelineStage): Promise<boolean> => {
    if (!userId) return false;

    try {
      const existing = settings.find(s => s.teamId === teamId);

      if (existing) {
        const { error } = await supabase
          .from('visibility_settings')
          .update({ min_visible_stage: minVisibleStage })
          .eq('id', existing.id);

        if (error) throw error;

        setSettings(prev => prev.map(s => 
          s.id === existing.id ? { ...s, minVisibleStage, updatedAt: new Date().toISOString() } : s
        ));
      } else {
        const { data, error } = await supabase
          .from('visibility_settings')
          .insert({
            user_id: userId,
            team_id: teamId,
            min_visible_stage: minVisibleStage,
          })
          .select()
          .single();

        if (error) throw error;

        setSettings(prev => [...prev, {
          id: data.id,
          userId: data.user_id,
          teamId: data.team_id,
          minVisibleStage: data.min_visible_stage as PipelineStage,
          createdAt: data.created_at,
          updatedAt: data.updated_at,
        }]);
      }

      toast.success('Visibility settings updated');
      return true;
    } catch (error: any) {
      console.error('Error updating visibility:', error);
      toast.error(error.message || 'Failed to update visibility');
      return false;
    }
  }, [userId, settings]);

  return {
    settings,
    loading,
    getSettingForTeam,
    updateVisibility,
    refetch: fetchSettings,
  };
}
