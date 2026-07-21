import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../hooks/useToast';
import { supabase } from '../lib/supabase';
import { Truck, MessageSquare, Mail, Phone, ShieldCheck, ArrowLeft, Loader2, Lock } from 'lucide-react';

export default function LoginPage() {
  const { signInWithPhone, signInWithEmail, verifyOtp, user, role } = useAuth();
  const { showSuccess, showError } = useToast();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<'driver' | 'owner' | 'dev'>('driver');
  const [phone, setPhone] = useState('');
  const [countryCode, setCountryCode] = useState('+1');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState<string[]>(Array(6).fill(''));
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (user && role) {
      if (role === 'owner') navigate('/owner/dashboard');
      else navigate('/driver/home');
    }
  }, [user, role, navigate]);

  // After a successful auth, look up role directly and redirect (don't wait on context)
  const redirectByRole = async (identifierEmail?: string) => {
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      let resolvedRole: string | null = null;
      if (authUser) {
        const { data: row } = await supabase.from('users').select('role').eq('id', authUser.id).maybeSingle();
        resolvedRole = row?.role ?? null;
        if (!resolvedRole && identifierEmail) {
          const { data: byEmail } = await supabase.from('users').select('role').eq('email', identifierEmail).maybeSingle();
          resolvedRole = byEmail?.role ?? null;
        }
      }
      if (resolvedRole === 'driver') navigate('/driver/home');
      else navigate('/owner/dashboard');
    } catch {
      navigate('/owner/dashboard');
    }
  };

  const handleRequestAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (activeTab === 'driver') {
        if (!phone) { showError('Please enter your phone number.'); setLoading(false); return; }
        const fullPhone = `${countryCode}${phone.replace(/\D/g, '')}`;
        const { error } = await signInWithPhone(fullPhone);
        if (error) throw error;
        showSuccess('Verification code sent to your phone!');
        setOtpSent(true);
      } else {
        if (!email) { showError('Please enter your email address.'); setLoading(false); return; }
        const { error } = await signInWithEmail(email);
        if (error) throw error;
        showSuccess('Verification code sent to your email!');
        setOtpSent(true);
      }
    } catch (err: any) {
      showError(err.message || 'Failed to send login request.');
    } finally {
      setLoading(false);
    }
  };

  const handleDevLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) { showError(error.message); setLoading(false); return; }
      await redirectByRole(email);
    } catch (err: any) {
      showError(err.message || 'Login failed.');
      setLoading(false);
    }
  };

  const handleOtpChange = (index: number, value: string) => {
    const cleanValue = value.replace(/\D/g, '');
    if (!cleanValue) {
      const newOtp = [...otp]; newOtp[index] = ''; setOtp(newOtp); return;
    }
    const newOtp = [...otp];
    newOtp[index] = cleanValue.substring(cleanValue.length - 1);
    setOtp(newOtp);
    if (index < 5 && cleanValue) otpRefs.current[index + 1]?.focus();
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) otpRefs.current[index - 1]?.focus();
  };

  const handleVerify = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const token = otp.join('');
    if (token.length < 6) { showError('Please enter the full 6-digit verification code.'); return; }
    setLoading(true);
    try {
      const identifier = activeTab === 'driver' ? `${countryCode}${phone.replace(/\D/g, '')}` : email;
      const { error } = await verifyOtp(identifier, token);
      if (error) throw error;
      showSuccess('Signed in successfully!');
      // small delay so the session is written before we navigate
      await new Promise((r) => setTimeout(r, 400));
      if (activeTab === 'driver') navigate('/driver/home');
      else navigate('/owner/dashboard');
    } catch (err: any) {
      showError(err.message || 'Invalid verification code.');
      setLoading(false);
    }
  };

  useEffect(() => {
    if (otp.join('').length === 6) handleVerify();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [otp]);

  return (
    <div className="flex items-center justify-center min-h-screen bg-navy-900 px-4 select-none">
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-brand-green/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-brand-green/5 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md bg-navy-800/40 border border-white/5 backdrop-blur-md rounded-3xl p-6 sm:p-8 shadow-2xl relative">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 justify-center mb-2">
            <Truck className="w-8 h-8 text-brand-green" />
            <h1 className="text-3xl font-extrabold tracking-tight font-sans">
              <span className="text-white">Truck</span><span className="text-brand-green">Desk</span>
            </h1>
          </div>
          <p className="text-xs text-gray-400 font-sans tracking-wide">Automated Backoffice for Owner-Operators & Fleets</p>
        </div>

        {!otpSent ? (
          <>
            <div className="grid grid-cols-3 bg-navy-900/60 p-1.5 rounded-2xl border border-white/5 mb-6">
              <button type="button" onClick={() => { setActiveTab('driver'); setEmail(''); setPassword(''); }}
                className={`py-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${activeTab === 'driver' ? 'bg-brand-green text-navy-900 shadow-lg' : 'text-gray-400 hover:text-white'}`}>
                <Phone className="w-3.5 h-3.5" /> Driver
              </button>
              <button type="button" onClick={() => { setActiveTab('owner'); setPhone(''); setPassword(''); }}
                className={`py-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${activeTab === 'owner' ? 'bg-brand-green text-navy-900 shadow-lg' : 'text-gray-400 hover:text-white'}`}>
                <Mail className="w-3.5 h-3.5" /> Fleet Owner
              </button>
              <button type="button" onClick={() => { setActiveTab('dev'); setPhone(''); }}
                className={`py-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${activeTab === 'dev' ? 'bg-brand-green text-navy-900 shadow-lg' : 'text-gray-400 hover:text-white'}`}>
                <Lock className="w-3.5 h-3.5" /> Dev Login
              </button>
            </div>

            {activeTab === 'dev' ? (
              <form onSubmit={handleDevLogin} className="space-y-5">
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest font-sans mb-2">Email</label>
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-navy-900 border border-white/5 hover:border-white/10 rounded-xl px-4 py-3.5 text-white text-sm focus:outline-none focus:border-brand-green focus:ring-1 focus:ring-brand-green"
                    placeholder="cagyekum26@gmail.com" required />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest font-sans mb-2">Password</label>
                  <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-navy-900 border border-white/5 hover:border-white/10 rounded-xl px-4 py-3.5 text-white text-sm focus:outline-none focus:border-brand-green focus:ring-1 focus:ring-brand-green"
                    placeholder="Password" required />
                </div>
                <button type="submit" disabled={loading}
                  className="w-full bg-brand-green hover:bg-brand-green/95 text-navy-900 font-bold py-3.5 rounded-xl transition-all shadow-lg flex items-center justify-center gap-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed">
                  {loading ? (<><Loader2 className="w-4 h-4 animate-spin" /> Signing In...</>) : 'Sign In'}
                </button>
              </form>
            ) : (
              <form onSubmit={handleRequestAuth} className="space-y-5">
                {activeTab === 'driver' ? (
                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest font-sans mb-2">Mobile Phone Number</label>
                    <div className="flex gap-2">
                      <select value={countryCode} onChange={(e) => setCountryCode(e.target.value)}
                        className="bg-navy-900 border border-white/5 hover:border-white/10 rounded-xl px-2 py-3.5 text-white text-xs sm:text-sm focus:outline-none focus:border-brand-green/60 text-center font-semibold">
                        <option value="+1">🇺🇸 +1</option>
                        <option value="+44">🇬🇧 +44</option>
                        <option value="+233">🇬🇭 +233</option>
                        <option value="+234">🇳🇬 +234</option>
                      </select>
                      <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)}
                        className="flex-1 bg-navy-900 border border-white/5 hover:border-white/10 rounded-xl px-4 py-3.5 text-white text-sm font-mono tracking-widest focus:outline-none focus:border-brand-green focus:ring-1 focus:ring-brand-green"
                        placeholder="e.g. 281-555-0199" required />
                    </div>
                    <p className="text-[10px] text-gray-500 mt-2 font-sans flex items-center gap-1.5"><MessageSquare className="w-3.5 h-3.5 text-brand-green" /> Verification code will be sent via SMS</p>
                  </div>
                ) : (
                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest font-sans mb-2">Fleet Owner Email Address</label>
                    <div className="relative">
                      <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                        className="w-full bg-navy-900 border border-white/5 hover:border-white/10 rounded-xl pl-11 pr-4 py-3.5 text-white text-sm focus:outline-none focus:border-brand-green focus:ring-1 focus:ring-brand-green"
                        placeholder="e.g. owner@fleetcompany.com" required />
                      <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                    </div>
                    <p className="text-[10px] text-gray-500 mt-2 font-sans flex items-center gap-1.5"><ShieldCheck className="w-3.5 h-3.5 text-brand-green" /> Verification code sent to inbox</p>
                  </div>
                )}
                <button type="submit" disabled={loading}
                  className="w-full bg-brand-green hover:bg-brand-green/95 text-navy-900 font-bold py-3.5 rounded-xl transition-all shadow-lg flex items-center justify-center gap-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed">
                  {loading ? (<><Loader2 className="w-4 h-4 animate-spin" /> Sending...</>) : activeTab === 'driver' ? 'Send OTP Code' : 'Send Magic Link'}
                </button>
              </form>
            )}
          </>
        ) : (
          <div className="space-y-6">
            <button onClick={() => { setOtpSent(false); setOtp(Array(6).fill('')); setLoading(false); }}
              className="inline-flex items-center gap-1.5 text-xs text-gray-400 hover:text-white transition-colors">
              <ArrowLeft className="w-4 h-4" /> Change Login Details
            </button>
            <div className="text-center">
              <h2 className="text-xl font-bold text-white font-sans">Enter Security Code</h2>
              <p className="text-xs text-gray-400 mt-1.5 max-w-xs mx-auto leading-relaxed">
                Enter the 6-digit code sent to <span className="text-white font-semibold">{activeTab === 'driver' ? `${countryCode} ${phone}` : email}</span>
              </p>
            </div>
            <form onSubmit={handleVerify} className="space-y-6">
              <div className="flex justify-between gap-2 max-w-sm mx-auto">
                {otp.map((digit, idx) => (
                  <input key={idx} ref={(el) => (otpRefs.current[idx] = el)}
                    type="text" maxLength={1} value={digit}
                    onChange={(e) => handleOtpChange(idx, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(idx, e)}
                    className="w-12 h-14 bg-navy-900 border border-white/5 focus:border-brand-green focus:ring-1 focus:ring-brand-green text-center text-xl font-extrabold rounded-xl text-white font-mono"
                    placeholder="-" disabled={loading} />
                ))}
              </div>
              <button type="submit" disabled={loading || otp.join('').length < 6}
                className="w-full bg-brand-green hover:bg-brand-green/95 text-navy-900 font-bold py-3.5 rounded-xl transition-all shadow-lg flex items-center justify-center gap-2 text-sm disabled:opacity-40 disabled:cursor-not-allowed">
                {loading ? (<><Loader2 className="w-4 h-4 animate-spin" /> Verifying...</>) : 'Verify Security Code'}
              </button>
              <div className="text-center">
                <button type="button" onClick={handleRequestAuth} disabled={loading}
                  className="text-xs text-brand-green hover:underline font-semibold">Resend verification code</button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
