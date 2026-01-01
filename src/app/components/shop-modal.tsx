import React, { useState } from 'react';
import { X, Plus } from 'lucide-react';
import { useToast } from './toast';
import { CoreService } from '../helpers/api-handler';


 interface InternalProductData {
  name: string;
  price: number;
  icon: string;
  description: string;
}

interface ModalState {
  isOpen: boolean;
  formData: InternalProductData;
  error: string;
  isLoading: boolean;
  successMessage: string;
}

const EMOJI_ICONS = ['📝', '⏱️', '💡', '📚', '👨‍🏫', '📄', '🎯', '⭐', '🏆', '📊', '🔔', '✨'];

export default function AddProductModal() {
    const {addToast} = useToast();
    const service:CoreService = new CoreService();
  const [state, setState] = useState<ModalState>({
    isOpen: false,
    formData: {
      name: '',
      price: 0,
      icon: '📝',
      description: ''
    },
    error: '',
    isLoading: false,
    successMessage: ''
  });

  const handleInputChange = (field: keyof InternalProductData, value: string): void => {
    setState(prev => ({
      ...prev,
      formData: {
        ...prev.formData,
        [field]: value
      },
      error: '',
      successMessage: ''
    }));
  };

  const validateForm = (): boolean => {
    if (!state.formData.name.trim()) {
      setState(prev => ({ ...prev, error: 'Product name is required' }));
      return false;
    }
    if (!state.formData.price || isNaN(Number(state.formData.price)) || Number(state.formData.price) <= 0) {
      setState(prev => ({ ...prev, error: 'Please enter a valid price' }));
      return false;
    }
    if (!state.formData.icon.trim()) {
      setState(prev => ({ ...prev, error: 'Please select an icon' }));
      return false;
    }
    if (!state.formData.description.trim()) {
      setState(prev => ({ ...prev, error: 'Description is required' }));
      return false;
    }
    return true;
  };

  const createProduct = async() => {
    try {
        const res =  await service.send('/shop/api/create-product', {
            name: state.formData.name,
            price: Number(state.formData.price),
            icon: state.formData.icon,
            description: state.formData.description
        });
        if(res.success){
            addToast(res.message,'success');
            setTimeout(() => {
        setState(prev => ({
          ...prev,
          isOpen: false,
          successMessage: ''
        }));
      }, 1500);
        }else{
            addToast(res.message,'error');
        }
    }catch(e:any){
        addToast(e.message,'error');
    }
  }

  const handleSubmit = async (): Promise<void> => {
    if (!validateForm()) {
      return;
    }

    setState(prev => ({
      ...prev,
      isLoading: true,
      error: ''
    }));

    // Simulate API call
     await createProduct();

      setState(prev => ({
        ...prev,
        isLoading: false,
        successMessage: `${state.formData.name} added successfully!`,
        formData: {
          name: '',
          price: 0,
          icon: '📝',
          description: ''
        }
      }));

  };

  const openModal = (): void => {
    setState(prev => ({
      ...prev,
      isOpen: true,
      formData: {
        name: '',
        price: 0,
        icon: '📝',
        description: ''
      },
      error: '',
      successMessage: ''
    }));
  };

  const closeModal = (): void => {
    setState(prev => ({
      ...prev,
      isOpen: false,
      error: '',
      successMessage: ''
    }));
  };

  return (
    <div className="flex items-center justify-center bg-transparent">
      {/* Trigger Button */}
      <button
        onClick={openModal}
        className="flex items-center gap-2 bg-linear-to-r from-indigo-600 to-purple-600 text-white font-semibold py-3 px-6 rounded-lg hover:shadow-lg transition transform hover:scale-105"
      >
        <Plus className="w-5 h-5" />
        Add Product
      </button>

      {/* Modal Overlay */}
      {state.isOpen && (
        <div className="fixed inset-0 bg-black/50 bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-screen overflow-y-auto">
            {/* Modal Header */}
            <div className="sticky top-0 bg-linear-to-r from-indigo-600 to-purple-600 text-white p-6 flex items-center justify-between">
              <h2 className="text-2xl font-bold">Add New Product</h2>
              <button
                onClick={closeModal}
                className="hover:bg-white hover:bg-opacity-20 p-2 rounded-lg transition"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 space-y-5">
              {/* Success Message */}
              {state.successMessage && (
                <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                  <p className="text-green-600 font-medium">{state.successMessage}</p>
                </div>
              )}

              {/* Error Message */}
              {state.error && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-red-600 font-medium">{state.error}</p>
                </div>
              )}

              {/* Product Name */}
              <div>
                <label className="block text-sm font-semibold text-gray-800 mb-2">
                  Product Name
                </label>
                <input
                  type="text"
                  placeholder="e.g., Extra Quiz Attempt"
                  value={state.formData.name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  className="w-full px-4 py-3 border text-black placeholder:text-black border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-transparent transition"
                />
              </div>

              {/* Price */}
              <div>
                <label className="block text-sm font-semibold text-gray-800 mb-2">
                  Price (Credits)
                </label>
                <input
                  type="number"
                  placeholder="e.g., 50"
                  value={state.formData.price}
                  onChange={(e) => handleInputChange('price', e.target.value)}
                  className="w-full px-4 py-3 text-black placeholder:text-black border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-transparent transition"
                />
              </div>

              {/* Icon Selection */}
              <div>
                <label className="block text-sm font-semibold text-gray-800 mb-3">
                  Select Icon
                </label>
                <div className="grid grid-cols-6 gap-2">
                  {EMOJI_ICONS.map(emoji => (
                    <button
                      key={emoji}
                      onClick={() => handleInputChange('icon', emoji)}
                      className={`text-3xl p-3 rounded-lg border-2 transition transform hover:scale-110 ${
                        state.formData.icon === emoji
                          ? 'border-indigo-600 bg-indigo-50'
                          : 'border-gray-200 hover:border-indigo-300'
                      }`}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
                <p className="text-sm text-gray-600 mt-2">Selected: {state.formData.icon}</p>
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-semibold text-gray-800 mb-2">
                  Description
                </label>
                <textarea
                  placeholder="e.g., 1 additional quiz attempt"
                  value={state.formData.description}
                  onChange={(e) => handleInputChange('description', e.target.value)}
                  rows={3}
                  className="w-full px-4 text-black placeholder:text-black py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-transparent transition resize-none"
                />
              </div>

              {/* Preview */}
              {state.formData.name && (
                <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                  <p className="text-xs text-gray-600 mb-2">Preview:</p>
                  <div className="border border-gray-200 rounded-lg p-3 bg-white">
                    <div className="flex justify-between items-start gap-2 mb-2">
                      <div className="flex-1">
                        <p className="font-semibold text-gray-800">{state.formData.name}</p>
                        <p className="text-xs text-gray-600">{state.formData.description}</p>
                      </div>
                      <span className="text-2xl">{state.formData.icon}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-indigo-600">{state.formData.price} ⭐</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 p-6 flex gap-3">
              <button
                onClick={closeModal}
                className="flex-1 py-3 px-4 border border-gray-300 text-gray-800 font-semibold rounded-lg hover:bg-gray-100 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={state.isLoading}
                className="flex-1 py-3 px-4 bg-linear-to-r from-indigo-600 to-purple-600 text-white font-semibold rounded-lg hover:shadow-lg transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {state.isLoading ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                    Adding...
                  </>
                ) : (
                  <>
                    <Plus className="w-5 h-5" />
                    Add Product
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}