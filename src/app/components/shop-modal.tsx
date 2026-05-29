import React, { useState } from 'react';
import { X, Plus, ShoppingBag, Tag, Type, AlignLeft, Sparkles, Loader2 } from 'lucide-react';
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
        className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3.5 px-8 rounded-2xl shadow-[0_10px_20px_rgba(79,70,229,0.2)] transition-all active:scale-95 group"
      >
        <Plus className="w-5 h-5 group-hover:rotate-90 transition-transform duration-300" />
        Add Product
      </button>

      {/* Modal Overlay */}
      {state.isOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-300">
          <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-md max-h-[90vh] overflow-hidden flex flex-col animate-in zoom-in-95 slide-in-from-bottom-8 duration-500">
            {/* Modal Header */}
            <div className="p-8 pb-4 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-indigo-50 rounded-2xl">
                  <ShoppingBag className="w-6 h-6 text-indigo-600" />
                </div>
                <div>
                  <h2 className="text-2xl font-black text-slate-900 tracking-tight">New Product</h2>
                  <p className="text-slate-500 text-xs font-medium">Create a new item for the student shop</p>
                </div>
              </div>
              <button
                onClick={closeModal}
                className="p-2 hover:bg-slate-100 rounded-xl transition-colors text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-8 pt-2 space-y-6 overflow-y-auto">
              {/* Error Message */}
              {state.error && (
                <div className="p-4 bg-rose-50 border border-rose-100 rounded-2xl animate-in shake duration-300">
                  <p className="text-rose-600 text-sm font-semibold flex items-center gap-2">
                    <X className="w-4 h-4" /> {state.error}
                  </p>
                </div>
              )}

              <div className="grid grid-cols-1 gap-5">
                {/* Product Name */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Product Name</label>
                  <div className="relative">
                    <Type className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      placeholder="e.g., Extra Quiz Attempt"
                      value={state.formData.name}
                      onChange={(e) => handleInputChange('name', e.target.value)}
                      className="w-full pl-11 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-slate-900 placeholder:text-slate-300 focus:ring-4 focus:ring-indigo-500/5 focus:border-indigo-500 outline-none transition-all font-medium"
                    />
                  </div>
                </div>

                {/* Price */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Price (Credits)</label>
                  <div className="relative">
                    <Tag className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="number"
                      placeholder="0"
                      value={state.formData.price || ''}
                      onChange={(e) => handleInputChange('price', e.target.value)}
                      className="w-full pl-11 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-slate-900 placeholder:text-slate-300 focus:ring-4 focus:ring-indigo-500/5 focus:border-indigo-500 outline-none transition-all font-bold"
                    />
                  </div>
                </div>
              </div>

              {/* Icon Selection */}
              <div className="space-y-3">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Visual Icon</label>
                <div className="grid grid-cols-6 gap-3 p-4 bg-slate-50 rounded-4xl border border-slate-100">
                  {EMOJI_ICONS.map(emoji => (
                    <button
                      key={emoji}
                      onClick={() => handleInputChange('icon', emoji)}
                      className={`text-2xl aspect-square flex items-center justify-center rounded-xl transition-all transform hover:scale-110 active:scale-90 ${
                        state.formData.icon === emoji
                          ? 'bg-white shadow-md scale-110 ring-2 ring-indigo-500'
                          : 'hover:bg-white/50'
                      }`}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>

              {/* Description */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Description</label>
                <div className="relative">
                  <AlignLeft className="absolute left-4 top-4 w-4 h-4 text-slate-400" />
                  <textarea
                    placeholder="Describe what this item does..."
                    value={state.formData.description}
                    onChange={(e) => handleInputChange('description', e.target.value)}
                    rows={3}
                    className="w-full pl-11 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-slate-900 placeholder:text-slate-300 focus:ring-4 focus:ring-indigo-500/5 focus:border-indigo-500 outline-none transition-all font-medium resize-none"
                  />
                </div>
              </div>

              {/* Preview */}
              <div className="pt-2">
                <div className="bg-indigo-50/50 rounded-3xl p-6 border border-indigo-100/50 relative overflow-hidden group">
                  <Sparkles className="absolute -right-2 -top-2 w-12 h-12 text-indigo-200/30 rotate-12 group-hover:scale-125 transition-transform duration-700" />
                  <p className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.2em] mb-4">Live Preview</p>
                  <div className="bg-white rounded-2xl p-5 shadow-sm border border-indigo-100/50">
                    <div className="flex justify-between items-start gap-2 mb-2">
                      <div className="flex-1">
                        <p className="font-bold text-slate-800">{state.formData.name || 'Product Name'}</p>
                        <p className="text-xs text-slate-500 line-clamp-1">{state.formData.description || 'Description will appear here...'}</p>
                      </div>
                      <span className="text-2xl">{state.formData.icon}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="font-black text-indigo-600">₦{state.formData.price || 0} 🏷️</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-8 pt-0 flex gap-4">
              <button
                onClick={closeModal}
                className="flex-1 py-4 px-6 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold rounded-2xl transition-all active:scale-95"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={state.isLoading}
                className="flex-2 py-4 px-6 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-2xl shadow-lg shadow-indigo-200 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {state.isLoading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Plus className="w-5 h-5" /> Create Product
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