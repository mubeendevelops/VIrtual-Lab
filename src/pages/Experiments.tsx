import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { FlaskConical, Clock, Sparkles, ArrowRight, Beaker, Zap, Microscope } from 'lucide-react';

interface Experiment {
  id: string;
  name: string;
  description: string;
  subject: string;
  difficulty: string;
  xp_reward: number;
  duration_minutes: number;
}

export default function Experiments() {
  const [experiments, setExperiments] = useState<Experiment[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSubject, setSelectedSubject] = useState<string | null>(null);

  useEffect(() => {
    fetchExperiments();
  }, []);

  const fetchExperiments = async () => {
    const { data, error } = await supabase
      .from('experiments')
      .select('*')
      .eq('is_active', true)
      .order('subject', { ascending: true })
      .order('name', { ascending: true });

    if (data) {
      setExperiments(data);
    }
    setLoading(false);
  };

  // Filter experiments by selected subject
  const filteredExperiments = selectedSubject
    ? experiments.filter(exp => exp.subject?.toLowerCase() === selectedSubject.toLowerCase())
    : experiments;

  // Group experiments by subject for display
  const groupedExperiments = filteredExperiments.reduce((acc, exp) => {
    const subject = exp.subject || 'Other';
    if (!acc[subject]) {
      acc[subject] = [];
    }
    acc[subject].push(exp);
    return acc;
  }, {} as Record<string, Experiment[]>);

  // Get unique subjects from experiments
  const availableSubjects = Array.from(new Set(experiments.map(exp => exp.subject).filter(Boolean)));

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'easy': return 'bg-success/10 text-success border-success/20';
      case 'medium': return 'bg-warning/10 text-warning border-warning/20';
      case 'hard': return 'bg-destructive/10 text-destructive border-destructive/20';
      default: return 'bg-secondary text-secondary-foreground';
    }
  };

  const getSubjectIcon = (subject: string) => {
    switch (subject?.toLowerCase()) {
      case 'chemistry': return <FlaskConical className="h-6 w-6" />;
      case 'physics': return <Zap className="h-6 w-6" />;
      case 'biology': return <Microscope className="h-6 w-6" />;
      default: return <Beaker className="h-6 w-6" />;
    }
  };

  const getSubjectColor = (subject: string) => {
    switch (subject?.toLowerCase()) {
      case 'chemistry': return 'from-blue-500 to-cyan-500';
      case 'physics': return 'from-purple-500 to-pink-500';
      case 'biology': return 'from-green-500 to-emerald-500';
      default: return 'from-primary to-accent';
    }
  };

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8 animate-fade-in">
          <h1 className="text-3xl font-bold mb-2">Virtual Experiments</h1>
          <p className="text-muted-foreground">
            Choose an experiment and start learning through hands-on simulation
          </p>
        </div>

        {/* Subject Filters */}
        <div className="flex flex-wrap gap-2 mb-6 animate-fade-in" style={{ animationDelay: '0.1s' }}>
          <Badge 
            variant={selectedSubject === null ? "secondary" : "outline"}
            className="cursor-pointer hover:bg-secondary/80 transition-colors"
            onClick={() => setSelectedSubject(null)}
          >
            All Subjects ({experiments.length})
          </Badge>
          {availableSubjects.map((subject) => (
            <Badge
              key={subject}
              variant={selectedSubject === subject ? "secondary" : "outline"}
              className="cursor-pointer hover:bg-secondary/50 transition-colors"
              onClick={() => setSelectedSubject(subject)}
            >
              {subject} ({experiments.filter(e => e.subject === subject).length})
            </Badge>
          ))}
        </div>

        {/* Experiments Grid */}
        {loading ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="animate-pulse">
                <CardHeader>
                  <div className="h-12 w-12 bg-secondary rounded-xl mb-3" />
                  <div className="h-6 bg-secondary rounded w-3/4 mb-2" />
                  <div className="h-4 bg-secondary rounded w-full" />
                </CardHeader>
                <CardContent>
                  <div className="h-10 bg-secondary rounded" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : filteredExperiments.length > 0 ? (
          <div className="space-y-8">
            {Object.entries(groupedExperiments).map(([subject, subjectExperiments]) => (
              <div key={subject} className="animate-fade-in">
                {/* Subject Header */}
                {!selectedSubject && (
                  <div className="flex items-center gap-3 mb-4">
                    <div className={`h-10 w-10 rounded-xl bg-gradient-to-br ${getSubjectColor(subject)} flex items-center justify-center text-white shadow-md`}>
                      {getSubjectIcon(subject)}
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold">{subject}</h2>
                      <p className="text-sm text-muted-foreground">
                        {subjectExperiments.length} {subjectExperiments.length === 1 ? 'experiment' : 'experiments'}
                      </p>
                    </div>
                  </div>
                )}
                
                {/* Experiments Grid for this Subject */}
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {subjectExperiments.map((experiment, index) => (
                    <Card 
                      key={experiment.id} 
                      variant="interactive"
                      className="group animate-fade-in"
                      style={{ animationDelay: `${0.05 * (index + 1)}s` }}
                    >
                      <CardHeader>
                        <div className="flex items-start justify-between mb-2">
                          <div className={`h-12 w-12 rounded-xl bg-gradient-to-br ${getSubjectColor(experiment.subject)} flex items-center justify-center text-white shadow-md group-hover:shadow-lg transition-shadow`}>
                            {getSubjectIcon(experiment.subject)}
                          </div>
                          <Badge className={getDifficultyColor(experiment.difficulty)}>
                            {experiment.difficulty}
                          </Badge>
                        </div>
                        <CardTitle className="group-hover:text-primary transition-colors">
                          {experiment.name}
                        </CardTitle>
                        <CardDescription className="line-clamp-2">
                          {experiment.description}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-1.5 text-muted-foreground">
                            <Clock className="h-4 w-4" />
                            {experiment.duration_minutes} min
                          </div>
                          <div className="flex items-center gap-1.5 text-gold font-medium">
                            <Sparkles className="h-4 w-4" />
                            +{experiment.xp_reward} XP
                          </div>
                        </div>
                        <Link to={
                          experiment.name?.toLowerCase().includes('ohm') || 
                          experiment.name?.toLowerCase().includes("ohm's law") ||
                          experiment.subject?.toLowerCase() === 'physics'
                            ? `/experiment-ohmslaw/${experiment.id}`
                            : experiment.name?.toLowerCase().includes('osmosis') ||
                              experiment.name?.toLowerCase().includes('plasmolysis') ||
                              (experiment.subject?.toLowerCase() === 'biology' && 
                               (experiment.name?.toLowerCase().includes('osmosis') || 
                                experiment.name?.toLowerCase().includes('plasmolysis')))
                            ? `/experiment-osmosis/${experiment.id}`
                            : `/experiment/${experiment.id}`
                        }>
                          <Button variant="hero" className="w-full gap-2 group-hover:scale-[1.02] transition-transform">
                            Start Experiment
                            <ArrowRight className="h-4 w-4" />
                          </Button>
                        </Link>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <Card className="text-center py-12">
            <CardContent>
              <FlaskConical className="h-16 w-16 mx-auto mb-4 text-muted-foreground/50" />
              <h3 className="text-xl font-semibold mb-2">
                {selectedSubject ? `No ${selectedSubject} Experiments` : 'No Experiments Available'}
              </h3>
              <p className="text-muted-foreground">
                {selectedSubject 
                  ? `Try selecting a different subject or check back later for new ${selectedSubject.toLowerCase()} experiments!`
                  : 'Check back later for new experiments!'
                }
              </p>
              {selectedSubject && (
                <Button 
                  variant="outline" 
                  className="mt-4"
                  onClick={() => setSelectedSubject(null)}
                >
                  Show All Experiments
                </Button>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </Layout>
  );
}
