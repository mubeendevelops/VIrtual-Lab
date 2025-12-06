import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Layout } from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  FlaskConical, 
  Beaker, 
  Microscope, 
  Award, 
  Users, 
  Sparkles,
  ArrowRight,
  CheckCircle,
  Zap,
  Target
} from 'lucide-react';

const Index = () => {
  const { user, loading } = useAuth();
  
  // Show loading state while auth is initializing
  if (loading) {
    return (
      <Layout>
        <div className="flex min-h-screen items-center justify-center">
          <div className="text-center">
            <div className="flex justify-center mb-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-accent shadow-xl animate-pulse">
                <FlaskConical className="h-8 w-8 text-primary-foreground" />
              </div>
            </div>
            <p className="text-muted-foreground">Loading...</p>
          </div>
        </div>
      </Layout>
    );
  }

  const features = [
    {
      icon: FlaskConical,
      title: 'Interactive Experiments',
      description: 'Conduct virtual chemistry experiments with realistic simulations and real-time feedback.',
    },
    {
      icon: Award,
      title: 'Gamified Learning',
      description: 'Earn XP points, level up, and unlock badges as you complete experiments and master concepts.',
    },
    {
      icon: Target,
      title: 'Track Progress',
      description: 'Monitor your performance with detailed analytics and personalized learning paths.',
    },
    {
      icon: Users,
      title: 'Leaderboards',
      description: 'Compete with classmates and see how you rank on the global leaderboard.',
    },
  ];

  const benefits = [
    'Safe environment to practice experiments',
    'No expensive lab equipment needed',
    'Learn at your own pace',
    'Instant feedback and explanations',
    'Track your learning journey',
  ];

  return (
    <Layout>
      {/* Hero Section */}
      <section className="relative min-h-[90vh] flex items-center justify-center overflow-hidden">
        {/* Animated Background */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-20 left-10 w-72 h-72 bg-primary/20 rounded-full blur-3xl animate-pulse-slow" />
          <div className="absolute bottom-20 right-10 w-96 h-96 bg-accent/20 rounded-full blur-3xl animate-pulse-slow" style={{ animationDelay: '1s' }} />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/5 rounded-full blur-3xl" />
        </div>

        <div className="container mx-auto px-4 py-20 relative z-10">
          <div className="max-w-4xl mx-auto text-center animate-fade-in">
            {/* Logo/Brand */}
            <div className="flex justify-center mb-6">
              <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-accent shadow-xl animate-float">
                <FlaskConical className="h-10 w-10 text-primary-foreground" />
              </div>
            </div>

            <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold mb-6 gradient-text">
              Virtual Science Lab
            </h1>
            <p className="text-xl md:text-2xl text-muted-foreground mb-8 max-w-2xl mx-auto">
              Experience science like never before. Conduct experiments, earn achievements, and master chemistry through interactive virtual simulations.
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-12">
              {user ? (
                <>
                  <Link to="/dashboard">
                    <Button variant="hero" size="lg" className="gap-2">
                      Go to Dashboard
                      <ArrowRight className="h-5 w-5" />
                    </Button>
                  </Link>
                  <Link to="/experiments">
                    <Button variant="outline" size="lg" className="gap-2">
                      Browse Experiments
                      <FlaskConical className="h-5 w-5" />
                    </Button>
                  </Link>
                </>
              ) : (
                <>
                  <Link to="/auth?mode=signup">
                    <Button variant="hero" size="lg" className="gap-2">
                      Get Started Free
                      <ArrowRight className="h-5 w-5" />
                    </Button>
                  </Link>
                  <Link to="/auth">
                    <Button variant="outline" size="lg" className="gap-2">
                      Sign In
                    </Button>
                  </Link>
                </>
              )}
            </div>

            {/* Trust Indicators */}
            <div className="flex flex-wrap justify-center gap-6 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-success" />
                <span>Free to use</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-success" />
                <span>No credit card required</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-success" />
                <span>Instant access</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Why Choose Virtual Lab?</h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Everything you need to master science experiments in one place
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((feature, index) => (
              <Card 
                key={index} 
                variant="interactive" 
                className="animate-fade-in"
                style={{ animationDelay: `${index * 0.1}s` }}
              >
                <CardHeader>
                  <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center mb-4 text-primary-foreground">
                    <feature.icon className="h-6 w-6" />
                  </div>
                  <CardTitle className="text-xl">{feature.title}</CardTitle>
                  <CardDescription>{feature.description}</CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <Card variant="gradient" className="animate-fade-in">
              <CardHeader>
                <CardTitle className="text-3xl mb-2 flex items-center gap-2">
                  <Zap className="h-8 w-8 text-gold" />
                  Key Benefits
                </CardTitle>
                <CardDescription className="text-base">
                  Discover what makes Virtual Lab the perfect learning platform
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-2 gap-4">
                  {benefits.map((benefit, index) => (
                    <div key={index} className="flex items-start gap-3">
                      <div className="h-6 w-6 rounded-full bg-success/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <CheckCircle className="h-4 w-4 text-success" />
                      </div>
                      <p className="text-foreground">{benefit}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-br from-primary/10 via-accent/10 to-primary/5">
        <div className="container mx-auto px-4 text-center">
          <div className="max-w-2xl mx-auto animate-fade-in">
            <div className="flex justify-center mb-6">
              <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-lg">
                <Sparkles className="h-8 w-8 text-primary-foreground" />
              </div>
            </div>
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Ready to Start Experimenting?
            </h2>
            <p className="text-lg text-muted-foreground mb-8">
              Join thousands of students already learning with Virtual Lab
            </p>
            {!user && (
              <Link to="/auth?mode=signup">
                <Button variant="hero" size="lg" className="gap-2">
                  Create Your Free Account
                  <ArrowRight className="h-5 w-5" />
                </Button>
              </Link>
            )}
          </div>
        </div>
      </section>
    </Layout>
  );
};

export default Index;
