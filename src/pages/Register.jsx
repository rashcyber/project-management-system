import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Mail, Lock, Eye, EyeOff, User, UserPlus } from 'lucide-react';
import { Button, Input } from '../components/common';
import useAuthStore from '../store/authStore';
import { toast } from '../store/toastStore';
import { supabase } from '../lib/supabase';
import './Auth.css';

const Register = () => {
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [inviteInfo, setInviteInfo] = useState(null);

  const { signUp } = useAuthStore();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Check for invite link
  useEffect(() => {
    const inviteCode = searchParams.get('invite');
    if (inviteCode) {
      loadInviteInfo(inviteCode);
    }
  }, [searchParams]);

  const loadInviteInfo = async (code) => {
    try {
      const { data: link, error } = await supabase
        .from('invite_links')
        .select('*')
        .eq('code', code)
        .maybeSingle();

      if (error || !link) {
        toast.error('Invalid or expired invite link');
        return;
      }

      // Check if link is still valid
      if (!link.is_active) {
        toast.error('This invite link has been revoked');
        return;
      }

      if (link.expires_at && new Date(link.expires_at) <= new Date()) {
        toast.error('This invite link has expired');
        return;
      }

      if (link.max_uses && link.used_count >= link.max_uses) {
        toast.error('This invite link has reached its maximum uses');
        return;
      }

      // Get workspace info
      const { data: workspace } = await supabase
        .from('workspaces')
        .select('name')
        .eq('id', link.workspace_id)
        .single();

      setInviteInfo({
        code,
        linkId: link.id,
        workspaceName: workspace?.name,
        role: link.role,
        workspaceId: link.workspace_id,
      });
    } catch (error) {
      console.error('Error loading invite info:', error);
    }
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.fullName) {
      newErrors.fullName = 'Full name is required';
    } else if (formData.fullName.length < 2) {
      newErrors.fullName = 'Name must be at least 2 characters';
    }

    if (!formData.email) {
      newErrors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email';
    }

    if (!formData.password) {
      newErrors.password = 'Password is required';
    } else if (formData.password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters';
    } else if (!/[A-Z]/.test(formData.password)) {
      newErrors.password = 'Password must contain an uppercase letter';
    } else if (!/[a-z]/.test(formData.password)) {
      newErrors.password = 'Password must contain a lowercase letter';
    } else if (!/[0-9]/.test(formData.password)) {
      newErrors.password = 'Password must contain a number';
    }

    if (!formData.confirmPassword) {
      newErrors.confirmPassword = 'Please confirm your password';
    } else if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) return;

    setIsLoading(true);

    try {
      const { data, error } = await signUp(
        formData.email,
        formData.password,
        formData.fullName
      );

      if (error) {
        if (error.message.includes('already registered')) {
          toast.error('This email is already registered. Please sign in.');
        } else {
          toast.error(error.message || 'Failed to create account');
        }
        setIsLoading(false);
        return;
      }

      // If signing up via invite link, handle the workspace assignment and link usage
      if (inviteInfo && data.user) {
        try {
          // Step 1: Check if user already has a super_admin role
          const { data: existingProfile } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', data.user.id)
            .single();

          // Only update role if user is not already a super_admin
          const updateData = { workspace_id: inviteInfo.workspaceId };
          if (existingProfile?.role !== 'super_admin') {
            updateData.role = inviteInfo.role;
          }

          const { error: profileError } = await supabase
            .from('profiles')
            .update(updateData)
            .eq('id', data.user.id);

          if (profileError) {
            console.warn('Failed to update profile with workspace:', profileError);
          }

          // Step 2: Increment the used_count on the invite link
          // First get current count, then increment
          const { data: currentLink } = await supabase
            .from('invite_links')
            .select('used_count')
            .eq('id', inviteInfo.linkId)
            .single();

          const newCount = (currentLink?.used_count || 0) + 1;
          const { error: updateError } = await supabase
            .from('invite_links')
            .update({ used_count: newCount })
            .eq('id', inviteInfo.linkId);

          if (updateError) {
            console.warn('Failed to update invite link usage:', updateError);
          }
        } catch (err) {
          console.warn('Error processing invite link:', err);
        }
      }

      toast.success('Account created successfully! Welcome aboard!');
      navigate('/dashboard');
    } catch (error) {
      toast.error('An unexpected error occurred');
      setIsLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-header">
          <div className="auth-logo">
            <UserPlus size={32} />
          </div>
          <h1>Create Account</h1>
          {inviteInfo ? (
            <p>Join <strong>{inviteInfo.workspaceName}</strong> workspace as {inviteInfo.role}</p>
          ) : (
            <p>Sign up to get started with TaskFlow</p>
          )}
        </div>

        {inviteInfo && (
          <div className="invite-info-banner">
            <p className="invite-message">
              You're joining <strong>{inviteInfo.workspaceName}</strong> with the role <strong>{inviteInfo.role}</strong>
            </p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="auth-form">
          <Input
            label="Full Name"
            type="text"
            name="fullName"
            value={formData.fullName}
            onChange={handleChange}
            placeholder="Enter your full name"
            icon={<User size={18} />}
            error={errors.fullName}
            autoComplete="name"
            required
          />

          <Input
            label="Email Address"
            type="email"
            name="email"
            value={formData.email}
            onChange={handleChange}
            placeholder="Enter your email"
            icon={<Mail size={18} />}
            error={errors.email}
            autoComplete="email"
            required
          />

          <div className="password-field">
            <Input
              label="Password"
              type={showPassword ? 'text' : 'password'}
              name="password"
              value={formData.password}
              onChange={handleChange}
              placeholder="Create a password"
              icon={<Lock size={18} />}
              error={errors.password}
              autoComplete="new-password"
              required
            />
            <button
              type="button"
              className="password-toggle"
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>

          <div className="password-field">
            <Input
              label="Confirm Password"
              type={showConfirmPassword ? 'text' : 'password'}
              name="confirmPassword"
              value={formData.confirmPassword}
              onChange={handleChange}
              placeholder="Confirm your password"
              icon={<Lock size={18} />}
              error={errors.confirmPassword}
              autoComplete="new-password"
              required
            />
            <button
              type="button"
              className="password-toggle"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
            >
              {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>

          <div className="password-requirements">
            <p>Password must contain:</p>
            <ul>
              <li className={formData.password.length >= 8 ? 'valid' : ''}>
                At least 8 characters
              </li>
              <li className={/[A-Z]/.test(formData.password) ? 'valid' : ''}>
                One uppercase letter
              </li>
              <li className={/[a-z]/.test(formData.password) ? 'valid' : ''}>
                One lowercase letter
              </li>
              <li className={/[0-9]/.test(formData.password) ? 'valid' : ''}>
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
            Create Account
          </Button>
        </form>

        <div className="auth-footer">
          <p>
            Already have an account?{' '}
            <Link to="/login">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Register;
