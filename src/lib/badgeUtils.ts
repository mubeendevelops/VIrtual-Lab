import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface BadgeCriteria {
  experiments_completed?: number;
  experiment_type?: string;
  completed?: boolean;
  accuracy_threshold?: number;
  xp_threshold?: number;
  subject?: string;
  min_accuracy?: number;
}

interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string;
  tier: string;
  criteria: BadgeCriteria;
}

interface ExperimentRun {
  id: string;
  experiment_id: string;
  status: string;
  score: number | null;
  accuracy: number | null;
  experiments?: {
    name: string;
    subject: string;
  };
}

/**
 * Checks and awards badges based on user's current progress
 */
export async function checkAndAwardBadges(
  userId: string,
  currentXP: number,
  completedExperiment?: ExperimentRun
): Promise<string[]> {
  const awardedBadgeNames: string[] = [];

  try {
    // Fetch all badges
    const { data: allBadges, error: badgesError } = await supabase
      .from('badges')
      .select('*');

    if (badgesError || !allBadges) {
      console.error('Error fetching badges:', badgesError);
      return awardedBadgeNames;
    }

    // Fetch user's already earned badges
    const { data: userBadges, error: userBadgesError } = await supabase
      .from('user_badges')
      .select('badge_id')
      .eq('user_id', userId);

    if (userBadgesError) {
      console.error('Error fetching user badges:', userBadgesError);
      return awardedBadgeNames;
    }

    const earnedBadgeIds = new Set(userBadges?.map(ub => ub.badge_id) || []);

    // Fetch all user's experiment runs for criteria checking
    const { data: allRuns, error: runsError } = await supabase
      .from('experiment_runs')
      .select(`
        id,
        experiment_id,
        status,
        score,
        accuracy,
        experiments (name, subject)
      `)
      .eq('user_id', userId);

    if (runsError) {
      console.error('Error fetching experiment runs:', runsError);
      return awardedBadgeNames;
    }

    const completedRuns = (allRuns || []).filter(r => r.status === 'completed');
    const chemistryRuns = completedRuns.filter(r => 
      (r.experiments as any)?.subject?.toLowerCase() === 'chemistry'
    );
    const biologyRuns = completedRuns.filter(r => 
      (r.experiments as any)?.subject?.toLowerCase() === 'biology'
    );

    // Helper function to normalize experiment names for matching
    const normalizeExperimentName = (name: string): string => {
      return name.toLowerCase()
        .replace(/[''"]/g, '') // Remove apostrophes and quotes
        .replace(/\s+/g, ' ')   // Normalize whitespace
        .trim();
    };

    // Check each badge
    for (const badge of allBadges as Badge[]) {
      // Skip if already earned
      if (earnedBadgeIds.has(badge.id)) {
        continue;
      }

      const criteria = badge.criteria as BadgeCriteria;
      let shouldAward = false;
      
      // Debug logging
      if (completedExperiment) {
        console.log(`[Badge Check] ${badge.name}:`, {
          criteria,
          experimentName: (completedExperiment.experiments as any)?.name,
          experimentSubject: (completedExperiment.experiments as any)?.subject,
          status: completedExperiment.status,
          score: completedExperiment.score
        });
      }

      // Check experiments_completed criteria
      if (criteria.experiments_completed !== undefined) {
        if (criteria.experiment_type) {
          // Count completed runs for specific experiment type
          const expTypeNormalized = normalizeExperimentName(criteria.experiment_type);
          const typeRuns = completedRuns.filter(r => {
            const expName = normalizeExperimentName((r.experiments as any)?.name || '');
            return expName.includes(expTypeNormalized);
          });
          
          // If min_accuracy is also specified, filter by accuracy
          if (criteria.min_accuracy !== undefined) {
            const accurateRuns = typeRuns.filter(r => (r.score || 0) >= criteria.min_accuracy!);
            if (accurateRuns.length >= criteria.experiments_completed) {
              shouldAward = true;
            }
          } else {
            if (typeRuns.length >= criteria.experiments_completed) {
              shouldAward = true;
            }
          }
        } else if (criteria.subject) {
          // Count completed runs for specific subject
          const subjectRuns = completedRuns.filter(r => 
            ((r.experiments as any)?.subject || '').toLowerCase() === criteria.subject?.toLowerCase()
          );
          if (subjectRuns.length >= criteria.experiments_completed) {
            shouldAward = true;
          }
        } else {
          // Count all completed runs
          if (completedRuns.length >= criteria.experiments_completed) {
            shouldAward = true;
          }
        }
      }

      // Check experiment_type criteria (e.g., titration, ohms law, osmosis)
      if (criteria.experiment_type && completedExperiment) {
        const expName = normalizeExperimentName((completedExperiment.experiments as any)?.name || '');
        const expTypeNormalized = normalizeExperimentName(criteria.experiment_type);
        // Check if experiment name contains the type (handles "ohm's law", "ohms law", "osmosis", etc.)
        if (expName.includes(expTypeNormalized) && completedExperiment.status === 'completed') {
          // For badges that only require completion (completed: true), award immediately
          if (criteria.completed === true) {
            shouldAward = true;
          } else if (!criteria.accuracy_threshold && !criteria.experiments_completed) {
            // If no other criteria specified, award for completion
            shouldAward = true;
          }
        }
      }

      // Check accuracy_threshold criteria
      // If experiment_type is specified, check accuracy for that specific experiment type
      if (criteria.accuracy_threshold !== undefined) {
        if (criteria.experiment_type) {
          // Check accuracy for specific experiment type
          const expTypeNormalized = normalizeExperimentName(criteria.experiment_type);
          const typeRuns = completedRuns.filter(r => {
            const expName = normalizeExperimentName((r.experiments as any)?.name || '');
            return expName.includes(expTypeNormalized);
          });
          const maxAccuracy = typeRuns.length > 0
            ? Math.max(...typeRuns.map(r => r.score || 0))
            : 0;
          if (maxAccuracy >= criteria.accuracy_threshold) {
            shouldAward = true;
          }
        } else {
          // Check overall max accuracy
          const maxAccuracy = completedRuns.length > 0
            ? Math.max(...completedRuns.map(r => r.score || 0))
            : 0;
          if (maxAccuracy >= criteria.accuracy_threshold) {
            shouldAward = true;
          }
        }
      }

      // Check xp_threshold criteria
      if (criteria.xp_threshold !== undefined) {
        if (currentXP >= criteria.xp_threshold) {
          shouldAward = true;
        }
      }

      // Check subject + min_accuracy criteria (e.g., Chemistry Wizard, Biology Wizard)
      if (criteria.subject && criteria.min_accuracy !== undefined) {
        const subjectRuns = completedRuns.filter(r => 
          (r.experiments as any)?.subject?.toLowerCase() === criteria.subject?.toLowerCase()
        );
        const allSubjectRuns = (allRuns || []).filter(r => 
          (r.experiments as any)?.subject?.toLowerCase() === criteria.subject?.toLowerCase()
        );
        
        // Check if all experiments for this subject are completed with required accuracy
        if (allSubjectRuns.length > 0 && 
            subjectRuns.length === allSubjectRuns.length &&
            subjectRuns.every(r => (r.score || 0) >= criteria.min_accuracy!)) {
          shouldAward = true;
        }
      }

      // Award the badge if criteria is met
      if (shouldAward) {
        console.log(`[Badge Award] Awarding badge: ${badge.name}`);
        const { error: awardError } = await supabase
          .from('user_badges')
          .insert({
            user_id: userId,
            badge_id: badge.id,
            earned_at: new Date().toISOString(),
          });

        if (!awardError) {
          awardedBadgeNames.push(badge.name);
          toast.success(`🏆 Badge Earned: ${badge.icon} ${badge.name}!`, {
            description: badge.description,
            duration: 5000,
          });
        } else {
          console.error(`[Badge Award] Error awarding badge ${badge.id}:`, awardError);
        }
      } else if (completedExperiment) {
        console.log(`[Badge Check] ${badge.name}: Criteria not met`);
      }
    }
  } catch (error) {
    console.error('Error in checkAndAwardBadges:', error);
  }

  return awardedBadgeNames;
}

