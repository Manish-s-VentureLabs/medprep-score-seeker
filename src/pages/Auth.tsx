
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp"

const Auth = () => {
  const navigate = useNavigate();
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [showOTP, setShowOTP] = useState(false);
  const [otp, setOtp] = useState('');

  const handleSendOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      const formattedPhone = phone.startsWith('+') ? phone : `+${phone}`;
      const { error } = await supabase.auth.signInWithOtp({
        phone: formattedPhone,
      });

      if (error) throw error;

      setShowOTP(true);
      toast.success('OTP sent successfully!');
    } catch (error: any) {
      toast.error(error.message || 'Error sending OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      const formattedPhone = phone.startsWith('+') ? phone : `+${phone}`;
      const { error } = await supabase.auth.verifyOtp({
        phone: formattedPhone,
        token: otp,
        type: 'sms'
      });

      if (error) throw error;

      toast.success('Successfully logged in!');
      navigate('/dashboard');
    } catch (error: any) {
      toast.error(error.message || 'Error verifying OTP');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-md space-y-8 p-8 bg-white rounded-xl shadow-lg">
        <div className="text-center">
          <h2 className="text-3xl font-bold text-gray-900">NEET PG Prep</h2>
          <p className="mt-2 text-gray-600">Sign in to your account</p>
        </div>

        {!showOTP ? (
          <form onSubmit={handleSendOTP} className="mt-8 space-y-6">
            <div>
              <label htmlFor="phone" className="block text-sm font-medium text-gray-700">
                Phone Number
              </label>
              <Input
                id="phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+91XXXXXXXXXX"
                required
                className="mt-1"
              />
              <p className="mt-1 text-sm text-gray-500">
                Include country code (e.g., +91 for India)
              </p>
            </div>
            <Button 
              type="submit" 
              className="w-full"
              disabled={loading}
            >
              {loading ? 'Sending...' : 'Send OTP'}
            </Button>
          </form>
        ) : (
          <form onSubmit={handleVerifyOTP} className="mt-8 space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Enter OTP
              </label>
              <InputOTP
                value={otp}
                onChange={setOtp}
                maxLength={6}
                render={({ slots }) => (
                  <InputOTPGroup className="gap-2">
                    {slots.map((slot, index) => (
                      <InputOTPSlot key={index} {...slot} />
                    ))}
                  </InputOTPGroup>
                )}
              />
            </div>
            <Button 
              type="submit" 
              className="w-full"
              disabled={loading || otp.length !== 6}
            >
              {loading ? 'Verifying...' : 'Verify OTP'}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
};

export default Auth;
