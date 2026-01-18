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
        // Check if this is a password recovery callback
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        const type = hashParams.get('type');

        // If this is a recovery type, redirect to reset password page
        // Pass the hash along so ResetPassword can still access the tokens
        if (type === 'recovery') {
          console.log('Password recovery detected, redirecting to reset password page');
          // Redirect but keep the hash so ResetPassword can process it
          window.location.href = '/reset-password' + window.location.hash;
          return;
        }

        // Wait a bit for Supabase to process the auth URL
        await new Promise(resolve => setTimeout(resolve, 500));

        // Get the session from URL hash
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();

        if (sessionError) {
          console.error('Session error:', sessionError);
          toast.error('Authentication failed. Please try again.');
          navigate('/login');
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
          navigate('/dashboard');
        } else {
          // No session found, redirect to login
          navigate('/login');
        }
      } catch (error) {
        console.error('Auth callback error:', error);
        toast.error('An error occurred during authentication.');
        navigate('/login');
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
