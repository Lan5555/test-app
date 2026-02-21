'use client';

import React, { useEffect, useState } from 'react';
import { Globe, Lock, AlertCircle, CheckCircle, ArrowLeft, Sparkles, CreditCard, Smartphone } from 'lucide-react';
import { FlutterWaveButton, closePaymentModal } from 'flutterwave-react-v3';
import { convertFromNaira } from '../helpers/converter';

interface Props {
  name: string;
  amount: number;
  email: string;
  phone?: string;
  onClose: () => void;
  callback: () => void;
}

interface PaymentState {
  currency: string;
  phoneNumber: string;
  isProcessing: boolean;
  error: string;
  success: boolean;
}

const SUPPORTED_CURRENCIES = [
  { code: 'NGN', label: 'Nigerian Naira', symbol: '₦' },
  { code: 'USD', label: 'US Dollar', symbol: '$' },
  { code: 'EUR', label: 'Euro', symbol: '€' },
  { code: 'GBP', label: 'British Pound', symbol: '£' },
  { code: 'HUF', label: 'Hungarian Forint', symbol: 'Ft' },
  { code: 'KES', label: 'Kenyan Shilling', symbol: 'KSh' },
  { code: 'GHS', label: 'Ghanaian Cedi', symbol: '₵' },
];

export const InitializePayment: React.FC<Props> = ({
  name,
  amount,
  email,
  phone,
  onClose,
  callback,
}) => {
  const [state, setState] = useState<PaymentState>({
    currency: 'NGN',
    phoneNumber: '',
    isProcessing: false,
    error: '',
    success: false,
  });

  const currencyData = SUPPORTED_CURRENCIES.find(c => c.code === state.currency)!;

  const handlePhoneChange = (value: string) => {
    setState(prev => ({ ...prev, phoneNumber: value.replace(/\D/g, ''), error: '' }));
  };

  useEffect(() => {
    if (phone) {
      setState(prev => ({ ...prev, phoneNumber: phone.replace(/\D/g, '') }));
    }
  },[]);

  const handleCurrencyChange = (value: string) => {
    setState(prev => ({ ...prev, currency: value, error: '' }));
  };

  const validateForm = () => {
    if (!state.phoneNumber) {
      setState(prev => ({ ...prev, error: 'Phone number is required' }));
      return false;
    }
    if (state.phoneNumber.length < 10) {
      setState(prev => ({ ...prev, error: 'Phone number must be at least 10 digits' }));
      return false;
    }
    return true;
  };

  const handleReset = () => {
    setState({
      currency: 'NGN',
      phoneNumber: '',
      isProcessing: false,
      error: '',
      success: false,
    });
  };

  const handlePayClick = () => {
    if (!validateForm()) return;
    setState(prev => ({ ...prev, isProcessing: true, error: '' }));
  };

  const amountValue = convertFromNaira(amount, currencyData.code);

  const config = {
    public_key: process.env.NEXT_PUBLIC_PAYMENT_KEY!,
    tx_ref: `tx-${Date.now()}`,
    amount: Math.round(amountValue.amount),
    currency: state.currency,
    payment_options: 'card,ussd,banktransfer',
    customer: {
      email,
      name,
      phone_number: state.phoneNumber,
    },
    customizations: {
      title: 'Quiz Enhancements',
      description: `Payment for ${name}`,
      logo: '',
    },
    callback: (response: any) => {
      callback();
      setState(prev => ({ ...prev, success: true }));
      closePaymentModal();
      setState(prev => ({ ...prev, isProcessing: false }));
    },
    onClose: () => {
      setState(prev => ({ ...prev, isProcessing: false }));
    },
    text: 'Click to pay now'
  };

  // ================= SUCCESS SCREEN =================
  if (state.success) {
    return (
      <>
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Sans:wght@300;400;500&display=swap');
          @keyframes scaleIn { from { opacity:0; transform:scale(0.88) translateY(12px); } to { opacity:1; transform:scale(1) translateY(0); } }
          @keyframes checkPop { 0% { transform:scale(0) rotate(-15deg); } 70% { transform:scale(1.2) rotate(5deg); } 100% { transform:scale(1) rotate(0); } }
          @keyframes fadeUp { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
          .pay-anim { animation: scaleIn 0.35s cubic-bezier(0.34,1.56,0.64,1) forwards; }
          .check-anim { animation: checkPop 0.5s cubic-bezier(0.34,1.56,0.64,1) 0.2s both; }
          .row-anim-1 { animation: fadeUp 0.4s ease 0.3s both; }
          .row-anim-2 { animation: fadeUp 0.4s ease 0.4s both; }
          .row-anim-3 { animation: fadeUp 0.4s ease 0.5s both; }
        `}</style>
        <div className="pay-anim w-full max-w-sm mx-auto" style={{ fontFamily: "'DM Sans', sans-serif" }}>
          <div style={{ background: '#0f0f13', borderRadius: '24px', overflow: 'hidden', boxShadow: '0 32px 80px rgba(0,0,0,0.45), 0 0 0 1px rgba(255,255,255,0.06)' }}>

            {/* Success Header */}
            <div style={{ padding: '40px 28px 28px', textAlign: 'center', background: 'linear-gradient(160deg, #0f0f13 0%, #151520 100%)', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
              <div className="check-anim" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 72, height: 72, borderRadius: '50%', background: 'linear-gradient(135deg, #00c896, #00a37a)', boxShadow: '0 0 40px rgba(0,200,150,0.35)', marginBottom: 16 }}>
                <CheckCircle style={{ width: 36, height: 36, color: '#fff' }} />
              </div>
              <h2 style={{ fontFamily: "'Syne', sans-serif", fontSize: 22, fontWeight: 800, color: '#fff', margin: '0 0 6px' }}>Payment Successful</h2>
              <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)', margin: 0 }}>Transaction completed securely</p>
            </div>

            {/* Details */}
            <div style={{ padding: '24px 28px 28px', display: 'flex', flexDirection: 'column', gap: 14 }}>

              <div className="row-anim-1" style={{ background: 'rgba(0,200,150,0.08)', border: '1px solid rgba(0,200,150,0.2)', borderRadius: 14, padding: '12px 16px', textAlign: 'center' }}>
                <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', marginBottom: 4, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Transaction ID</p>
                <p style={{ fontFamily: "'Syne', sans-serif", fontSize: 13, fontWeight: 700, color: '#00c896', letterSpacing: '0.05em' }}>TX-{Date.now()}</p>
              </div>

              <div className="row-anim-2" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {[
                  { label: 'Product', value: name },
                  { label: 'Amount', value: amountValue.symbolWithText, accent: true },
                  { label: 'Currency', value: state.currency },
                ].map(({ label, value, accent }) => (
                  <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                    <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>{label}</span>
                    <span style={{ fontSize: 13, fontWeight: 600, color: accent ? '#a78bfa' : 'rgba(255,255,255,0.85)' }}>{value}</span>
                  </div>
                ))}
              </div>

              <div className="row-anim-3" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: '12px 14px' }}>
                <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginBottom: 4 }}>Confirmation sent to</p>
                <p style={{ fontSize: 12, fontWeight: 500, color: 'rgba(255,255,255,0.7)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{email}</p>
              </div>

              <button
                onClick={handleReset}
                style={{ width: '100%', background: 'linear-gradient(135deg, #7c3aed, #a855f7)', color: '#fff', fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 14, padding: '14px', borderRadius: 14, border: 'none', cursor: 'pointer', letterSpacing: '0.03em', boxShadow: '0 8px 24px rgba(124,58,237,0.4)', transition: 'transform 0.15s ease, box-shadow 0.15s ease' }}
                onMouseEnter={e => { (e.target as HTMLButtonElement).style.transform = 'translateY(-1px)'; (e.target as HTMLButtonElement).style.boxShadow = '0 12px 32px rgba(124,58,237,0.5)'; }}
                onMouseLeave={e => { (e.target as HTMLButtonElement).style.transform = 'translateY(0)'; (e.target as HTMLButtonElement).style.boxShadow = '0 8px 24px rgba(124,58,237,0.4)'; }}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      </>
    );
  }

  // ================= PAYMENT FORM =================
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Sans:wght@300;400;500&display=swap');
        @keyframes modalIn { from { opacity:0; transform:translateY(16px) scale(0.97); } to { opacity:1; transform:translateY(0) scale(1); } }
        @keyframes shimmer { 0%,100% { opacity:0.4; } 50% { opacity:0.8; } }
        .pay-modal { animation: modalIn 0.3s cubic-bezier(0.34,1.2,0.64,1) forwards; }
        .pay-input:focus { outline: none; border-color: #7c3aed !important; box-shadow: 0 0 0 3px rgba(124,58,237,0.18) !important; }
        .pay-input::placeholder { color: rgba(255,255,255,0.25) !important; }
        .pay-select option { background: #1a1a24; color: #fff; }
        .pay-close-btn:hover { background: rgba(255,255,255,0.12) !important; }
        .pay-primary-btn:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 14px 36px rgba(124,58,237,0.5) !important; }
        .pay-primary-btn:active:not(:disabled) { transform: translateY(0px); }
        .pay-flw-btn:hover { transform: translateY(-1px); }
      `}</style>
      <div className="pay-modal w-full max-w-sm mx-auto" style={{ fontFamily: "'DM Sans', sans-serif", zIndex: 40, position: 'relative' }}>
        <div style={{ background: '#0f0f13', borderRadius: '24px', overflow: 'hidden', boxShadow: '0 32px 80px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.06)' }}>

          {/* Close button */}
          <button
            className="pay-close-btn"
            onClick={onClose}
            style={{ position: 'absolute', top: 14, right: 14, background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '50%', width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'rgba(255,255,255,0.6)', transition: 'background 0.15s ease', zIndex: 10 }}
          >
            <ArrowLeft size={16} />
          </button>

          {/* Header */}
          <div style={{ padding: '32px 28px 24px', background: 'linear-gradient(160deg, #0f0f13 0%, #16131f 100%)', borderBottom: '1px solid rgba(255,255,255,0.07)', position: 'relative', overflow: 'hidden' }}>
            {/* Decorative orb */}
            <div style={{ position: 'absolute', top: -30, right: -20, width: 130, height: 130, borderRadius: '50%', background: 'radial-gradient(circle, rgba(124,58,237,0.25) 0%, transparent 70%)', pointerEvents: 'none' }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#7c3aed', boxShadow: '0 0 10px rgba(124,58,237,0.8)' }} />
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 500 }}>Secure Checkout</span>
            </div>
            <h2 style={{ fontFamily: "'Syne', sans-serif", fontSize: 24, fontWeight: 800, color: '#fff', margin: 0, lineHeight: 1.1 }}>Complete Payment</h2>
          </div>

          {/* Body */}
          <div style={{ padding: '22px 28px 28px', display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* Order Summary Card */}
            <div style={{ background: 'rgba(124,58,237,0.1)', border: '1px solid rgba(124,58,237,0.25)', borderRadius: 16, padding: '16px 18px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 4, letterSpacing: '0.04em' }}>Quiz Enhancements</p>
                  <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', marginBottom: 6 }}>Price converted to local currency</p>
                  <p style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 15, color: 'rgba(255,255,255,0.9)', margin: 0 }}>{name}</p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginBottom: 4 }}>{state.currency}</p>
                  <p style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: 22, color: '#a78bfa', margin: 0, lineHeight: 1 }}>{amountValue.symbolWithText}</p>
                </div>
              </div>
            </div>

            {/* Error */}
            {state.error && (
              <div style={{ display: 'flex', gap: 10, padding: '12px 14px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 12 }}>
                <AlertCircle style={{ width: 16, height: 16, color: '#f87171', flexShrink: 0, marginTop: 1 }} />
                <p style={{ fontSize: 13, color: '#fca5a5', fontWeight: 500, margin: 0 }}>{state.error}</p>
              </div>
            )}

            {/* Fields */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

              {/* Currency */}
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.55)', marginBottom: 8, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Currency</label>
                <div style={{ position: 'relative' }}>
                  <select
                    className="pay-input pay-select"
                    value={state.currency}
                    onChange={(e) => handleCurrencyChange(e.target.value)}
                    disabled={state.isProcessing}
                    style={{ width: '100%', padding: '12px 40px 12px 16px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, color: '#fff', fontSize: 14, appearance: 'none', cursor: 'pointer', transition: 'border-color 0.2s, box-shadow 0.2s' }}
                  >
                    {SUPPORTED_CURRENCIES.map((c) => (
                      <option key={c.code} value={c.code}>{c.label} ({c.code})</option>
                    ))}
                  </select>
                  <Globe style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', width: 16, height: 16, color: 'rgba(255,255,255,0.35)', pointerEvents: 'none' }} />
                </div>
              </div>

              {/* Phone */}
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.55)', marginBottom: 8, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Phone Number</label>
                <div style={{ position: 'relative' }}>
                  <input
                    className="pay-input"
                    type="tel"
                    value={state.phoneNumber}
                    onChange={(e) => handlePhoneChange(e.target.value)}
                    placeholder="Enter phone number"
                    disabled={state.isProcessing}
                    style={{ width: '100%', padding: '12px 40px 12px 16px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, color: '#fff', fontSize: 14, transition: 'border-color 0.2s, box-shadow 0.2s', boxSizing: 'border-box' }}
                  />
                  <Smartphone style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', width: 16, height: 16, color: 'rgba(255,255,255,0.35)', pointerEvents: 'none' }} />
                </div>
              </div>
            </div>

            {/* Security badge */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 14px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12 }}>
              <div style={{ width: 30, height: 30, borderRadius: 8, background: 'rgba(124,58,237,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Lock style={{ width: 14, height: 14, color: '#a78bfa' }} />
              </div>
              <div>
                <p style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.7)', margin: '0 0 2px' }}>256-bit Encrypted</p>
                <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', margin: 0 }}>Your information is fully protected</p>
              </div>
            </div>

            {/* Buttons */}
            {state.isProcessing && (
                <FlutterWaveButton
                  {...config}
                  className="p-2 w-full bg-linear-to-br transition-all duration-300 ease-out
                hover:-translate-y-1
                hover:shadow-[0_12px_32px_rgba(16,185,129,0.45)]
                hover:from-emerald-500 hover:to-emerald-400 from-emerald-600 to-emerald-500 rounded-[14px] shadow-[0_8px_24px_rgba(16,185,129,0.35)] overflow-hidden"
                >
                  <Sparkles size={15} /> Click to Pay Now
                </FlutterWaveButton>
              
            )}

            {!state.isProcessing && (
              <button
                className="pay-primary-btn"
                onClick={handlePayClick}
                disabled={state.isProcessing}
                style={{ width: '100%', background: 'linear-gradient(135deg, #7c3aed, #a855f7)', color: '#fff', fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 14, padding: '14px', borderRadius: 14, border: 'none', cursor: 'pointer', letterSpacing: '0.04em', boxShadow: '0 8px 24px rgba(124,58,237,0.4)', transition: 'transform 0.15s ease, box-shadow 0.15s ease', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
              >
                <CreditCard size={16} /> Verify & Continue
              </button>
            )}

            {/* Payment methods */}
            <div style={{ paddingTop: 4, borderTop: '1px solid rgba(255,255,255,0.07)', textAlign: 'center' }}>
              <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.05em', margin: 0 }}>CARD · USSD · BANK TRANSFER</p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};