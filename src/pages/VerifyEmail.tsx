import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FlaskConical, Mail, CheckCircle, Loader2, ArrowRight } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export default function VerifyEmail() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [isVerified, setIsVerified] = useState(false);
  const [checking, setChecking] = useState(true);
  const [resending, setResending] = useState(false);

  useEffect(() => {
    // If no user, redirect to auth
    if (!authLoading && !user) {
      navigate('/auth?mode=signup');
      return;
    }

    // If user is already verified, redirect to dashboard
    if (user?.email_confirmed_at) {
      setIsVerified(true);
      setChecking(false);
    } else {
      // Check verification status periodically
      const checkVerification = async () => {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user?.email_confirmed_at) {
          setIsVerified(true);
          setChecking(false);
        } else {
          setChecking(false);
        }
      };

      checkVerification();
      const interval = setInterval(checkVerification, 3000); // Check every 3 seconds

      return () => clearInterval(interval);
    }
  }, [user, authLoading, navigate]);

  const handleResendEmail = async () => {
    if (!user?.email) return;

    setResending(true);
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: user.email,
      });

      if (error) {
        toast.error('Failed to resend verification email. Please try again.');
      } else {
        toast.success('Verification email sent! Please check your inbox.');
      }
    } catch (error) {
      toast.error('An error occurred. Please try again.');
    } finally {
      setResending(false);
    }
  };

  const handleGoToDashboard = () => {
    navigate('/dashboard');
  };

  if (authLoading || checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-primary/5 p-4">
        <div className="fixed inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 -right-40 w-80 h-80 bg-primary/10 rounded-full blur-3xl" />
          <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-accent/10 rounded-full blur-3xl" />
        </div>
        <Card variant="elevated" className="w-full max-w-md relative animate-fade-in">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
              <p className="text-muted-foreground">Checking verification status...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-primary/5 p-4">
      {/* Background decoration */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-primary/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-accent/10 rounded-full blur-3xl" />
      </div>

      <Card variant="elevated" className="w-full max-w-md relative animate-fade-in">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-accent shadow-lg">
            {isVerified ? (
              <CheckCircle className="h-8 w-8 text-primary-foreground" />
            ) : (
              <Mail className="h-8 w-8 text-primary-foreground" />
            )}
          </div>
          <CardTitle className="text-2xl">
            {isVerified ? 'Email Verified!' : 'Verify Your Email'}
          </CardTitle>
          <CardDescription>
            {isVerified
              ? 'Your email has been successfully verified. You can now access your dashboard.'
              : `We've sent a verification email to ${user?.email || 'your email address'}. Please check your inbox and click the verification link.`}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {!isVerified ? (
            <>
              <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
                <div className="flex items-start gap-3">
                  <Mail className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                  <div className="space-y-1 text-sm">
                    <p className="font-medium">Check your inbox</p>
                    <p className="text-muted-foreground">
                      Click the verification link in the email we sent to complete your account setup.
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={handleResendEmail}
                  disabled={resending}
                >
                  {resending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Mail className="h-4 w-4 mr-2" />
                      Resend Verification Email
                    </>
                  )}
                </Button>

                <p className="text-xs text-center text-muted-foreground">
                  Didn't receive the email? Check your spam folder or click above to resend.
                </p>
              </div>
            </>
          ) : (
            <Button
              variant="hero"
              size="lg"
              className="w-full gap-2"
              onClick={handleGoToDashboard}
            >
              Go to Dashboard
              <ArrowRight className="h-4 w-4" />
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

