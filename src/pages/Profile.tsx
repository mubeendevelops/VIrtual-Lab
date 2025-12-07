import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Layout } from '@/components/layout/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { checkAndAwardBadges } from '@/lib/badgeUtils';
import { 
  User, 
  Award, 
  FlaskConical, 
  Target,
  Sparkles,
  Edit,
  Save,
  X,
  Trophy,
  TrendingUp,
  Calendar,
  Mail,
  GraduationCap
} from 'lucide-react';

interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string;
  tier: string;
  xp_requirement: number;
  criteria: {
    experiments_completed?: number;
    experiment_type?: string;
    completed?: boolean;
    accuracy_threshold?: number;
    xp_threshold?: number;
    subject?: string;
    min_accuracy?: number;
  };
  earned_at?: string;
  is_earned: boolean;
  progress?: number;
}

interface ExperimentRun {
  id: string;
  experiment_id: string;
  status: string;
  score: number | null;
  xp_earned: number;
  completed_at: string | null;
  experiments: {
    name: string;
    subject: string;
  };
}

export default function Profile() {
  const { user, profile, updateProfile } = useAuth();
  const [badges, setBadges] = useState<Badge[]>([]);
  const [recentExperiments, setRecentExperiments] = useState<ExperimentRun[]>([]);
  const [allExperiments, setAllExperiments] = useState<ExperimentRun[]>([]);
  const [stats, setStats] = useState({
    totalExperiments: 0,
    completedExperiments: 0,
    averageAccuracy: 0,
    totalXP: 0,
  });
  const [isEditing, setIsEditing] = useState(false);
  const [editedName, setEditedName] = useState(profile?.full_name || '');
  const [editedClassName, setEditedClassName] = useState(profile?.class_name || '');

  useEffect(() => {
    if (profile && user) {
      setEditedName(profile.full_name || '');
      setEditedClassName(profile.class_name || '');
      fetchProfileData();
      // Check for any badges that should be awarded (run once on mount)
      checkAndAwardBadges(user.id, profile.xp_points).then(() => {
        // Refresh badge data after checking
        fetchProfileData();
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile]);

  const fetchProfileData = async () => {
    if (!user) return;

    // Fetch all badges
    const { data: allBadges } = await supabase
      .from('badges')
      .select('*')
      .order('xp_requirement', { ascending: true });

    // Fetch user's earned badges
    const { data: userBadges } = await supabase
      .from('user_badges')
      .select(`
        earned_at,
        badge_id,
        badges (id, name, description, icon, tier, xp_requirement, criteria)
      `)
      .eq('user_id', user.id);

    // Fetch all experiment runs for progress calculation
    const { data: allExperimentRuns } = await supabase
      .from('experiment_runs')
      .select(`
        id,
        experiment_id,
        status,
        score,
        accuracy,
        xp_earned,
        completed_at,
        experiments (name, subject)
      `)
      .eq('user_id', user.id);

    if (allExperimentRuns) {
      setAllExperiments(allExperimentRuns as unknown as ExperimentRun[]);
      
      const completed = allExperimentRuns.filter(e => e.status === 'completed');
      const avgAccuracy = completed.length > 0
        ? completed.reduce((sum, e) => sum + (e.score || 0), 0) / completed.length
        : 0;
      
      setStats({
        totalExperiments: allExperimentRuns.length,
        completedExperiments: completed.length,
        averageAccuracy: Math.round(avgAccuracy),
        totalXP: profile?.xp_points || 0,
      });
    }

    // Fetch recent completed experiments for display
    const { data: recentRuns } = await supabase
      .from('experiment_runs')
      .select(`
        id,
        experiment_id,
        status,
        score,
        xp_earned,
        completed_at,
        experiments (name, subject)
      `)
      .eq('user_id', user.id)
      .eq('status', 'completed')
      .order('completed_at', { ascending: false })
      .limit(10);

    if (recentRuns) {
      setRecentExperiments(recentRuns as unknown as ExperimentRun[]);
    }

    // Process badges with earned status and progress
    if (allBadges && allExperimentRuns) {
      const earnedBadgeIds = new Set(userBadges?.map(ub => ub.badge_id) || []);
      const completedRuns = allExperimentRuns.filter(e => e.status === 'completed');
      const chemistryRuns = completedRuns.filter(e => 
        (e.experiments as any)?.subject?.toLowerCase() === 'chemistry'
      );
      const maxAccuracy = completedRuns.length > 0
        ? Math.max(...completedRuns.map(e => e.score || 0))
        : 0;

      const processedBadges = allBadges.map(badge => {
        const isEarned = earnedBadgeIds.has(badge.id);
        const criteria = badge.criteria as any;
        let progress = 0;

        // Calculate progress for each badge type
        // Helper function to normalize experiment names for matching
        const normalizeExperimentName = (name: string): string => {
          return name.toLowerCase()
            .replace(/[''"]/g, '') // Remove apostrophes and quotes
            .replace(/\s+/g, ' ')   // Normalize whitespace
            .trim();
        };

        if (criteria.experiments_completed) {
          if (criteria.experiment_type) {
            // Count runs for specific experiment type
            const expTypeNormalized = normalizeExperimentName(criteria.experiment_type);
            const typeRuns = completedRuns.filter(e => {
              const expName = normalizeExperimentName((e.experiments as any)?.name || '');
              return expName.includes(expTypeNormalized);
            });
            
            if (criteria.min_accuracy !== undefined) {
              const accurateRuns = typeRuns.filter(e => (e.score || 0) >= criteria.min_accuracy!);
              progress = Math.min(100, (accurateRuns.length / criteria.experiments_completed) * 100);
            } else {
              progress = Math.min(100, (typeRuns.length / criteria.experiments_completed) * 100);
            }
          } else if (criteria.subject) {
            // Count runs for specific subject
            const subjectRuns = completedRuns.filter(e => 
              ((e.experiments as any)?.subject || '').toLowerCase() === criteria.subject?.toLowerCase()
            );
            progress = Math.min(100, (subjectRuns.length / criteria.experiments_completed) * 100);
          } else {
            progress = Math.min(100, (completedRuns.length / criteria.experiments_completed) * 100);
          }
        } else if (criteria.xp_threshold) {
          progress = Math.min(100, ((profile?.xp_points || 0) / criteria.xp_threshold) * 100);
        } else if (criteria.accuracy_threshold) {
          if (criteria.experiment_type) {
            // Check accuracy for specific experiment type
            const expTypeNormalized = normalizeExperimentName(criteria.experiment_type);
            const typeRuns = completedRuns.filter(e => {
              const expName = normalizeExperimentName((e.experiments as any)?.name || '');
              return expName.includes(expTypeNormalized);
            });
            const typeMaxAccuracy = typeRuns.length > 0
              ? Math.max(...typeRuns.map(r => r.score || 0))
              : 0;
            progress = typeMaxAccuracy >= criteria.accuracy_threshold ? 100 : (typeMaxAccuracy / criteria.accuracy_threshold) * 100;
          } else {
            progress = maxAccuracy >= criteria.accuracy_threshold ? 100 : (maxAccuracy / criteria.accuracy_threshold) * 100;
          }
        } else if (criteria.experiment_type && !criteria.accuracy_threshold) {
          // Simple experiment type completion check
          const expTypeNormalized = normalizeExperimentName(criteria.experiment_type);
          const typeCompleted = completedRuns.some(e => {
            const expName = normalizeExperimentName((e.experiments as any)?.name || '');
            return expName.includes(expTypeNormalized);
          });
          progress = typeCompleted ? 100 : 0;
        } else if (criteria.subject === 'chemistry' && criteria.min_accuracy) {
          const chemistryWithAccuracy = chemistryRuns.filter(e => (e.score || 0) >= criteria.min_accuracy);
          // This is a complex badge - assume all chemistry experiments need to be completed
          const allChemistry = allExperimentRuns.filter(e => 
            (e.experiments as any)?.subject?.toLowerCase() === 'chemistry'
          );
          progress = allChemistry.length > 0 
            ? Math.min(100, (chemistryWithAccuracy.length / allChemistry.length) * 100)
            : 0;
        } else if (criteria.subject === 'physics' && criteria.min_accuracy) {
          const physicsRuns = completedRuns.filter(e => 
            ((e.experiments as any)?.subject || '').toLowerCase() === 'physics'
          );
          const allPhysics = allExperimentRuns.filter(e => 
            ((e.experiments as any)?.subject || '').toLowerCase() === 'physics'
          );
          const physicsWithAccuracy = physicsRuns.filter(e => (e.score || 0) >= criteria.min_accuracy!);
          progress = allPhysics.length > 0 
            ? Math.min(100, (physicsWithAccuracy.length / allPhysics.length) * 100)
            : 0;
        } else if (criteria.subject === 'biology' && criteria.min_accuracy) {
          const biologyRuns = completedRuns.filter(e => 
            ((e.experiments as any)?.subject || '').toLowerCase() === 'biology'
          );
          const allBiology = allExperimentRuns.filter(e => 
            ((e.experiments as any)?.subject || '').toLowerCase() === 'biology'
          );
          const biologyWithAccuracy = biologyRuns.filter(e => (e.score || 0) >= criteria.min_accuracy!);
          progress = allBiology.length > 0 
            ? Math.min(100, (biologyWithAccuracy.length / allBiology.length) * 100)
            : 0;
        } else {
          progress = isEarned ? 100 : 0;
        }

        const earnedBadge = userBadges?.find(ub => ub.badge_id === badge.id);

        return {
          ...badge,
          criteria: criteria,
          is_earned: isEarned,
          earned_at: earnedBadge?.earned_at,
          progress: Math.round(progress),
        };
      });

      // Sort: earned first, then by tier and progress
      processedBadges.sort((a, b) => {
        if (a.is_earned !== b.is_earned) return a.is_earned ? -1 : 1;
        const tierOrder = { platinum: 4, gold: 3, silver: 2, bronze: 1 };
        const tierDiff = (tierOrder[b.tier as keyof typeof tierOrder] || 0) - 
                        (tierOrder[a.tier as keyof typeof tierOrder] || 0);
        if (tierDiff !== 0) return tierDiff;
        return b.progress! - a.progress!;
      });

      setBadges(processedBadges);
    }

    // Note: This duplicate query appears to be redundant since recentRuns is already fetched above
    // Keeping it for now but it should be removed in a future refactor
  };

  const handleSaveProfile = async () => {
    if (!user) return;

    const { error } = await updateProfile({
      full_name: editedName,
      class_name: editedClassName,
    });

    if (error) {
      toast.error('Failed to update profile');
    } else {
      toast.success('Profile updated successfully!');
      setIsEditing(false);
    }
  };

  const getTierColor = (tier: string) => {
    switch (tier) {
      case 'bronze': return 'text-badge-bronze';
      case 'silver': return 'text-badge-silver';
      case 'gold': return 'text-gold';
      case 'platinum': return 'text-badge-platinum';
      default: return 'text-muted-foreground';
    }
  };

  const getTierBgColor = (tier: string) => {
    switch (tier) {
      case 'bronze': return 'bg-badge-bronze/10 border-badge-bronze/20';
      case 'silver': return 'bg-badge-silver/10 border-badge-silver/20';
      case 'gold': return 'bg-gold/10 border-gold/20';
      case 'platinum': return 'bg-badge-platinum/10 border-badge-platinum/20';
      default: return 'bg-secondary';
    }
  };

  const xpToNextLevel = profile ? (profile.level * 500) - (profile.xp_points % (profile.level * 500)) : 500;
  const levelProgress = profile ? ((profile.xp_points % (profile.level * 500)) / (profile.level * 500)) * 100 : 0;

  if (!user || !profile) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-8">
          <Card>
            <CardContent className="pt-6">
              <div className="text-center py-12">
                <User className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
                <p className="text-muted-foreground">Please sign in to view your profile</p>
                <Link to="/auth">
                  <Button variant="hero" className="mt-4">Sign In</Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8 animate-fade-in">
          <h1 className="text-3xl font-bold mb-2">My Profile</h1>
          <p className="text-muted-foreground">
            View your progress, achievements, and statistics
          </p>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Left Column - Profile Info */}
          <div className="lg:col-span-1 space-y-6">
            {/* Profile Card */}
            <Card variant="elevated" className="animate-fade-in">
              <CardHeader>
                <div className="flex items-center justify-between mb-4">
                  <div className="h-24 w-24 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-3xl font-bold shadow-lg">
                    {profile.full_name?.charAt(0).toUpperCase() || '?'}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      if (isEditing) {
                        setEditedName(profile.full_name || '');
                        setEditedClassName(profile.class_name || '');
                      }
                      setIsEditing(!isEditing);
                    }}
                  >
                    {isEditing ? <X className="h-4 w-4" /> : <Edit className="h-4 w-4" />}
                  </Button>
                </div>
                {isEditing ? (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">Full Name</Label>
                      <Input
                        id="name"
                        value={editedName}
                        onChange={(e) => setEditedName(e.target.value)}
                        placeholder="Enter your name"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="class">Class Name</Label>
                      <Input
                        id="class"
                        value={editedClassName}
                        onChange={(e) => setEditedClassName(e.target.value)}
                        placeholder="Enter class name"
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button onClick={handleSaveProfile} className="flex-1" variant="hero">
                        <Save className="h-4 w-4 mr-2" />
                        Save
                      </Button>
                      <Button
                        onClick={() => {
                          setIsEditing(false);
                          setEditedName(profile.full_name || '');
                          setEditedClassName(profile.class_name || '');
                        }}
                        variant="outline"
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <CardTitle className="text-2xl">{profile.full_name || 'Anonymous'}</CardTitle>
                    <CardDescription className="flex items-center gap-2">
                      <Mail className="h-4 w-4" />
                      {profile.email}
                    </CardDescription>
                    {profile.class_name && (
                      <div className="flex items-center gap-2 mt-2">
                        <GraduationCap className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">{profile.class_name}</span>
                      </div>
                    )}
                    <Badge variant="secondary" className="mt-2">
                      {profile.role.charAt(0).toUpperCase() + profile.role.slice(1)}
                    </Badge>
                  </>
                )}
              </CardHeader>
            </Card>

            {/* Level & XP Card */}
            <Card variant="interactive" className="animate-fade-in" style={{ animationDelay: '0.1s' }}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-gold" />
                  Level Progress
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-center">
                  <div className="text-4xl font-bold text-gold mb-1">Level {profile.level}</div>
                  <p className="text-sm text-muted-foreground">
                    {xpToNextLevel} XP to next level
                  </p>
                </div>
                <Progress value={levelProgress} className="h-3" />
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Current XP</span>
                  <span className="font-semibold text-gold">{profile.xp_points.toLocaleString()}</span>
                </div>
              </CardContent>
            </Card>

            {/* Quick Stats */}
            <Card className="animate-fade-in" style={{ animationDelay: '0.2s' }}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-primary" />
                  Quick Stats
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Experiments</span>
                  <span className="font-semibold">{stats.completedExperiments}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Accuracy</span>
                  <span className="font-semibold">{stats.averageAccuracy}%</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Badges</span>
                  <span className="font-semibold">{badges.filter(b => b.is_earned).length}</span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Badges & Activity */}
          <div className="lg:col-span-2 space-y-6">
            {/* Badges Section */}
            <Card className="animate-fade-in" style={{ animationDelay: '0.3s' }}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Award className="h-5 w-5 text-gold" />
                  Achievements
                </CardTitle>
                <CardDescription>
                  {badges.filter(b => b.is_earned).length} of {badges.length} badge{badges.length !== 1 ? 's' : ''} earned
                </CardDescription>
              </CardHeader>
              <CardContent>
                {badges.length > 0 ? (
                  <div className="space-y-4">
                    {/* Earned Badges */}
                    {badges.filter(b => b.is_earned).length > 0 && (
                      <div>
                        <h3 className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-2">
                          <Trophy className="h-4 w-4 text-gold" />
                          Earned ({badges.filter(b => b.is_earned).length})
                        </h3>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                          {badges.filter(b => b.is_earned).map((badge) => (
                            <div
                              key={badge.id}
                              className={`p-4 rounded-lg border-2 ${getTierBgColor(badge.tier)} transition-all hover:scale-105 cursor-pointer relative`}
                              title={badge.description}
                            >
                              <div className="text-center">
                                <span className={`text-4xl mb-2 block ${getTierColor(badge.tier)}`}>
                                  {badge.icon}
                                </span>
                                <p className="font-semibold text-sm mb-1">{badge.name}</p>
                                <Badge variant="outline" className="text-xs mb-2">
                                  {badge.tier}
                                </Badge>
                                {badge.earned_at && (
                                  <p className="text-xs text-muted-foreground">
                                    {new Date(badge.earned_at).toLocaleDateString()}
                                  </p>
                                )}
                              </div>
                              <div className="absolute top-2 right-2">
                                <div className="h-5 w-5 rounded-full bg-success flex items-center justify-center">
                                  <span className="text-white text-xs">✓</span>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Available Badges (Not Earned) */}
                    {badges.filter(b => !b.is_earned).length > 0 && (
                      <div>
                        <h3 className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-2">
                          <Target className="h-4 w-4 text-muted-foreground" />
                          Available ({badges.filter(b => !b.is_earned).length})
                        </h3>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                          {badges.filter(b => !b.is_earned).map((badge) => {
                            // Calculate progress text based on badge criteria
                            // Use allExperiments state to calculate subject-specific counts
                            const completedRuns = allExperiments.filter(e => e.status === 'completed');
                            
                            let progressText = 'In progress';
                            
                            if (badge.criteria.experiments_completed) {
                              if (badge.criteria.subject) {
                                // Subject-specific badges (e.g., Physics Scholar, Biology Scholar)
                                const subjectRuns = completedRuns.filter(e => 
                                  ((e.experiments as any)?.subject || '').toLowerCase() === badge.criteria.subject?.toLowerCase()
                                );
                                const subjectName = badge.criteria.subject.charAt(0).toUpperCase() + badge.criteria.subject.slice(1);
                                progressText = `${subjectRuns.length}/${badge.criteria.experiments_completed} ${subjectName} experiments`;
                              } else if (badge.criteria.experiment_type) {
                                // Experiment type-specific badges
                                const normalizeExperimentName = (name: string): string => {
                                  return name.toLowerCase()
                                    .replace(/[''"]/g, '')
                                    .replace(/\s+/g, ' ')
                                    .trim();
                                };
                                const expTypeNormalized = normalizeExperimentName(badge.criteria.experiment_type);
                                const typeRuns = completedRuns.filter(e => {
                                  const expName = normalizeExperimentName((e.experiments as any)?.name || '');
                                  return expName.includes(expTypeNormalized);
                                });
                                const count = badge.criteria.min_accuracy 
                                  ? typeRuns.filter(e => (e.score || 0) >= badge.criteria.min_accuracy!).length
                                  : typeRuns.length;
                                progressText = `${count}/${badge.criteria.experiments_completed} experiments`;
                              } else {
                                // General experiment count badges
                                progressText = `${stats.completedExperiments}/${badge.criteria.experiments_completed} experiments`;
                              }
                            } else if (badge.criteria.xp_threshold) {
                              progressText = `${profile?.xp_points || 0}/${badge.criteria.xp_threshold} XP`;
                            } else if (badge.criteria.accuracy_threshold) {
                              progressText = `${stats.averageAccuracy}% / ${badge.criteria.accuracy_threshold}% accuracy`;
                            }

                            return (
                              <div
                                key={badge.id}
                                className={`p-4 rounded-lg border ${getTierBgColor(badge.tier)} opacity-60 transition-all hover:opacity-80 cursor-pointer relative`}
                                title={`${badge.description}\nProgress: ${progressText}`}
                              >
                                <div className="text-center">
                                  <span className={`text-4xl mb-2 block ${getTierColor(badge.tier)}`}>
                                    {badge.icon}
                                  </span>
                                  <p className="font-semibold text-sm mb-1">{badge.name}</p>
                                  <Badge variant="outline" className="text-xs mb-2">
                                    {badge.tier}
                                  </Badge>
                                  {badge.progress !== undefined && badge.progress > 0 && (
                                    <div className="mt-2">
                                      <Progress value={badge.progress} className="h-1.5 mb-1" />
                                      <p className="text-xs text-muted-foreground">{badge.progress}%</p>
                                    </div>
                                  )}
                                  {badge.progress === 0 && (
                                    <p className="text-xs text-muted-foreground mt-2">Not started</p>
                                  )}
                                </div>
                                {badge.xp_requirement > 0 && (
                                  <div className="absolute top-2 right-2">
                                    <Badge variant="secondary" className="text-xs">
                                      {badge.xp_requirement} XP
                                    </Badge>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-12 text-muted-foreground">
                    <Trophy className="h-16 w-16 mx-auto mb-4 opacity-50" />
                    <p>Loading badges...</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Recent Activity */}
            <Card className="animate-fade-in" style={{ animationDelay: '0.4s' }}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FlaskConical className="h-5 w-5 text-primary" />
                  Recent Activity
                </CardTitle>
                <CardDescription>Your latest completed experiments</CardDescription>
              </CardHeader>
              <CardContent>
                {recentExperiments.length > 0 ? (
                  <div className="space-y-3">
                    {recentExperiments.map((exp) => (
                      <div
                        key={exp.id}
                        className="flex items-center justify-between p-4 rounded-lg bg-secondary/50 hover:bg-secondary transition-colors"
                      >
                        <div className="flex items-center gap-4">
                          <div className={`h-12 w-12 rounded-lg flex items-center justify-center ${
                            exp.status === 'completed' ? 'bg-success/10' : 'bg-warning/10'
                          }`}>
                            <FlaskConical className={`h-6 w-6 ${
                              exp.status === 'completed' ? 'text-success' : 'text-warning'
                            }`} />
                          </div>
                          <div>
                            <p className="font-medium">{exp.experiments?.name || 'Unknown Experiment'}</p>
                            <div className="flex items-center gap-3 text-sm text-muted-foreground">
                              <span>{exp.experiments?.subject}</span>
                              {exp.completed_at && (
                                <>
                                  <span>•</span>
                                  <span className="flex items-center gap-1">
                                    <Calendar className="h-3 w-3" />
                                    {new Date(exp.completed_at).toLocaleDateString()}
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          {exp.status === 'completed' ? (
                            <>
                              <p className="font-semibold text-success">{exp.score}%</p>
                              <p className="text-sm text-gold">+{exp.xp_earned} XP</p>
                            </>
                          ) : (
                            <Badge variant="outline">In Progress</Badge>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <FlaskConical className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>No experiments yet</p>
                    <p className="text-sm">Start your first experiment to see activity here</p>
                    <Link to="/experiments">
                      <Button variant="hero" className="mt-4">Browse Experiments</Button>
                    </Link>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </Layout>
  );
}

