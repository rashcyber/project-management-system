import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Lock, Eye, EyeOff, KeyRound, Check } from 'lucide-react';
import { Button } from '../components/common';
import { supabase } from '../lib/supabase';
import { toast } from '../store/toastStore';
import './Auth.css';

const ResetPassword = () => {
  const [formData, setFormData] = useState({
    password: '',
    confirmPassword: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isValidSession, setIsValidSession] = useState(false);
  const [isCheckingSession, setIsCheckingSession] = useState(true);

  const navigate = useNavigate();

  useEffect(() => {
    // Check if we have a valid recovery session
    const checkSession = async () => {
      try {
        // Get recovery params from URL hash
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        const type = hashParams.get('type');
        const accessToken = hashParams.get('access_token');
        const refreshToken = hashParams.get('refresh_token');

        console.log('ResetPassword - Checking recovery session:', { type, hasAccessToken: !!accessToken });

        // If we have recovery tokens in the URL, manually set the session
        if (type === 'recovery' && accessToken) {
          console.log('Recovery tokens found in URL, setting session...');

          // Manually set the session with the tokens from the URL
          const { error: setSessionError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken || '',
          });

          if (setSessionError) {
            console.error('Failed to set session:', setSessionError);
            setIsCheckingSession(false);
            return;
          }

          console.log('Recovery session set successfully');
          setIsValidSession(true);
          setIsCheckingSession(false);
          return;
        }

        // If no recovery tokens in URL, check current session
        const { data: { session }, error } = await supabase.auth.getSession();

        if (error) {
          console.error('Session error:', error);
          setIsCheckingSession(false);
          return;
        }

        // Valid if we have an active session (from recovery or other means)
        if (session?.user) {
          console.log('Valid session found');
          setIsValidSession(true);
        } else {
          console.log('No valid session found');
          setIsValidSession(false);
        }

        setIsCheckingSession(false);
      } catch (error) {
        console.error('Error checking session:', error);
        setIsCheckingSession(false);
      }
    };

    // Delay to ensure Supabase auth is initialized properly
    // Recovery tokens expire after 1 hour, so we need to validate quickly
    const timeoutId = setTimeout(checkSession, 500);

    return () => clearTimeout(timeoutId);
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const validatePassword = () => {
    if (formData.password.length < 8) {
      toast.error('Password must be at least 8 characters');
      return false;
    }
    if (!/[A-Z]/.test(formData.password)) {
      toast.error('Password must contain an uppercase letter');
      return false;
    }
    if (!/[a-z]/.test(formData.password)) {
      toast.error('Password must contain a lowercase letter');
      return false;
    }
    if (!/[0-9]/.test(formData.password)) {
      toast.error('Password must contain a number');
      return false;
    }
    if (formData.password !== formData.confirmPassword) {
      toast.error('Passwords do not match');
      return false;
    }
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validatePassword()) return;

    setIsLoading(true);

    try {
      const { error } = await supabase.auth.updateUser({
        password: formData.password,
      });

      if (error) throw error;

      toast.success('Password set successfully! You can now log in.');

      // SECURITY: Complete session cleanup to prevent session hijacking
      // 1. Sign out from all scopes to clear browser storage
      await supabase.auth.signOut({ scope: 'global' });

      // 2. Clear the URL hash to prevent token reuse
      window.history.replaceState({}, document.title, window.location.pathname);

      // 3. Add a small delay to ensure session is cleared before navigation
      await new Promise(resolve => setTimeout(resolve, 100));

      navigate('/login');
    } catch (error) {
      toast.error(error.message || 'Failed to set password');
    }

    setIsLoading(false);
  };

  if (isCheckingSession) {
    return (
      <div className="auth-container">
        <div className="auth-card">
          <div className="auth-header">
            <div className="auth-logo">
              <KeyRound size={32} />
            </div>
            <h1>Verifying...</h1>
            <p>Please wait while we verify your reset link.</p>
          </div>
        </div>
      </div>
    );
  }

  if (!isValidSession) {
    return (
      <div className="auth-container">
        <div className="auth-card">
          <div className="auth-header">
            <div className="auth-logo invalid">
              <KeyRound size={32} />
            </div>
            <h1>Invalid or Expired Link</h1>
            <p>This password reset link is invalid or has expired. Please request a new one.</p>
          </div>
          <div className="auth-footer">
            <p>
              <Link to="/login">Back to Login</Link>
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
            <KeyRound size={32} />
          </div>
          <h1>Set Your Password</h1>
          <p>Create a secure password for your account</p>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="password-field">
            <label className="input-label">New Password</label>
            <div className="password-input-wrapper">
              <span className="input-icon"><Lock size={18} /></span>
              <input
                type={showPassword ? 'text' : 'password'}
                name="password"
                value={formData.password}
                onChange={handleChange}
                placeholder="Enter your new password"
                className="input input-with-icon"
                required
                minLength={8}
              />
              <button
                type="button"
                className="password-toggle-btn"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <div className="password-field">
            <label className="input-label">Confirm Password</label>
            <div className="password-input-wrapper">
              <span className="input-icon"><Lock size={18} /></span>
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleChange}
                placeholder="Confirm your new password"
                className="input input-with-icon"
                required
              />
              <button
                type="button"
                className="password-toggle-btn"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              >
                {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {/* Password Requirements */}
          <div className="password-requirements">
            <p>Password must contain:</p>
            <ul>
              <li className={formData.password.length >= 8 ? 'valid' : ''}>
                <Check size={14} />
                At least 8 characters
              </li>
              <li className={/[A-Z]/.test(formData.password) ? 'valid' : ''}>
                <Check size={14} />
                One uppercase letter
              </li>
              <li className={/[a-z]/.test(formData.password) ? 'valid' : ''}>
                <Check size={14} />
                One lowercase letter
              </li>
              <li className={/[0-9]/.test(formData.password) ? 'valid' : ''}>
                <Check size={14} />
                One number
              </li>
            </ul>
          </div>

          <Button
            type="submit"
            variant="primary"
            size="large"
            fullWidth
            loading={isLoading}
          >
            Set Password
          </Button>
        </form>

        <div className="auth-footer">
          <p>
            Remember your password?{' '}
            <Link to="/login">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default ResetPassword;
