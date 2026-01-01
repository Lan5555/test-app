'use client';

import React, { useState } from 'react';
import { Globe, Lock, AlertCircle, CheckCircle, ArrowLeft } from 'lucide-react';
import { FlutterWaveButton, closePaymentModal } from 'flutterwave-react-v3';
import { convertFromNaira } from '../helpers/converter';

interface Props {
  name: string;
  amount: number;
  email: string;
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
     
        callback(); // ✅ Now fires
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
      <div className="w-full max-w-md mx-auto">
        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
          <div className="bg-linear-to-r from-green-500 to-emerald-600 px-6 py-4 text-center text-white">
            <div className="flex justify-center mb-2">
              <CheckCircle className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-bold mb-0.5">Payment Successful!</h2>
            <p className="text-green-100 text-xs">Transaction completed</p>
          </div>
          <div className="p-4 space-y-3">
            <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-center">
              <p className="text-xs text-green-700 mb-1">Transaction ID</p>
              <p className="text-sm font-bold text-green-600 font-mono">TX-{Date.now()}</p>
            </div>
            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-gray-600">Product</span>
                <span className="font-semibold text-gray-800">{name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Amount</span>
                <span className="font-semibold text-indigo-600">
                  {amountValue.symbolWithText}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Currency</span>
                <span className="font-semibold text-gray-800">{state.currency}</span>
              </div>
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-2">
              <p className="text-xs text-gray-600">Confirmation email sent to</p>
              <p className="text-xs font-semibold text-gray-800 truncate">{email}</p>
            </div>
            <button
              onClick={handleReset}
              className="w-full bg-linear-to-r from-indigo-600 to-purple-600 text-white font-semibold py-2 rounded-lg hover:shadow-lg transition text-sm"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ================= PAYMENT FORM =================
  return (
    <div className="w-full max-w-sm mx-auto">
      <div className="bg-white rounded-2xl shadow-2xl overflow-hidden relative">
        <button className='rounded-full p-2 shadow absolute top-2 right-2 text-black cursor-pointer' onClick={onClose}><ArrowLeft /></button>

        {/* Header */}
        <div className="bg-linear-to-r from-indigo-600 to-purple-600 px-5 py-4 text-white">
          <h2 className="text-xl font-bold">Complete Payment</h2>
          <p className="text-indigo-100 text-xs">Secure payment</p>
        </div>

        {/* Content */}
        <div className="p-4 space-y-3">

          {/* Order Summary */}
          <div className="bg-indigo-50 rounded-lg p-3 border border-indigo-200">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-xs text-gray-600">Paying for quiz enhancements</p>
                <p className="text-[8pt] text-gray-600">Note: price will be converted to local currency</p>
                <p className="font-semibold text-gray-800 text-sm">{name}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-600">{state.currency}</p>
                <p className='text-xl text-indigo-500'>{amountValue.symbolWithText}</p> 
              </div>
            </div>
          </div>

          {/* Error Message */}
          {state.error && (
            <div className="flex gap-2 p-2 bg-red-50 border-l-4 border-red-500 rounded">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <p className="text-red-700 font-medium text-xs">{state.error}</p>
            </div>
          )}

          {/* Form Fields */}
          <div className="space-y-2.5">

            {/* Currency Selector */}
            <div>
              <label className="text-xs font-semibold text-gray-800 mb-1 block">Currency</label>
              <div className="relative">
                <select
                  value={state.currency}
                  onChange={(e) => handleCurrencyChange(e.target.value)}
                  disabled={state.isProcessing}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-transparent transition bg-white text-gray-800 text-sm appearance-none cursor-pointer disabled:opacity-50"
                >
                  {SUPPORTED_CURRENCIES.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.label} ({c.code})
                    </option>
                  ))}
                </select>
                <Globe className="absolute right-2 top-2.5 w-4 h-4 text-gray-400 pointer-events-none" />
              </div>
            </div>

            {/* Phone Number Input */}
            <div>
              <label className="text-xs font-semibold text-gray-800 mb-1 block">Phone Number</label>
              <input
                type="tel"
                value={state.phoneNumber}
                onChange={(e) => handlePhoneChange(e.target.value)}
                placeholder="Enter phone number"
                disabled={state.isProcessing}
                className="w-full px-3 py-2 border text-black placeholder:text-black border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-transparent transition text-sm disabled:opacity-50"
                required
              />
            </div>
          </div>

          {/* Security Notice */}
          <div className="flex gap-2 p-2 bg-blue-50 border border-blue-200 rounded text-xs">
            <Lock className="w-3.5 h-3.5 text-blue-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-blue-900">Secure & Encrypted</p>
              <p className="text-blue-700">Your information is protected</p>
            </div>
          </div>

          {/* FlutterWave Button */}
          {state.isProcessing && <FlutterWaveButton {...config} className='w-full bg-linear-to-r from-green-600 to-purple-600 text-white font-semibold py-2.5 rounded-lg hover:shadow-lg transition-all flex items-center justify-center gap-2 text-sm disabled:opacity-60 disabled:cursor-not-allowed'>
             Click to pay
            </FlutterWaveButton>}

          {!state.isProcessing && <button
            onClick={handlePayClick}
            disabled={state.isProcessing}
            className="w-full bg-linear-to-r from-indigo-600 to-purple-600 text-white font-semibold py-2.5 rounded-lg hover:shadow-lg transition-all flex items-center justify-center gap-2 text-sm disabled:opacity-60 disabled:cursor-not-allowed"
          >
           Verify
          </button>}

          {/* Payment Methods */}
          <div className="pt-2 border-t border-gray-200 text-center">
            <p className="text-xs text-gray-600 font-semibold mb-2">Accepted: Card • USSD • Transfer</p>
          </div>

        </div>
      </div>
    </div>
  );
};
