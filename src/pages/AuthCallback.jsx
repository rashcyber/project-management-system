import React, { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import useAuthStore from '../store/authStore';
import { toast } from '../store/toastStore';

const AuthCallback = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { setUser, setSession, setProfile } = useAuthStore();

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        // Get hash params
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        const type = hashParams.get('type');
        const accessToken = hashParams.get('access_token');

        console.log('AuthCallback - Received:', { type, hasToken: !!accessToken });

        // If this is a recovery type (password reset), just navigate to reset password
        // Supabase will have already processed the token from the URL
        if (type === 'recovery') {
          console.log('Password recovery detected - navigating to reset password');
          // Use navigate to go to reset password, the URL hash will be preserved
          navigate('/reset-password', { replace: true });
          return;
        }

        // For other callbacks (OAuth, email verification, etc), wait for Supabase to process
        await new Promise(resolve => setTimeout(resolve, 800));

        // Get the session from URL hash
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();

        if (sessionError) {
          console.error('Session error:', sessionError);
          toast.error('Authentication failed. Please try again.');
          navigate('/login', { replace: true });
          return;
        }

        if (session?.user) {
          // Fetch user profile
          const { data: profile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', session.user.id)
            .single();

          // Update auth store
          setUser(session.user);
          setSession(session);
          setProfile(profile);

          toast.success('Successfully authenticated!');
          navigate('/dashboard', { replace: true });
        } else {
          // No session found, redirect to login
          navigate('/login', { replace: true });
        }
      } catch (error) {
        console.error('Auth callback error:', error);
        toast.error('An error occurred during authentication.');
        navigate('/login', { replace: true });
      }
    };

    // Small delay to ensure Supabase is initialized
    setTimeout(handleAuthCallback, 100);
  }, [navigate, setUser, setSession, setProfile]);

  return (
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    }}>
      <div style={{
        textAlign: 'center',
        color: 'white',
      }}>
        <div style={{
          fontSize: '24px',
          marginBottom: '20px',
          fontWeight: '600',
        }}>
          Authenticating...
        </div>
        <div style={{
          fontSize: '14px',
          opacity: '0.9',
        }}>
          Please wait while we verify your credentials
        </div>
        <div style={{
          marginTop: '30px',
          display: 'inline-block',
        }}>
          <div className="spinner" style={{
            width: '40px',
            height: '40px',
            border: '4px solid rgba(255, 255, 255, 0.3)',
            borderTop: '4px solid white',
            borderRadius: '50%',
            animation: 'spin 0.8s linear infinite',
          }} />
        </div>
        <style>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    </div>
  );
};

export default AuthCallback;
