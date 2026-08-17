import React, { useState, useEffect } from 'react';
import { useGoogleLogin } from '@react-oauth/google';
import { API_BASE_URL } from '../api/apiClient';

const SimpleToast = ({ message, type = 'info', onClose }) => {
  useEffect(() => {
    const timer = setTimeout(onClose, 4000);
    return () => clearTimeout(timer);
  }, [onClose]);

  const colors = {
    error: 'bg-rose-500 text-white',
    success: 'bg-emerald-600 text-white',
    warning: 'bg-amber-500 text-white',
    info: 'bg-slate-800 text-white'
  };

  return (
    <div className={`fixed top-6 right-6 z-[99999] px-5 py-3 rounded-xl shadow-2xl ${colors[type]} animate-slide-down flex items-center gap-3`}>
      <span className="text-sm font-semibold">{message}</span>
      <button onClick={onClose} className="ml-2 opacity-70 hover:opacity-100">✕</button>
    </div>
  );
};

const Login = () => {
  const [view, setView] = useState('login'); // 'login', 'signup', 'forgot'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [toast, setToast] = useState(null);

  const showMsg = (msg, type = 'info') => setToast({ message: msg, type });

  const navigateTo = (path) => {
    window.history.pushState(null, '', path);
    window.dispatchEvent(new Event('navigate'));
  };

  const handleGoogleSuccess = async (tokenResponse) => {
    const AUTH_URL = `${API_BASE_URL}/Auth`;
    try {
      // Gửi access_token về Backend
      const response = await fetch(`${AUTH_URL}/google-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: tokenResponse.access_token }),
      });

      if (response.ok) {
        const data = await response.json();
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data));

        const rolePaths = {
          'Admin': '/admin',
          'Manager': '/farm-manager',
          'Technician': '/technician',
          'Researcher': '/researcher',
          'Student': '/student'
        };
        navigateTo(rolePaths[data.role] || '/');
      } else {
        showMsg('Google Login failed at backend!', 'error');
      }
    } catch (err) {
      console.error(err);
      showMsg('Connection failed!', 'error');
    }
  };

  const loginWithGoogle = useGoogleLogin({
    onSuccess: handleGoogleSuccess,
    onError: () => showMsg('Google Login Failed', 'error'),
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    const AUTH_URL = `${API_BASE_URL}/Auth`;

    try {
      if (view === 'login') {
        const response = await fetch(`${AUTH_URL}/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
        });

        if (response.ok) {
          const data = await response.json();
          localStorage.setItem('token', data.token);
          localStorage.setItem('user', JSON.stringify(data));
          const rolePaths = {
            'Admin': '/admin',
            'Manager': '/farm-manager',
            'Technician': '/technician',
            'Researcher': '/researcher',
            'Student': '/student'
          };
          navigateTo(rolePaths[data.role] || '/');
        } else {
          const error = await response.json();
          showMsg(error.message || 'Login failed!', 'error');
        }
      } else if (view === 'signup') {
        if (password !== confirmPassword) {
          showMsg('Passwords do not match!', 'warning');
          return;
        }

        const response = await fetch(`${AUTH_URL}/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fullName: name, email, password, role: 'Student' }),
        });

        if (response.ok) {
          showMsg('Registration successful! Please sign in.', 'success');
          setView('login');
        } else {
          const error = await response.json();
          showMsg(error.message || 'Registration failed!', 'error');
        }
      } else if (view === 'forgot') {
        const response = await fetch(`${AUTH_URL}/forgot-password`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email }),
        });
        if (response.ok) {
          showMsg('Mã xác nhận đã được gửi về Email của bạn!', 'success');
          setView('verify_code');
        } else {
          const error = await response.json();
          showMsg(error.message || 'Gửi mail thất bại!', 'error');
        }
      } else if (view === 'verify_code') {
        const response = await fetch(`${AUTH_URL}/verify-code`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, code: otpCode }),
        });
        if (response.ok) {
          setView('reset_password');
        } else {
          const error = await response.json();
          showMsg(error.message || 'Mã xác nhận không đúng!', 'error');
        }
      } else if (view === 'reset_password') {
        if (password !== confirmPassword) {
          showMsg('Mật khẩu không khớp!', 'warning');
          return;
        }
        const response = await fetch(`${AUTH_URL}/reset-password`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, code: otpCode, newPassword: password }),
        });
        if (response.ok) {
          showMsg('Mật khẩu đã được đổi thành công!', 'success');
          setView('login');
        } else {
          const error = await response.json();
          showMsg(error.message || 'Đổi mật khẩu thất bại!', 'error');
        }
      }
    } catch (err) {
      console.error(err);
      showMsg('Lỗi kết nối Server!', 'error');
    }
  };

  const renderGoogleButton = () => (
    <div className="mb-8">
      <button 
        type="button" 
        onClick={() => loginWithGoogle()}
        className="w-full flex items-center justify-center gap-3 bg-white border border-gray-200 rounded-xl py-3.5 px-4 text-sm font-semibold text-gray-700 hover:bg-gray-50 hover:border-gray-300 hover:-translate-y-px transition-all active:scale-[0.98]"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
        </svg>
        Continue with Google
      </button>
    </div>
  );

  return (
    <div className="flex min-h-screen w-screen font-sans bg-white overflow-hidden fixed inset-0 z-[9999]">
      {toast && <SimpleToast {...toast} onClose={() => setToast(null)} />}
      {/* Left Side: Image & Branding */}
      <div className="hidden lg:flex flex-1 relative flex-col bg-[#f0f2f5] bg-cover bg-center" style={{ backgroundImage: "url('/background/background-login.jpg')" }}>
        <div className="flex-1 bg-gradient-to-b from-black/10 to-black/70 flex flex-col justify-between p-14 text-white">
          <div className="animate-slide-up">
            <h1 className="font-serif text-5xl font-bold mb-4 tracking-tight">Smart Farm</h1>
            <p className="text-lg font-light opacity-90 max-w-md leading-relaxed">The future of agriculture, visualized.</p>
          </div>
          <div className="opacity-60 text-sm font-light">
            <p>© 2026 SEP490 Project</p>
          </div>
        </div>
      </div>

      {/* Right Side: Form */}
      <div className="w-full lg:w-[550px] bg-white flex flex-col relative flex-shrink-0">
        <button 
          className="absolute top-8 left-8 bg-white/80 backdrop-blur-md border border-black/10 text-slate-800 text-[13px] font-semibold cursor-pointer flex items-center gap-2.5 transition-all duration-300 py-2.5 px-5 rounded-full z-[10000] shadow-sm hover:bg-slate-900 hover:text-white hover:-translate-x-1 hover:shadow-lg uppercase tracking-wider group"
          onClick={() => navigateTo('/')}
        >
          <svg className="group-hover:-translate-x-1 transition-transform" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="19" y1="12" x2="5" y2="12"></line>
            <polyline points="12 19 5 12 12 5"></polyline>
          </svg>
          Simulation
        </button>

        <div className="flex-1 flex flex-col justify-center px-8 sm:px-20 animate-slide-right">
          <div className="mb-10">
            <h2 className="text-3xl font-bold text-slate-900 mb-3 tracking-tight">
              {view === 'login' ? 'Welcome back' : 'Reset password'}
            </h2>
            <p className="text-[15px] text-gray-500">
              {view === 'login' ? 'Please enter your details to sign in.' : 'Enter your email to receive a reset link.'}
            </p>
          </div>

          {view === 'login' && renderGoogleButton()}

          {view === 'login' && (
            <div className="flex items-center text-center text-gray-400 text-[13px] mb-8 after:content-[''] after:flex-1 after:border-b after:border-gray-200 before:content-[''] before:flex-1 before:border-b before:border-gray-200">
              <span className="px-4">or sign in with email</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-6">
            {view === 'signup' && (
              <div className="relative group">
                <input 
                  type="text" 
                  id="name" 
                  className="w-full pt-5 pb-2 px-4 text-[15px] border border-gray-200 rounded-xl bg-white text-slate-900 focus:outline-none focus:border-emerald-600 focus:ring-4 focus:ring-emerald-600/10 transition-all peer placeholder-transparent autofill:shadow-[inset_0_0_0_1000px_white] autofill:text-slate-900"
                  placeholder="Full Name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required 
                />
                <label 
                  htmlFor="name" 
                  className="absolute left-4 top-1.5 text-gray-500 text-[11px] transition-all pointer-events-none 
                             peer-placeholder-shown:text-[15px] peer-placeholder-shown:top-4 peer-placeholder-shown:text-gray-400
                             peer-focus:top-1.5 peer-focus:text-[11px] peer-focus:text-gray-600
                             peer-autofill:top-1.5 peer-autofill:text-[11px]"
                >
                  Full Name
                </label>
              </div>
            )}

            {view === 'verify_code' && (
              <div className="relative group">
                <input 
                  type="text" 
                  id="otpCode" 
                  className="w-full pt-5 pb-2 px-4 text-[15px] border border-gray-200 rounded-xl bg-white text-slate-900 focus:outline-none focus:border-emerald-600 focus:ring-4 focus:ring-emerald-600/10 transition-all peer placeholder-transparent autofill:shadow-[inset_0_0_0_1000px_white] autofill:text-slate-900"
                  placeholder="Mã xác nhận 6 số"
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value)}
                  required 
                />
                <label 
                  htmlFor="otpCode" 
                  className="absolute left-4 top-1.5 text-gray-500 text-[11px] transition-all pointer-events-none 
                             peer-placeholder-shown:text-[15px] peer-placeholder-shown:top-4 peer-placeholder-shown:text-gray-400
                             peer-focus:top-1.5 peer-focus:text-[11px] peer-focus:text-gray-600
                             peer-autofill:top-1.5 peer-autofill:text-[11px]"
                >
                  Mã xác nhận 6 số
                </label>
              </div>
            )}

            {(view === 'login' || view === 'forgot') && (
              <div className="relative group">
                <input 
                  type="email" 
                  id="email" 
                  className="w-full pt-5 pb-2 px-4 text-[15px] border border-gray-200 rounded-xl bg-white text-slate-900 focus:outline-none focus:border-emerald-600 focus:ring-4 focus:ring-emerald-600/10 transition-all peer placeholder-transparent autofill:shadow-[inset_0_0_0_1000px_white] autofill:text-slate-900"
                  placeholder="Email address"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required 
                  readOnly={view === 'verify_code' || view === 'reset_password'}
                />
                <label 
                  htmlFor="email" 
                  className="absolute left-4 top-1.5 text-gray-500 text-[11px] transition-all pointer-events-none 
                             peer-placeholder-shown:text-[15px] peer-placeholder-shown:top-4 peer-placeholder-shown:text-gray-400
                             peer-focus:top-1.5 peer-focus:text-[11px] peer-focus:text-gray-600
                             peer-autofill:top-1.5 peer-autofill:text-[11px]"
                >
                  Email address
                </label>
              </div>
            )}
            
            {(view === 'login' || view === 'reset_password') && (
              <div className="relative group">
                <input 
                  type={showPassword ? "text" : "password"} 
                  id="password" 
                  className="w-full pt-5 pb-2 px-4 text-[15px] border border-gray-200 rounded-xl bg-white text-slate-900 focus:outline-none focus:border-emerald-600 focus:ring-4 focus:ring-emerald-600/10 transition-all peer placeholder-transparent autofill:shadow-[inset_0_0_0_1000px_white] autofill:text-slate-900"
                  placeholder={view === 'reset_password' ? "Mật khẩu mới" : "Password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required 
                />
                <label 
                  htmlFor="password" 
                  className="absolute left-4 top-1.5 text-gray-500 text-[11px] transition-all pointer-events-none 
                             peer-placeholder-shown:text-[15px] peer-placeholder-shown:top-4 peer-placeholder-shown:text-gray-400
                             peer-focus:top-1.5 peer-focus:text-[11px] peer-focus:text-gray-600
                             peer-autofill:top-1.5 peer-autofill:text-[11px]"
                >
                  {view === 'reset_password' ? "Mật khẩu mới" : "Password"}
                </label>
                <button 
                  type="button" 
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-slate-900 transition-colors p-1"
                  onClick={() => setShowPassword(!showPassword)}
                  tabIndex="-1"
                >
                  {showPassword ? (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>
                  ) : (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                  )}
                </button>
              </div>
            )}

            {view === 'reset_password' && (
              <div className="relative group">
                <input 
                  type={showPassword ? "text" : "password"} 
                  id="confirmPassword" 
                  className="w-full pt-5 pb-2 px-4 text-[15px] border border-gray-200 rounded-xl bg-white text-slate-900 focus:outline-none focus:border-emerald-600 focus:ring-4 focus:ring-emerald-600/10 transition-all peer placeholder-transparent autofill:shadow-[inset_0_0_0_1000px_white] autofill:text-slate-900"
                  placeholder="Confirm Password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required 
                />
                <label 
                  htmlFor="confirmPassword" 
                  className="absolute left-4 top-1.5 text-gray-500 text-[11px] transition-all pointer-events-none 
                             peer-placeholder-shown:text-[15px] peer-placeholder-shown:top-4 peer-placeholder-shown:text-gray-400
                             peer-focus:top-1.5 peer-focus:text-[11px] peer-focus:text-gray-600
                             peer-autofill:top-1.5 peer-autofill:text-[11px]"
                >
                  Confirm Password
                </label>
              </div>
            )}
            
            {view === 'login' && (
              <div className="flex justify-between items-center -mt-2">
                <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                  <input type="checkbox" className="w-4 h-4 accent-emerald-600 cursor-pointer rounded" />
                  Remember me
                </label>
                <a href="#" className="text-sm text-emerald-600 font-semibold hover:underline" onClick={(e) => { e.preventDefault(); setView('forgot'); }}>Forgot password?</a>
              </div>
            )}
            
            <button type="submit" className="bg-slate-900 text-white p-4 rounded-xl text-[15px] font-semibold transition-all duration-300 mt-2 hover:bg-emerald-700 hover:-translate-y-0.5 hover:shadow-lg active:scale-[0.98]">
              {view === 'login' ? 'Sign In' : 'Reset Password'}
            </button>
          </form>



          <p className="mt-8 text-center text-sm text-gray-500">
            {view === 'forgot' && (
              <>Remember your password? <a href="#" className="text-slate-900 font-semibold hover:underline" onClick={(e) => { e.preventDefault(); setView('login'); }}>Back to login</a></>
            )}
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
