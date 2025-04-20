import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const SignIn = ({ onSwitch }: { onSwitch: () => void }) => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      toast.success('Successfully logged in!');
      navigate('/dashboard');
    } catch (error: any) {
      toast.error(error.message || 'Invalid email or password');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email) {
      toast.error('Please enter your email address first');
      return;
    }

    try {
      setIsResetting(true);
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `https://neetpreps.web.app/reset-password`,
      });

      if (error) throw error;

      toast.success('Password reset instructions sent to your email');
    } catch (error: any) {
      toast.error(error.message || 'Failed to send reset instructions');
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Sign In</CardTitle>
        <CardDescription>Welcome back! Please enter your details.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="email" className="block text-sm font-medium">
              Email Address
            </label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email"
              required
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="password" className="block text-sm font-medium">
              Password
            </label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              required
            />
          </div>
          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleForgotPassword}
              disabled={isResetting}
              className="text-sm text-primary hover:underline"
            >
              {isResetting ? 'Sending...' : 'Forgot Password?'}
            </button>
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Signing in...' : 'Sign In'}
          </Button>
          <div className="text-center text-sm">
            <span className="text-muted-foreground">Don't have an account? </span>
            <button
              type="button"
              onClick={onSwitch}
              className="text-primary hover:underline"
            >
              Sign up
            </button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};

const SignUp = ({ onSwitch }: { onSwitch: () => void }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
  
      // Check if the email exists by attempting to sign in with email only
      const { data, error: emailCheckError } = await supabase.auth.signInWithOtp({
        email,
        options: {
          shouldCreateUser: false, // Don't create a new user
        }
      });
  
      // If there's no error or specific error indicating email found, the email exists
      if (!emailCheckError || emailCheckError.message.includes('Email not confirmed')) {
        toast.error('An account with this email already exists. Please sign in instead.');
        setLoading(false);
        return;
      }
  
      // Proceed with signup if email doesn't exist
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `https://neetpreps.web.app/auth`,
        },
      });
  
      if (error) throw error;
  
      toast.success('Registration successful! Please check your email for verification.');
    } catch (error: any) {
      toast.error(error.message || 'An error occurred during registration');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Create Account</CardTitle>
        <CardDescription>Join us to start tracking your progress.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="signup-email" className="block text-sm font-medium">
              Email Address
            </label>
            <Input
              id="signup-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email"
              required
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="signup-password" className="block text-sm font-medium">
              Password
            </label>
            <Input
              id="signup-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Create a password"
              required
            />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Creating account...' : 'Sign Up'}
          </Button>
          <div className="text-center text-sm">
            <span className="text-muted-foreground">Already have an account? </span>
            <button
              type="button"
              onClick={onSwitch}
              className="text-primary hover:underline"
            >
              Sign in
            </button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};

const Auth = () => {
  const [activeTab, setActiveTab] = useState<'signin' | 'signup'>('signin');

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">NEET PG Prep</h1>
          <p className="mt-2 text-gray-600">Track your progress and excel in your preparation</p>
        </div>
        
        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'signin' | 'signup')}>
          <TabsList className="grid w-full grid-cols-2 mb-4">
            <TabsTrigger value="signin">Sign In</TabsTrigger>
            <TabsTrigger value="signup">Sign Up</TabsTrigger>
          </TabsList>
          <TabsContent value="signin">
            <SignIn onSwitch={() => setActiveTab('signup')} />
          </TabsContent>
          <TabsContent value="signup">
            <SignUp onSwitch={() => setActiveTab('signin')} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Auth;

