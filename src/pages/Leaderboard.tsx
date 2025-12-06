import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Layout } from '@/components/layout/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { 
  Trophy, 
  Medal, 
  Award,
  Crown,
  Sparkles,
  TrendingUp,
  Users,
  Flame
} from 'lucide-react';

interface LeaderboardEntry {
  id: string;
  full_name: string | null;
  email: string | null;
  xp_points: number;
  level: number;
  role: string;
  rank: number;
}

export default function Leaderboard() {
  const { user, profile } = useAuth();
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeframe, setTimeframe] = useState<'all' | 'week' | 'month'>('all');
  const [userRank, setUserRank] = useState<number | null>(null);

  useEffect(() => {
    fetchLeaderboard();
  }, [timeframe]);

  // Find current user's rank - handle case where user might not be in top 100
  const currentUserEntry = leaderboard.find(entry => entry.id === user?.id);
  const currentUserRank = currentUserEntry ? currentUserEntry.rank : 0;
  
  useEffect(() => {
    if (user && profile && !currentUserEntry) {
      // Fetch user's rank if they're not in top 100
      fetchUserRank();
    }
  }, [user, profile, currentUserEntry]);

  const fetchUserRank = async () => {
    if (!user || !profile) return;
    
    try {
      // Count how many students have more XP than current user
      const { count, error } = await supabase
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .eq('role', 'student')
        .gt('xp_points', profile.xp_points || 0);
      
      if (!error && count !== null) {
        setUserRank(count + 1); // Rank is count + 1
      }
    } catch (error) {
      console.error('Error fetching user rank:', error);
    }
  };

  // Use fetched rank if user is not in top 100, otherwise use rank from leaderboard
  const displayUserRank = currentUserRank || userRank || 0;

  const fetchLeaderboard = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('profiles')
        .select('id, full_name, email, xp_points, level, role')
        .eq('role', 'student') // Only show students on leaderboard
        .order('xp_points', { ascending: false })
        .limit(100);

      // Apply timeframe filter if needed (for future implementation)
      if (timeframe === 'week') {
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        // Note: This would require joining with experiment_runs for timeframe filtering
        // For now, we'll show all-time leaderboard
      } else if (timeframe === 'month') {
        const monthAgo = new Date();
        monthAgo.setMonth(monthAgo.getMonth() - 1);
        // Note: This would require joining with experiment_runs for timeframe filtering
        // For now, we'll show all-time leaderboard
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching leaderboard:', error);
        toast.error('Failed to load leaderboard. Please try again.');
      } else if (data) {
        // Filter out null/undefined entries and ensure we have valid data
        const validEntries = data.filter(entry => 
          entry && entry.id && typeof entry.xp_points === 'number'
        );
        
        // Add rank to each entry (handling ties by XP)
        let currentRank = 1;
        let previousXP = -1;
        const ranked = validEntries.map((entry, index) => {
          // If XP is different from previous, update rank
          if (entry.xp_points !== previousXP) {
            currentRank = index + 1;
            previousXP = entry.xp_points;
          }
          return {
            ...entry,
            rank: currentRank,
          };
        });
        
        setLeaderboard(ranked);
      } else {
        setLeaderboard([]);
      }
    } catch (error) {
      console.error('Error:', error);
      toast.error('An error occurred while loading the leaderboard.');
    } finally {
      setLoading(false);
    }
  };

  const getRankIcon = (rank: number) => {
    if (rank === 1) return <Crown className="h-6 w-6 text-gold" />;
    if (rank === 2) return <Medal className="h-6 w-6 text-badge-silver" />;
    if (rank === 3) return <Medal className="h-6 w-6 text-badge-bronze" />;
    return <span className="text-lg font-bold text-muted-foreground">#{rank}</span>;
  };

  const getRankBadgeColor = (rank: number) => {
    if (rank === 1) return 'bg-gradient-to-r from-gold to-warning text-primary-foreground';
    if (rank === 2) return 'bg-badge-silver/20 text-badge-silver border-badge-silver/30';
    if (rank === 3) return 'bg-badge-bronze/20 text-badge-bronze border-badge-bronze/30';
    return 'bg-secondary text-secondary-foreground';
  };

  const topThree = leaderboard.slice(0, 3);
  const restOfLeaderboard = leaderboard.slice(3);

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8 animate-fade-in">
          <div className="flex items-center gap-3 mb-4">
            <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-gold to-warning flex items-center justify-center shadow-lg">
              <Trophy className="h-6 w-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-3xl md:text-4xl font-bold">Leaderboard</h1>
              <p className="text-muted-foreground">
                Top performers ranked by XP points
              </p>
            </div>
          </div>

          {/* Timeframe Filter */}
          <div className="flex gap-2 mt-4">
            <Badge
              variant={timeframe === 'all' ? 'default' : 'outline'}
              className="cursor-pointer hover:bg-secondary/80"
              onClick={() => setTimeframe('all')}
            >
              All Time
            </Badge>
            <Badge
              variant={timeframe === 'week' ? 'default' : 'outline'}
              className="cursor-pointer hover:bg-secondary/80"
              onClick={() => setTimeframe('week')}
            >
              This Week
            </Badge>
            <Badge
              variant={timeframe === 'month' ? 'default' : 'outline'}
              className="cursor-pointer hover:bg-secondary/80"
              onClick={() => setTimeframe('month')}
            >
              This Month
            </Badge>
          </div>
        </div>

        {/* Top 3 Podium */}
        {topThree.length > 0 && (
          <div className="grid md:grid-cols-3 gap-4 mb-8 animate-fade-in" style={{ animationDelay: '0.1s' }}>
            {/* 2nd Place */}
            {topThree[1] && (
              <Card variant="interactive" className="order-2 md:order-1 animate-fade-in" style={{ animationDelay: '0.2s' }}>
                <CardHeader className="text-center pb-2">
                  <div className="flex justify-center mb-2">
                    <Medal className="h-8 w-8 text-badge-silver" />
                  </div>
                  <CardTitle className="text-xl">2nd Place</CardTitle>
                </CardHeader>
                <CardContent className="text-center space-y-2">
                  <div className="h-16 w-16 rounded-full bg-gradient-to-br from-badge-silver to-muted mx-auto flex items-center justify-center text-2xl font-bold mb-2">
                    {topThree[1].full_name?.charAt(0).toUpperCase() || '?'}
                  </div>
                  <p className="font-semibold">{topThree[1].full_name || 'Anonymous'}</p>
                  <div className="flex items-center justify-center gap-2 text-gold">
                    <Sparkles className="h-4 w-4" />
                    <span className="font-bold">{topThree[1].xp_points.toLocaleString()} XP</span>
                  </div>
                  <Badge variant="secondary">Level {topThree[1].level}</Badge>
                </CardContent>
              </Card>
            )}

            {/* 1st Place */}
            {topThree[0] && (
              <Card variant="gradient" className="order-1 md:order-2 border-2 border-gold/50 animate-fade-in" style={{ animationDelay: '0.1s' }}>
                <CardHeader className="text-center pb-2">
                  <div className="flex justify-center mb-2">
                    <Crown className="h-10 w-10 text-gold" />
                  </div>
                  <CardTitle className="text-2xl">Champion</CardTitle>
                </CardHeader>
                <CardContent className="text-center space-y-2">
                  <div className="h-20 w-20 rounded-full bg-gradient-to-br from-gold to-warning mx-auto flex items-center justify-center text-3xl font-bold mb-2 shadow-lg">
                    {topThree[0].full_name?.charAt(0).toUpperCase() || '?'}
                  </div>
                  <p className="font-bold text-lg">{topThree[0].full_name || 'Anonymous'}</p>
                  <div className="flex items-center justify-center gap-2 text-gold">
                    <Sparkles className="h-5 w-5" />
                    <span className="font-bold text-xl">{topThree[0].xp_points.toLocaleString()} XP</span>
                  </div>
                  <Badge className="bg-gold/20 text-gold border-gold/30">Level {topThree[0].level}</Badge>
                </CardContent>
              </Card>
            )}

            {/* 3rd Place */}
            {topThree[2] && (
              <Card variant="interactive" className="order-3 animate-fade-in" style={{ animationDelay: '0.3s' }}>
                <CardHeader className="text-center pb-2">
                  <div className="flex justify-center mb-2">
                    <Medal className="h-8 w-8 text-badge-bronze" />
                  </div>
                  <CardTitle className="text-xl">3rd Place</CardTitle>
                </CardHeader>
                <CardContent className="text-center space-y-2">
                  <div className="h-16 w-16 rounded-full bg-gradient-to-br from-badge-bronze to-muted mx-auto flex items-center justify-center text-2xl font-bold mb-2">
                    {topThree[2].full_name?.charAt(0).toUpperCase() || '?'}
                  </div>
                  <p className="font-semibold">{topThree[2].full_name || 'Anonymous'}</p>
                  <div className="flex items-center justify-center gap-2 text-gold">
                    <Sparkles className="h-4 w-4" />
                    <span className="font-bold">{topThree[2].xp_points.toLocaleString()} XP</span>
                  </div>
                  <Badge variant="secondary">Level {topThree[2].level}</Badge>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Rest of Leaderboard */}
        <Card className="animate-fade-in" style={{ animationDelay: '0.4s' }}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              Rankings
            </CardTitle>
            <CardDescription>
              {loading ? 'Loading...' : `${leaderboard.length} students ranked`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="h-16 bg-secondary/50 rounded-lg animate-pulse" />
                ))}
              </div>
            ) : restOfLeaderboard.length > 0 ? (
              <div className="space-y-2">
                {restOfLeaderboard.map((entry, index) => {
                  const rank = index + 4;
                  const isCurrentUser = entry.id === user?.id;
                  
                  return (
                    <div
                      key={entry.id}
                      className={`flex items-center gap-4 p-4 rounded-lg transition-all ${
                        isCurrentUser
                          ? 'bg-primary/10 border-2 border-primary/30'
                          : 'bg-secondary/50 hover:bg-secondary'
                      }`}
                    >
                      <div className="flex items-center justify-center w-12">
                        {getRankIcon(rank)}
                      </div>
                      <div className="h-12 w-12 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-lg font-bold flex-shrink-0">
                        {entry.full_name?.charAt(0).toUpperCase() || '?'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-semibold truncate">
                            {entry.full_name || 'Anonymous'}
                            {isCurrentUser && (
                              <Badge variant="outline" className="ml-2 text-xs">You</Badge>
                            )}
                          </p>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Sparkles className="h-3 w-3 text-gold" />
                            {entry.xp_points.toLocaleString()} XP
                          </span>
                          <span>Level {entry.level}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className={getRankBadgeColor(rank)}>
                          Rank #{rank}
                        </Badge>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <Trophy className="h-16 w-16 mx-auto mb-4 opacity-50" />
                <p>No rankings available yet</p>
                <p className="text-sm">Complete experiments to earn XP and climb the leaderboard!</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Current User Rank Card */}
        {user && profile && displayUserRank > 0 && displayUserRank > 3 && (
          <Card variant="gradient" className="mt-6 animate-fade-in" style={{ animationDelay: '0.5s' }}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="h-16 w-16 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-2xl font-bold">
                    {profile.full_name?.charAt(0).toUpperCase() || '?'}
                  </div>
                  <div>
                    <p className="font-semibold text-lg">Your Rank</p>
                    <p className="text-muted-foreground">
                      {profile.full_name || 'You'} are ranked #{displayUserRank}
                      {displayUserRank > 100 && ' (outside top 100)'}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="flex items-center gap-2 text-gold mb-1">
                    <Sparkles className="h-5 w-5" />
                    <span className="text-2xl font-bold">{profile.xp_points.toLocaleString()}</span>
                  </div>
                  <p className="text-sm text-muted-foreground">XP Points</p>
                  <p className="text-xs text-muted-foreground mt-1">Level {profile.level}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Show user rank even if in top 3 but not highlighted in list */}
        {user && profile && displayUserRank > 0 && displayUserRank <= 3 && !currentUserEntry && (
          <Card variant="gradient" className="mt-6 animate-fade-in" style={{ animationDelay: '0.5s' }}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="h-16 w-16 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-2xl font-bold">
                    {profile.full_name?.charAt(0).toUpperCase() || '?'}
                  </div>
                  <div>
                    <p className="font-semibold text-lg">Your Rank</p>
                    <p className="text-muted-foreground">
                      {profile.full_name || 'You'} are ranked #{displayUserRank}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="flex items-center gap-2 text-gold mb-1">
                    <Sparkles className="h-5 w-5" />
                    <span className="text-2xl font-bold">{profile.xp_points.toLocaleString()}</span>
                  </div>
                  <p className="text-sm text-muted-foreground">XP Points</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </Layout>
  );
}

