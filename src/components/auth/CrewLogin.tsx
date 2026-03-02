import { useState, useEffect, useRef } from 'react';
import { Phone, ArrowLeft, AlertCircle } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

interface CrewLoginProps {
  onBackToLogin: () => void;
}

export default function CrewLogin({ onBackToLogin }: CrewLoginProps) {
  const { signInWithPhone, verifyPhoneOtp } = useAuth();
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [resendCountdown, setResendCountdown] = useState(0);
  const otpInputRef = useRef<HTMLInputElement>(null);

  // Resend countdown timer
  useEffect(() => {
    if (resendCountdown <= 0) return;
    const timer = setTimeout(() => setResendCountdown(resendCountdown - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendCountdown]);

  // Auto-focus OTP input when step changes
  useEffect(() => {
    if (step === 'otp') {
      setTimeout(() => otpInputRef.current?.focus(), 100);
    }
  }, [step]);

  const formatPhoneForApi = (raw: string) => {
    // Strip everything except digits
    const digits = raw.replace(/\D/g, '');
    // Ensure +1 prefix for US numbers
    if (digits.length === 10) return `+1${digits}`;
    if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
    return `+${digits}`;
  };

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const digits = phone.replace(/\D/g, '');
    if (digits.length < 10) {
      setError('Ingresa un numero de telefono valido');
      return;
    }

    setLoading(true);
    try {
      const fullPhone = formatPhoneForApi(phone);
      const { error } = await signInWithPhone(fullPhone);
      if (error) {
        setError(error.message);
      } else {
        setStep('otp');
        setResendCountdown(60);
      }
    } catch {
      setError('Error inesperado. Intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (otp.length !== 6) {
      setError('Ingresa el codigo de 6 digitos');
      return;
    }

    setLoading(true);
    try {
      const fullPhone = formatPhoneForApi(phone);
      const { error } = await verifyPhoneOtp(fullPhone, otp);
      if (error) {
        setError(error.message);
      }
      // On success, onAuthStateChange fires automatically
    } catch {
      setError('Error inesperado. Intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (resendCountdown > 0) return;
    setError('');
    setLoading(true);
    try {
      const fullPhone = formatPhoneForApi(phone);
      const { error } = await signInWithPhone(fullPhone);
      if (error) {
        setError(error.message);
      } else {
        setResendCountdown(60);
      }
    } catch {
      setError('Error al reenviar codigo');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl p-8 w-full max-w-md">
        {/* Logo */}
        <div className="flex justify-center mb-6">
          <img src="/logo-transparent.png" alt="Discount Fence USA" className="h-20 w-auto" />
        </div>

        {/* Title */}
        <h1 className="text-2xl font-bold text-gray-900 text-center mb-1">
          Acceso Equipo
        </h1>
        <p className="text-gray-600 text-center mb-6">
          {step === 'phone'
            ? 'Ingresa tu numero de telefono'
            : 'Ingresa el codigo que recibiste'}
        </p>

        {/* Error */}
        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-3 flex items-start space-x-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        {step === 'phone' ? (
          /* Step 1: Phone number */
          <form onSubmit={handleSendOtp} className="space-y-5">
            <div>
              <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-2">
                Numero de Telefono
              </label>
              <div className="flex">
                <span className="inline-flex items-center px-3 border border-r-0 border-gray-300 bg-gray-50 text-gray-500 rounded-l-lg text-sm">
                  +1
                </span>
                <input
                  id="phone"
                  type="tel"
                  inputMode="numeric"
                  autoComplete="tel-national"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="flex-1 px-4 py-3 border border-gray-300 rounded-r-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="(512) 555-1234"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
            >
              {loading ? (
                <span>Enviando...</span>
              ) : (
                <>
                  <Phone className="w-5 h-5" />
                  <span>Enviar Codigo</span>
                </>
              )}
            </button>
          </form>
        ) : (
          /* Step 2: OTP verification */
          <form onSubmit={handleVerifyOtp} className="space-y-5">
            <div>
              <label htmlFor="otp" className="block text-sm font-medium text-gray-700 mb-2">
                Codigo de Verificacion
              </label>
              <input
                ref={otpInputRef}
                id="otp"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                required
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-center text-2xl tracking-[0.5em] font-mono"
                placeholder="------"
              />
            </div>

            <button
              type="submit"
              disabled={loading || otp.length !== 6}
              className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Verificando...' : 'Verificar'}
            </button>

            {/* Resend */}
            <div className="text-center">
              {resendCountdown > 0 ? (
                <p className="text-sm text-gray-500">
                  Reenviar codigo en {resendCountdown}s
                </p>
              ) : (
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={loading}
                  className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                >
                  Reenviar codigo
                </button>
              )}
            </div>

            {/* Change number */}
            <button
              type="button"
              onClick={() => { setStep('phone'); setOtp(''); setError(''); }}
              className="w-full text-sm text-gray-500 hover:text-gray-700"
            >
              Cambiar numero
            </button>
          </form>
        )}

        {/* Back to login */}
        <div className="mt-6 text-center">
          <button
            onClick={onBackToLogin}
            className="text-sm text-gray-500 hover:text-gray-700 inline-flex items-center space-x-1"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Volver al login</span>
          </button>
        </div>
      </div>
    </div>
  );
}
