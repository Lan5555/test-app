import React, { useState } from 'react';
import { X, Mail, User, Key, Plus, Loader } from 'lucide-react';

interface UserFormData {
  email: string;
  name: string;
  code?: string;
}

interface AddUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (userData: UserFormData) => Promise<void>;
  quizCode?: string;
  isLoading?: boolean;
}

interface FormErrors {
  email?: string;
  name?: string;
  code?: string;
}

const AddUserModal: React.FC<AddUserModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  quizCode,
  isLoading = false
}) => {
  const [formData, setFormData] = useState<UserFormData>({
    email: '',
    name: '',
    code: quizCode || ''
  });

  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!validateEmail(formData.email)) {
      newErrors.email = 'Please enter a valid email';
    }

    if (!formData.name.trim()) {
      newErrors.name = 'Name is required';
    } else if (formData.name.trim().length < 2) {
      newErrors.name = 'Name must be at least 2 characters';
    }

    if (formData.code && formData.code.trim().length !== 6) {
      newErrors.code = 'Quiz code must be exactly 6 characters';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'code' ? value.toUpperCase() : value
    }));

    // Clear error for this field when user starts typing
    if (errors[name as keyof FormErrors]) {
      setErrors(prev => ({
        ...prev,
        [name]: undefined
      }));
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit(formData);
      resetForm();
    } catch (error) {
      console.error('Error submitting form:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = (): void => {
    setFormData({
      email: '',
      name: '',
      code: quizCode || ''
    });
    setErrors({});
    onClose();
  };

  const handleClose = (): void => {
    resetForm();
    onClose();
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 overflow-y-auto">
      <div className="bg-white/95 backdrop-blur-xl rounded-3xl p-8 max-w-md w-full my-8 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between mb">
          <h2 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
            <Plus className="w-8 h-8 text-purple-600" />
            Add User
          </h2>
          <button
            onClick={handleClose}
            className="text-gray-600 hover:text-gray-900 transition"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <p className="text-gray-600 mb-6">Add a new user to your quiz system</p>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Email Field */}
          <div>
            <label htmlFor="email" className="block text-sm font-semibold text-gray-700 mb-2">
              Email Address *
            </label>
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                placeholder="user@example.com"
                className={`w-full pl-12 pr-4 py-3 text-black placeholder:text-black rounded-xl border-2 focus:outline-none transition ${
                  errors.email
                    ? 'border-red-400 focus:border-red-500 bg-red-50'
                    : 'border-gray-200 focus:border-purple-500 bg-gray-50'
                }`}
                disabled={isSubmitting || isLoading}
              />
            </div>
            {errors.email && (
              <p className="text-red-600 text-sm font-medium mt-1">{errors.email}</p>
            )}
          </div>

          {/* Name Field */}
          <div>
            <label htmlFor="name" className="block text-sm font-semibold text-gray-700 mb-2">
              Full Name *
            </label>
            <div className="relative">
              <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                id="name"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                placeholder="John Doe"
                className={`w-full pl-12 pr-4 py-3 text-black placeholder:text-black rounded-xl border-2 focus:outline-none transition ${
                  errors.name
                    ? 'border-red-400 focus:border-red-500 bg-red-50'
                    : 'border-gray-200 focus:border-purple-500 bg-gray-50'
                }`}
                disabled={isSubmitting || isLoading}
              />
            </div>
            {errors.name && (
              <p className="text-red-600 text-sm font-medium mt-1">{errors.name}</p>
            )}
          </div>

          {/* Quiz Code Field (Optional) */}
          <div>
            <label htmlFor="code" className="block text-sm font-semibold text-gray-700 mb-2">
              Quiz Code {!quizCode && '(Optional)'}
            </label>
            <div className="relative">
              <Key className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                id="code"
                name="code"
                value={formData.code}
                onChange={handleInputChange}
                placeholder="ABC123"
                maxLength={6}
                className={`w-full pl-12 pr-4 py-3 text-black placeholder:text-black rounded-xl border-2 focus:outline-none transition font-bold text-center tracking-widest ${
                  errors.code
                    ? 'border-red-400 focus:border-red-500 bg-red-50'
                    : 'border-gray-200 focus:border-purple-500 bg-gray-50'
                }`}
                disabled={isSubmitting || isLoading || !!quizCode}
              />
            </div>
            {errors.code && (
              <p className="text-red-600 text-sm font-medium mt-1">{errors.code}</p>
            )}
            {!quizCode && (
              <p className="text-gray-500 text-xs mt-1">Leave blank to not assign to a quiz</p>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-6">
            <button
              type="submit"
              disabled={isSubmitting || isLoading}
              className="flex-1 bg-linear-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3 px-6 rounded-xl transition transform hover:scale-105 flex items-center justify-center gap-2"
            >
              {isSubmitting || isLoading ? (
                <>
                  <Loader className="w-5 h-5 animate-spin" />
                  Adding...
                </>
              ) : (
                <>
                  <Plus className="w-5 h-5" />
                  Add User
                </>
              )}
            </button>
            <button
              type="button"
              onClick={handleClose}
              disabled={isSubmitting || isLoading}
              className="flex-1 bg-gray-200 hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed text-gray-900 font-bold py-3 px-6 rounded-xl transition"
            >
              Cancel
            </button>
          </div>
        </form>

        {/* Info Box */}
        <div className="mt-6 p-4 bg-blue-50 border-2 border-blue-200 rounded-xl">
          <p className="text-blue-700 text-sm font-medium">
            💡 <span className="font-semibold">Tip:</span> All fields marked with * are required
          </p>
        </div>
      </div>
    </div>
  );
};

export default AddUserModal;