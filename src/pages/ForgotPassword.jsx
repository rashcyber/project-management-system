import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, ArrowLeft } from 'lucide-react';
import { Button, Input } from '../components/common';
import { supabase } from '../lib/supabase';
import { toast } from '../store/toastStore';
import './Auth.css';

const ForgotPassword = () => {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const navigate = useNavigate();

  const validateEmail = () => {
    if (!email) {
      toast.error('Email is required');
      return false;
    }
    if (!/\S+@\S+\.\S+/.test(email)) {
      toast.error('Please enter a valid email');
      return false;
    }
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateEmail()) return;

    setIsLoading(true);

    try {
      // Get the app URL from environment or use current origin
      const appUrl = import.meta.env.VITE_APP_URL || window.location.origin;

      // Send password reset email
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${appUrl}/auth/callback`,
      });

      if (error) {
        // Don't reveal if email exists or not (security best practice)
        console.error('Password reset error:', error);
        toast.success('If an account exists with this email, you will receive a password reset link');
        setIsSubmitted(true);
        return;
      }

      toast.success('Password reset link sent to your email');
      setIsSubmitted(true);
    } catch (error) {
      console.error('Error sending reset email:', error);
      toast.error('An error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  if (isSubmitted) {
    return (
      <div className="auth-container">
        <div className="auth-card">
          <div className="auth-header">
            <div className="auth-logo">
              <Mail size={32} />
            </div>
            <h1>Check Your Email</h1>
            <p>We've sent a password reset link to {email}</p>
          </div>

          <div style={{
            padding: '2rem',
            backgroundColor: 'var(--bg-secondary)',
            borderRadius: 'var(--radius-md)',
            marginBottom: '1.5rem',
            textAlign: 'center',
            color: 'var(--text-secondary)',
          }}>
            <p style={{ margin: 0, lineHeight: '1.6' }}>
              Click the link in your email to set a new password. The link will expire in 24 hours.
            </p>
          </div>

          <div className="auth-footer">
            <p>
              <Link to="/login" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <ArrowLeft size={16} />
                Back to Login
              </Link>
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-header">
          <div className="auth-logo">
            <Mail size={32} />
          </div>
          <h1>Reset Password</h1>
          <p>Enter your email and we'll send you a link to reset your password</p>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          <Input
            label="Email Address"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Enter your email"
            icon={<Mail size={18} />}
            autoComplete="email"
            required
          />

          <Button
            type="submit"
            variant="primary"
            size="large"
            fullWidth
            loading={isLoading}
          >
            Send Reset Link
          </Button>
        </form>

        <div className="auth-footer">
          <p>
            <Link to="/login" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <ArrowLeft size={16} />
              Back to Login
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword;
