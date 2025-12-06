import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Layout } from '@/components/layout/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import {
  Users,
  FlaskConical,
  TrendingUp,
  Award,
  Target,
  Search,
  GraduationCap,
  Calendar,
  BarChart3,
  User,
  ArrowRight,
  CheckCircle2,
  Clock,
  XCircle,
  Sparkles
} from 'lucide-react';
import { toast } from 'sonner';

interface Student {
  id: string;
  email: string | null;
  full_name: string | null;
  class_name: string | null;
  xp_points: number;
  level: number;
  role: string;
}

interface StudentStats {
  student: Student;
  totalExperiments: number;
  completedExperiments: number;
  averageScore: number;
  totalXP: number;
  badgesEarned: number;
  recentActivity: ExperimentRun[];
}

interface ExperimentRun {
  id: string;
  experiment_id: string;
  status: string;
  score: number | null;
  xp_earned: number;
  completed_at: string | null;
  started_at: string;
  experiments: {
    name: string;
    subject: string;
  };
}

interface ExperimentStats {
  id: string;
  name: string;
  subject: string;
  totalAttempts: number;
  completedAttempts: number;
  averageScore: number;
  completionRate: number;
}

export default function TeacherPanel() {
  const { profile, user } = useAuth();
  const navigate = useNavigate();
  const [students, setStudents] = useState<Student[]>([]);
  const [filteredStudents, setFilteredStudents] = useState<Student[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<StudentStats | null>(null);
  const [experimentStats, setExperimentStats] = useState<ExperimentStats[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClass, setSelectedClass] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [overviewStats, setOverviewStats] = useState({
    totalStudents: 0,
    totalExperiments: 0,
    averageCompletionRate: 0,
    totalXP: 0,
  });

  useEffect(() => {
    if (!profile) return;
    
    // Check if user is teacher or admin
    if (profile.role !== 'teacher' && profile.role !== 'admin') {
      toast.error('Access denied. Teacher access required.');
      navigate('/dashboard');
      return;
    }

    fetchTeacherData();
  }, [profile, navigate, user]);

  useEffect(() => {
    filterStudents();
  }, [searchQuery, selectedClass, students]);

  const fetchTeacherData = async () => {
    if (!user) return;
    setLoading(true);

    try {
      // Fetch all students
      const { data: allProfiles, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .eq('role', 'student')
        .order('full_name', { ascending: true });

      if (profilesError) throw profilesError;

      const studentProfiles = (allProfiles || []) as Student[];
      setStudents(studentProfiles);
      setFilteredStudents(studentProfiles);

      // Fetch experiment statistics
      const { data: experiments } = await supabase
        .from('experiments')
        .select('id, name, subject')
        .eq('is_active', true);

      if (experiments) {
        const statsPromises = experiments.map(async (exp) => {
          const { data: runs } = await supabase
            .from('experiment_runs')
            .select('status, score')
            .eq('experiment_id', exp.id);

          const completed = runs?.filter(r => r.status === 'completed') || [];
          const totalAttempts = runs?.length || 0;
          const completedAttempts = completed.length;
          const avgScore = completed.length > 0
            ? completed.reduce((sum, r) => sum + (r.score || 0), 0) / completed.length
            : 0;
          const completionRate = totalAttempts > 0 ? (completedAttempts / totalAttempts) * 100 : 0;

          return {
            id: exp.id,
            name: exp.name,
            subject: exp.subject,
            totalAttempts,
            completedAttempts,
            averageScore: Math.round(avgScore),
            completionRate: Math.round(completionRate),
          };
        });

        const stats = await Promise.all(statsPromises);
        setExperimentStats(stats);
      }

      // Calculate overview statistics
      if (studentProfiles.length > 0) {
        const studentIds = studentProfiles.map(s => s.id);
        const { data: allRuns } = await supabase
          .from('experiment_runs')
          .select('status, score, xp_earned')
          .in('user_id', studentIds);

        const totalRuns = allRuns?.length || 0;
        const completedRuns = allRuns?.filter(r => r.status === 'completed').length || 0;
        const totalXP = allRuns?.reduce((sum, r) => sum + (r.xp_earned || 0), 0) || 0;
        const completionRate = totalRuns > 0 ? (completedRuns / totalRuns) * 100 : 0;

        setOverviewStats({
          totalStudents: studentProfiles.length,
          totalExperiments: totalRuns,
          averageCompletionRate: Math.round(completionRate),
          totalXP,
        });
      }
    } catch (error) {
      console.error('Error fetching teacher data:', error);
      toast.error('Failed to load teacher data');
    } finally {
      setLoading(false);
    }
  };

  const filterStudents = () => {
    let filtered = [...students];

    // Filter by class
    if (selectedClass !== 'all') {
      filtered = filtered.filter(s => s.class_name === selectedClass);
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(s =>
        s.full_name?.toLowerCase().includes(query) ||
        s.email?.toLowerCase().includes(query) ||
        s.class_name?.toLowerCase().includes(query)
      );
    }

    setFilteredStudents(filtered);
  };

  const fetchStudentDetails = async (student: Student) => {
    try {
      const { data: runs } = await supabase
        .from('experiment_runs')
        .select(`
          id,
          experiment_id,
          status,
          score,
          xp_earned,
          completed_at,
          started_at,
          experiments (name, subject)
        `)
        .eq('user_id', student.id)
        .order('completed_at', { ascending: false })
        .limit(10);

      const { data: badges } = await supabase
        .from('user_badges')
        .select('id')
        .eq('user_id', student.id);

      const completed = runs?.filter(r => r.status === 'completed') || [];
      const avgScore = completed.length > 0
        ? completed.reduce((sum, r) => sum + (r.score || 0), 0) / completed.length
        : 0;

      setSelectedStudent({
        student,
        totalExperiments: runs?.length || 0,
        completedExperiments: completed.length,
        averageScore: Math.round(avgScore),
        totalXP: student.xp_points,
        badgesEarned: badges?.length || 0,
        recentActivity: (runs || []) as ExperimentRun[],
      });
    } catch (error) {
      console.error('Error fetching student details:', error);
      toast.error('Failed to load student details');
    }
  };

  const getClassNames = () => {
    const classes = new Set(students.map(s => s.class_name).filter(Boolean));
    return Array.from(classes).sort();
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge variant="outline" className="bg-success/10 text-success border-success/20"><CheckCircle2 className="h-3 w-3 mr-1" />Completed</Badge>;
      case 'in_progress':
        return <Badge variant="outline" className="bg-warning/10 text-warning border-warning/20"><Clock className="h-3 w-3 mr-1" />In Progress</Badge>;
      default:
        return <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20"><XCircle className="h-3 w-3 mr-1" />Abandoned</Badge>;
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-8">
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading teacher panel...</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8 animate-fade-in">
          <h1 className="text-3xl font-bold mb-2">Teacher Panel</h1>
          <p className="text-muted-foreground">
            Monitor student progress and manage assessments
          </p>
        </div>

        {/* Overview Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <Card variant="interactive" className="animate-fade-in" style={{ animationDelay: '0.1s' }}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Students</p>
                  <p className="text-3xl font-bold">{overviewStats.totalStudents}</p>
                </div>
                <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Users className="h-6 w-6 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card variant="interactive" className="animate-fade-in" style={{ animationDelay: '0.2s' }}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Attempts</p>
                  <p className="text-3xl font-bold">{overviewStats.totalExperiments}</p>
                </div>
                <div className="h-12 w-12 rounded-xl bg-success/10 flex items-center justify-center">
                  <FlaskConical className="h-6 w-6 text-success" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card variant="interactive" className="animate-fade-in" style={{ animationDelay: '0.3s' }}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Completion Rate</p>
                  <p className="text-3xl font-bold">{overviewStats.averageCompletionRate}%</p>
                </div>
                <div className="h-12 w-12 rounded-xl bg-warning/10 flex items-center justify-center">
                  <Target className="h-6 w-6 text-warning" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card variant="interactive" className="animate-fade-in" style={{ animationDelay: '0.4s' }}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total XP Earned</p>
                  <p className="text-3xl font-bold text-gold">{overviewStats.totalXP.toLocaleString()}</p>
                </div>
                <div className="h-12 w-12 rounded-xl bg-gold/10 flex items-center justify-center">
                  <Sparkles className="h-6 w-6 text-gold" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="students" className="space-y-6">
          <TabsList>
            <TabsTrigger value="students">Students</TabsTrigger>
            <TabsTrigger value="experiments">Experiments</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
          </TabsList>

          {/* Students Tab */}
          <TabsContent value="students" className="space-y-6">
            <Card className="animate-fade-in" style={{ animationDelay: '0.5s' }}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-primary" />
                  Student Overview
                </CardTitle>
                <CardDescription>
                  View and manage student progress
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Filters */}
                <div className="flex flex-col sm:flex-row gap-4">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search students by name, email, or class..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  <select
                    value={selectedClass}
                    onChange={(e) => setSelectedClass(e.target.value)}
                    className="px-3 py-2 rounded-md border border-input bg-background text-sm"
                  >
                    <option value="all">All Classes</option>
                    {getClassNames().map(className => (
                      <option key={className} value={className}>{className}</option>
                    ))}
                  </select>
                </div>

                {/* Student List */}
                {filteredStudents.length > 0 ? (
                  <div className="space-y-3">
                    {filteredStudents.map((student) => (
                      <div
                        key={student.id}
                        className="flex items-center justify-between p-4 rounded-lg bg-secondary/50 hover:bg-secondary transition-colors cursor-pointer"
                        onClick={() => fetchStudentDetails(student)}
                      >
                        <div className="flex items-center gap-4">
                          <div className="h-12 w-12 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-lg font-bold">
                            {student.full_name?.charAt(0).toUpperCase() || '?'}
                          </div>
                          <div>
                            <p className="font-medium">{student.full_name || 'Anonymous'}</p>
                            <div className="flex items-center gap-3 text-sm text-muted-foreground">
                              <span>{student.email}</span>
                              {student.class_name && (
                                <>
                                  <span>•</span>
                                  <span className="flex items-center gap-1">
                                    <GraduationCap className="h-3 w-3" />
                                    {student.class_name}
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-6">
                          <div className="text-right">
                            <p className="text-sm text-muted-foreground">Level</p>
                            <p className="font-semibold">{student.level}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm text-muted-foreground">XP</p>
                            <p className="font-semibold text-gold">{student.xp_points.toLocaleString()}</p>
                          </div>
                          <ArrowRight className="h-5 w-5 text-muted-foreground" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Users className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>No students found</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Student Details Modal */}
            {selectedStudent && (
              <Card className="animate-fade-in">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <User className="h-5 w-5 text-primary" />
                        {selectedStudent.student.full_name || 'Anonymous'}
                      </CardTitle>
                      <CardDescription>{selectedStudent.student.email}</CardDescription>
                    </div>
                    <Button variant="ghost" onClick={() => setSelectedStudent(null)}>Close</Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Student Stats */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="p-4 rounded-lg bg-secondary/50">
                      <p className="text-sm text-muted-foreground">Experiments</p>
                      <p className="text-2xl font-bold">{selectedStudent.completedExperiments}/{selectedStudent.totalExperiments}</p>
                    </div>
                    <div className="p-4 rounded-lg bg-secondary/50">
                      <p className="text-sm text-muted-foreground">Average Score</p>
                      <p className="text-2xl font-bold">{selectedStudent.averageScore}%</p>
                    </div>
                    <div className="p-4 rounded-lg bg-secondary/50">
                      <p className="text-sm text-muted-foreground">Badges</p>
                      <p className="text-2xl font-bold">{selectedStudent.badgesEarned}</p>
                    </div>
                    <div className="p-4 rounded-lg bg-secondary/50">
                      <p className="text-sm text-muted-foreground">Total XP</p>
                      <p className="text-2xl font-bold text-gold">{selectedStudent.totalXP.toLocaleString()}</p>
                    </div>
                  </div>

                  {/* Recent Activity */}
                  <div>
                    <h3 className="font-semibold mb-3">Recent Activity</h3>
                    {selectedStudent.recentActivity.length > 0 ? (
                      <div className="space-y-2">
                        {selectedStudent.recentActivity.map((run) => (
                          <div
                            key={run.id}
                            className="flex items-center justify-between p-3 rounded-lg bg-secondary/50"
                          >
                            <div className="flex items-center gap-3">
                              <FlaskConical className="h-5 w-5 text-primary" />
                              <div>
                                <p className="font-medium">{run.experiments?.name || 'Unknown'}</p>
                                <p className="text-sm text-muted-foreground">{run.experiments?.subject}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-4">
                              {getStatusBadge(run.status)}
                              {run.status === 'completed' && run.score !== null && (
                                <span className="font-semibold">{run.score}%</span>
                              )}
                              {run.completed_at && (
                                <span className="text-sm text-muted-foreground">
                                  {new Date(run.completed_at).toLocaleDateString()}
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">No recent activity</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Experiments Tab */}
          <TabsContent value="experiments" className="space-y-6">
            <Card className="animate-fade-in" style={{ animationDelay: '0.6s' }}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FlaskConical className="h-5 w-5 text-primary" />
                  Experiment Performance
                </CardTitle>
                <CardDescription>
                  Track completion rates and average scores by experiment
                </CardDescription>
              </CardHeader>
              <CardContent>
                {experimentStats.length > 0 ? (
                  <div className="space-y-4">
                    {experimentStats.map((stat) => (
                      <div
                        key={stat.id}
                        className="p-4 rounded-lg bg-secondary/50 hover:bg-secondary transition-colors"
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <h3 className="font-semibold">{stat.name}</h3>
                            <p className="text-sm text-muted-foreground">{stat.subject}</p>
                          </div>
                          <Badge variant="outline">{stat.completionRate}% Complete</Badge>
                        </div>
                        <div className="space-y-2">
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Completion Rate</span>
                            <span className="font-medium">{stat.completedAttempts}/{stat.totalAttempts} attempts</span>
                          </div>
                          <Progress value={stat.completionRate} className="h-2" />
                          {stat.completedAttempts > 0 && (
                            <div className="flex justify-between text-sm mt-2">
                              <span className="text-muted-foreground">Average Score</span>
                              <span className="font-semibold">{stat.averageScore}%</span>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <FlaskConical className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>No experiment data available</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Analytics Tab */}
          <TabsContent value="analytics" className="space-y-6">
            <div className="grid md:grid-cols-2 gap-6">
              <Card className="animate-fade-in" style={{ animationDelay: '0.7s' }}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5 text-primary" />
                    Class Distribution
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {getClassNames().length > 0 ? (
                    <div className="space-y-3">
                      {getClassNames().map(className => {
                        const classStudents = students.filter(s => s.class_name === className);
                        const percentage = (classStudents.length / students.length) * 100;
                        return (
                          <div key={className}>
                            <div className="flex justify-between text-sm mb-1">
                              <span className="font-medium">{className}</span>
                              <span className="text-muted-foreground">{classStudents.length} students</span>
                            </div>
                            <Progress value={percentage} className="h-2" />
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No class data available</p>
                  )}
                </CardContent>
              </Card>

              <Card className="animate-fade-in" style={{ animationDelay: '0.8s' }}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-primary" />
                    Performance Overview
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="p-4 rounded-lg bg-secondary/50">
                      <p className="text-sm text-muted-foreground mb-2">Average Completion Rate</p>
                      <p className="text-3xl font-bold">{overviewStats.averageCompletionRate}%</p>
                    </div>
                    <div className="p-4 rounded-lg bg-secondary/50">
                      <p className="text-sm text-muted-foreground mb-2">Total Experiment Attempts</p>
                      <p className="text-3xl font-bold">{overviewStats.totalExperiments}</p>
                    </div>
                    <div className="p-4 rounded-lg bg-secondary/50">
                      <p className="text-sm text-muted-foreground mb-2">Active Students</p>
                      <p className="text-3xl font-bold">{overviewStats.totalStudents}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}

