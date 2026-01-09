import { useState, useEffect } from 'react';
import { UserPlus, AlertCircle, ArrowLeft, Clock, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';

interface SignupProps {
  onBackToLogin: () => void;
}

type SignupMode = 'invitation' | 'self-signup';

const Signup = ({ onBackToLogin }: SignupProps) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [invitationToken, setInvitationToken] = useState<string | null>(null);
  const [invitationRole, setInvitationRole] = useState<string>('sales');
  const [validatingInvitation, setValidatingInvitation] = useState(true);
  const [signupMode, setSignupMode] = useState<SignupMode>('self-signup');
  const { user } = useAuth();

  // Check for invitation token in URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    const inviteEmail = params.get('email');

    if (token && inviteEmail) {
      // Check if user is already logged in with a different email
      if (user && user.email !== inviteEmail) {
        setValidatingInvitation(false);
        setError(`You are currently logged in as ${user.email}. Please log out first to accept this invitation for ${inviteEmail}.`);
        return;
      }

      setSignupMode('invitation');
      setInvitationToken(token);
      setEmail(inviteEmail);
      validateInvitation(inviteEmail, token);
    } else {
      // No invitation token - allow self-signup
      setSignupMode('self-signup');
      setValidatingInvitation(false);
    }
  }, [user]);

  const validateInvitation = async (inviteEmail: string, token: string) => {
    try {
      const { data, error } = await supabase.rpc('validate_invitation_token', {
        p_email: inviteEmail,
        p_token: token
      });

      if (error) throw error;

      if (!data) {
        setError('Invalid or expired invitation. Please request a new invitation.');
        setValidatingInvitation(false);
        return;
      }

      // Get the role from the invitation
      const { data: invitation } = await supabase
        .from('user_invitations')
        .select('role')
        .eq('email', inviteEmail)
        .eq('token', token)
        .single();

      if (invitation) {
        setInvitationRole(invitation.role);
      }

      setValidatingInvitation(false);
    } catch (err) {
      console.error('Error validating invitation:', err);
      setError('Failed to validate invitation. Please try again or contact an administrator.');
      setValidatingInvitation(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validation
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    if (!fullName.trim()) {
      setError('Please enter your full name');
      return;
    }

    setLoading(true);

    try {
      // Determine role and approval status based on signup mode
      const isInvited = signupMode === 'invitation' && invitationToken;

      // Sign up the user
      const { error: signUpError, data: signUpData } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
            // Invited users get their role; self-signup users get 'pending' until approved
            role: isInvited ? invitationRole : 'sales',
            phone: phone || undefined,
            // Self-signup users need approval
            approval_status: isInvited ? 'approved' : 'pending'
          }
        }
      });

      if (signUpError) {
        setError(signUpError.message);
        setLoading(false);
        return;
      }

      // Get the newly created user's ID
      const newUserId = signUpData?.user?.id;

      if (!newUserId) {
        setError('Failed to create user account');
        setLoading(false);
        return;
      }

      // If this was an invitation, mark it as accepted
      if (isInvited) {
        const { error: acceptError } = await supabase.rpc('accept_invitation', {
          p_email: email,
          p_token: invitationToken,
          p_user_id: newUserId
        });

        if (acceptError) {
          console.error('Error accepting invitation:', acceptError);
          // Don't fail the signup if this fails, just log it
        }
      } else {
        // Self-signup: Update profile to pending approval status
        // The trigger creates the profile, but we need to set approval_status
        await supabase
          .from('user_profiles')
          .update({
            approval_status: 'pending',
            phone: phone || null
          })
          .eq('id', newUserId);
      }

      setSuccess(true);
    } catch (err) {
      console.error('Signup error:', err);
      setError('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    const isPendingApproval = signupMode === 'self-signup';

    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-xl p-8 w-full max-w-md">
          <div className="text-center mb-6">
            {isPendingApproval ? (
              <>
                <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Clock className="w-8 h-8 text-amber-600" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Account Pending Approval</h2>
                <p className="text-gray-600 mb-4">
                  Your account has been created! An administrator will review and approve your access shortly.
                </p>
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-left mb-4">
                  <p className="text-sm text-amber-800">
                    <strong>What happens next:</strong>
                  </p>
                  <ul className="text-sm text-amber-700 mt-2 space-y-1">
                    <li>• Check your email to verify your address</li>
                    <li>• An admin will review your request</li>
                    <li>• You'll receive a notification when approved</li>
                  </ul>
                </div>
              </>
            ) : (
              <>
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle2 className="w-8 h-8 text-green-600" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Check Your Email</h2>
                <p className="text-gray-600 mb-4">
                  We've sent a confirmation link to <strong>{email}</strong>. Please check your email to verify your account.
                </p>
              </>
            )}
          </div>

          {/* App Installation Instructions */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-6">
            <h3 className="font-bold text-gray-900 mb-3 flex items-center">
              <span className="text-2xl mr-2">📱</span>
              Install the App
            </h3>
            <div className="space-y-3 text-sm text-gray-700">
              <div>
                <p className="font-semibold mb-1">iPhone/iPad:</p>
                <p className="text-gray-600">Tap <strong>Share</strong> → <strong>Add to Home Screen</strong></p>
              </div>
              <div>
                <p className="font-semibold mb-1">Android:</p>
                <p className="text-gray-600">Tap <strong>Menu</strong> (⋮) → <strong>Install App</strong></p>
              </div>
              <div>
                <p className="font-semibold mb-1">Desktop:</p>
                <p className="text-gray-600">Look for the install icon in your browser's address bar</p>
              </div>
            </div>
          </div>

          <button
            onClick={onBackToLogin}
            className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700"
          >
            Back to Login
          </button>
        </div>
      </div>
    );
  }

  // Show loading state while validating invitation
  if (validatingInvitation) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-xl p-8 w-full max-w-md text-center">
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Validating Invitation</h2>
          <p className="text-gray-600">Please wait while we verify your invitation...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl p-8 w-full max-w-md">
        {/* Back Button */}
        <button
          onClick={onBackToLogin}
          className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="text-sm">Back to Login</span>
        </button>

        {/* Logo */}
        <div className="flex justify-center mb-8">
          <img src="/logo-transparent.png" alt="Discount Fence USA" className="h-20 w-auto" />
        </div>

        {/* Title */}
        <h1 className="text-2xl font-bold text-gray-900 text-center mb-2">Create Account</h1>
        <p className="text-gray-600 text-center mb-8">Join Discount Fence USA</p>

        {/* Error Message */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 flex items-start space-x-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        {/* Show signup mode info */}
        {!error && (
          signupMode === 'invitation' && invitationToken ? (
            <div className="mb-6 bg-green-50 border border-green-200 rounded-lg p-4">
              <p className="text-sm text-green-800">
                ✓ Valid invitation for <strong>{email}</strong> as <strong>{invitationRole}</strong>
              </p>
            </div>
          ) : (
            <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-800">
                Create your account and an administrator will approve your access.
              </p>
            </div>
          )
        )}

        {/* Signup Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="fullName" className="block text-sm font-medium text-gray-700 mb-2">
              Full Name
            </label>
            <input
              id="fullName"
              type="text"
              inputMode="text"
              autoComplete="name"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="John Smith"
            />
          </div>

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
              Email Address
            </label>
            <input
              id="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck="false"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={!!invitationToken}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-2">
              Phone Number <span className="text-gray-400">(optional)</span>
            </label>
            <input
              id="phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="(555) 123-4567"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete="new-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="••••••••"
            />
            <p className="text-xs text-gray-500 mt-1">Minimum 6 characters</p>
          </div>

          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-2">
              Confirm Password
            </label>
            <input
              id="confirmPassword"
              type="password"
              autoComplete="new-password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2 mt-6"
          >
            {loading ? (
              <span>Creating account...</span>
            ) : (
              <>
                <UserPlus className="w-5 h-5" />
                <span>{signupMode === 'invitation' ? 'Create Account' : 'Request Access'}</span>
              </>
            )}
          </button>
        </form>

        {/* Footer */}
        <div className="mt-6 text-center">
          <p className="text-sm text-gray-600">
            Already have an account?{' '}
            <button onClick={onBackToLogin} className="text-blue-600 hover:text-blue-700 font-medium">
              Sign in
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Signup;
