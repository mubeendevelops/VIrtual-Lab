import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Layout } from '@/components/layout/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/integrations/supabase/client';
import { 
  FlaskConical, 
  Trophy, 
  Target, 
  Flame,
  Award,
  ArrowRight,
  Sparkles
} from 'lucide-react';

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

interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string;
  tier: string;
  earned_at: string;
}

export default function Dashboard() {
  const { profile } = useAuth();
  const [recentExperiments, setRecentExperiments] = useState<ExperimentRun[]>([]);
  const [badges, setBadges] = useState<Badge[]>([]);
  const [stats, setStats] = useState({
    totalExperiments: 0,
    completedExperiments: 0,
    averageAccuracy: 0,
    streak: 0,
  });

  useEffect(() => {
    if (profile) {
      fetchDashboardData();
    }
  }, [profile]);

  const fetchDashboardData = async () => {
    if (!profile) return;

    // Fetch ALL experiments for accurate stats
    const { data: allExperiments } = await supabase
      .from('experiment_runs')
      .select(`
        id,
        experiment_id,
        status,
        score,
        xp_earned,
        completed_at,
        created_at,
        experiments (name, subject)
      `)
      .eq('user_id', profile.id);

    // Fetch recent completed experiments (last 5) for display
    const { data: recentExperiments } = await supabase
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
      .eq('user_id', profile.id)
      .eq('status', 'completed')
      .order('completed_at', { ascending: false })
      .limit(5);

    if (recentExperiments) {
      setRecentExperiments(recentExperiments as unknown as ExperimentRun[]);
    }

    if (allExperiments) {
      // Calculate stats from ALL experiments
      const completed = allExperiments.filter(e => e.status === 'completed');
      const avgAccuracy = completed.length > 0
        ? completed.reduce((sum, e) => sum + (e.score || 0), 0) / completed.length
        : 0;
      
      setStats({
        totalExperiments: allExperiments.length,
        completedExperiments: completed.length,
        averageAccuracy: Math.round(avgAccuracy),
        streak: calculateStreak(allExperiments),
      });
    }

    // Fetch badges (only earned ones for dashboard)
    const { data: userBadges } = await supabase
      .from('user_badges')
      .select(`
        earned_at,
        badges (id, name, description, icon, tier, xp_requirement, criteria)
      `)
      .eq('user_id', profile.id)
      .order('earned_at', { ascending: false });

    if (userBadges) {
      setBadges(userBadges.map(ub => ({
        ...ub.badges as any,
        earned_at: ub.earned_at,
      })));
    }
  };

  const calculateStreak = (experiments: any[]) => {
    // Get unique dates when experiments were completed (normalized to date strings)
    const completedDates = new Set<string>();
    experiments
      .filter(e => e.status === 'completed' && e.completed_at)
      .forEach(e => {
        const date = new Date(e.completed_at);
        // Normalize to date string (YYYY-MM-DD) in local timezone
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const dateStr = `${year}-${month}-${day}`;
        completedDates.add(dateStr);
      });

    if (completedDates.size === 0) return 0;

    // Get today's date string
    const today = new Date();
    const todayYear = today.getFullYear();
    const todayMonth = String(today.getMonth() + 1).padStart(2, '0');
    const todayDay = String(today.getDate()).padStart(2, '0');
    const todayStr = `${todayYear}-${todayMonth}-${todayDay}`;

    // Determine the starting date for streak calculation
    // If there's an experiment today, start from today
    // Otherwise, if there's one yesterday, start from yesterday
    // Otherwise, streak is 0
    let currentDate = new Date(today);
    currentDate.setHours(0, 0, 0, 0);
    
    if (!completedDates.has(todayStr)) {
      // No experiment today, check yesterday
      currentDate.setDate(currentDate.getDate() - 1);
      const yesterdayYear = currentDate.getFullYear();
      const yesterdayMonth = String(currentDate.getMonth() + 1).padStart(2, '0');
      const yesterdayDay = String(currentDate.getDate()).padStart(2, '0');
      const yesterdayStr = `${yesterdayYear}-${yesterdayMonth}-${yesterdayDay}`;
      
      if (!completedDates.has(yesterdayStr)) {
        // No experiment today or yesterday, streak is broken
        return 0;
      }
    }

    // Count consecutive days going backwards
    let streak = 0;
    while (true) {
      const year = currentDate.getFullYear();
      const month = String(currentDate.getMonth() + 1).padStart(2, '0');
      const day = String(currentDate.getDate()).padStart(2, '0');
      const dateStr = `${year}-${month}-${day}`;
      
      if (completedDates.has(dateStr)) {
        streak++;
        // Move to previous day
        currentDate.setDate(currentDate.getDate() - 1);
      } else {
        // Found a gap, streak is broken
        break;
      }
    }

    return streak;
  };

  const xpToNextLevel = profile ? (profile.level * 500) - (profile.xp_points % (profile.level * 500)) : 500;
  const levelProgress = profile ? ((profile.xp_points % (profile.level * 500)) / (profile.level * 500)) * 100 : 0;

  const getTierColor = (tier: string) => {
    switch (tier) {
      case 'bronze': return 'text-badge-bronze';
      case 'silver': return 'text-badge-silver';
      case 'gold': return 'text-gold';
      case 'platinum': return 'text-badge-platinum';
      default: return 'text-muted-foreground';
    }
  };

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8">
        {/* Welcome Section */}
        <div className="mb-8 animate-fade-in">
          <h1 className="text-3xl font-bold mb-2">
            Welcome back, {profile?.full_name?.split(' ')[0] || 'Scientist'}! 👋
          </h1>
          <p className="text-muted-foreground">
            Ready to continue your scientific journey?
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <Card variant="interactive" className="animate-fade-in" style={{ animationDelay: '0.1s' }}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total XP</p>
                  <p className="text-3xl font-bold text-gold">{profile?.xp_points || 0}</p>
                </div>
                <div className="h-12 w-12 rounded-xl bg-gold/10 flex items-center justify-center">
                  <Sparkles className="h-6 w-6 text-gold" />
                </div>
              </div>
              <div className="mt-4">
                <div className="flex justify-between text-sm mb-1">
                  <span>Level {profile?.level || 1}</span>
                  <span>{xpToNextLevel} XP to next</span>
                </div>
                <Progress value={levelProgress} className="h-2" />
              </div>
            </CardContent>
          </Card>

          <Card variant="interactive" className="animate-fade-in" style={{ animationDelay: '0.2s' }}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Experiments</p>
                  <p className="text-3xl font-bold">{stats.completedExperiments}</p>
                </div>
                <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
                  <FlaskConical className="h-6 w-6 text-primary" />
                </div>
              </div>
              <p className="text-sm text-muted-foreground mt-2">
                {stats.totalExperiments} total attempts
              </p>
            </CardContent>
          </Card>

          <Card variant="interactive" className="animate-fade-in" style={{ animationDelay: '0.3s' }}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Accuracy</p>
                  <p className="text-3xl font-bold">{stats.averageAccuracy}%</p>
                </div>
                <div className="h-12 w-12 rounded-xl bg-success/10 flex items-center justify-center">
                  <Target className="h-6 w-6 text-success" />
                </div>
              </div>
              <p className="text-sm text-muted-foreground mt-2">
                Average score
              </p>
            </CardContent>
          </Card>

          <Card variant="interactive" className="animate-fade-in" style={{ animationDelay: '0.4s' }}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Streak</p>
                  <p className="text-3xl font-bold">{stats.streak}</p>
                </div>
                <div className="h-12 w-12 rounded-xl bg-destructive/10 flex items-center justify-center">
                  <Flame className="h-6 w-6 text-destructive" />
                </div>
              </div>
              <p className="text-sm text-muted-foreground mt-2">
                Days in a row
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Quick Actions */}
          <div className="lg:col-span-2 space-y-6">
            <Card variant="elevated" className="animate-fade-in" style={{ animationDelay: '0.5s' }}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FlaskConical className="h-5 w-5 text-primary" />
                  Start Experimenting
                </CardTitle>
                <CardDescription>
                  Jump into an interactive virtual lab experiment
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Link to="/experiments">
                  <Button variant="hero" size="lg" className="w-full sm:w-auto gap-2">
                    Browse Experiments
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
              </CardContent>
            </Card>

            {/* Recent Activity */}
            <Card className="animate-fade-in" style={{ animationDelay: '0.6s' }}>
              <CardHeader>
                <CardTitle>Recent Activity</CardTitle>
                <CardDescription>Your latest completed experiments</CardDescription>
              </CardHeader>
              <CardContent>
                {recentExperiments.length > 0 ? (
                  <div className="space-y-3">
                    {recentExperiments.map((exp) => (
                      <div 
                        key={exp.id}
                        className="flex items-center justify-between p-3 rounded-lg bg-secondary/50 hover:bg-secondary transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${
                            exp.status === 'completed' ? 'bg-success/10' : 'bg-warning/10'
                          }`}>
                            <FlaskConical className={`h-5 w-5 ${
                              exp.status === 'completed' ? 'text-success' : 'text-warning'
                            }`} />
                          </div>
                          <div>
                            <p className="font-medium">{exp.experiments?.name || 'Unknown Experiment'}</p>
                            <p className="text-sm text-muted-foreground">
                              {exp.status === 'completed' ? `Score: ${exp.score}%` : 'In Progress'}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-medium text-gold">+{exp.xp_earned} XP</p>
                          <p className="text-xs text-muted-foreground">
                            {exp.completed_at 
                              ? new Date(exp.completed_at).toLocaleDateString()
                              : 'Ongoing'}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <FlaskConical className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>No experiments yet</p>
                    <p className="text-sm">Start your first experiment to see activity here</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Badges Sidebar */}
          <div className="space-y-6">
            <Card className="animate-fade-in" style={{ animationDelay: '0.7s' }}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Award className="h-5 w-5 text-gold" />
                  Your Badges
                </CardTitle>
                <CardDescription>
                  {badges.length} badges earned
                </CardDescription>
              </CardHeader>
              <CardContent>
                {badges.length > 0 ? (
                  <div className="grid grid-cols-3 gap-3">
                    {badges.slice(0, 6).map((badge) => (
                      <div 
                        key={badge.id}
                        className="flex flex-col items-center p-3 rounded-lg bg-secondary/50 hover:bg-secondary transition-colors text-center"
                        title={badge.description}
                      >
                        <span className={`text-2xl mb-1 ${getTierColor(badge.tier)}`}>
                          {badge.icon}
                        </span>
                        <span className="text-xs font-medium truncate w-full">
                          {badge.name}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-6 text-muted-foreground">
                    <Trophy className="h-10 w-10 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">Complete experiments to earn badges!</p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card variant="gradient" className="animate-fade-in" style={{ animationDelay: '0.8s' }}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Trophy className="h-5 w-5" />
                  Leaderboard
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Link to="/leaderboard">
                  <Button variant="secondary" className="w-full gap-2">
                    View Rankings
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </Layout>
  );
}
