'use client'
import React, { useEffect, useState } from 'react';
import { User, ShoppingCart, Clock, BookOpen, Star, Plus, Minus, ArrowRight, User2, Book, Circle, BookDashed, MessageSquareText, LayoutDashboard, LogOut, Settings, Menu, X, Loader, ToolCaseIcon } from 'lucide-react';
import { LogFactory, Product, ProductFormData, Users } from '@/app/helpers/factories';
import { useToast } from '@/app/components/toast';
import { CoreService } from '@/app/helpers/api-handler';
import { useRouter } from 'next/navigation';
import { InitializePayment } from '@/app/components/payment';
import LottieAnimation from '@/app/components/lottie';
import { Badge } from '@/app/components/badge';
import Validator from '@/app/components/validator';
import { Announcement, AnnouncementModal } from '@/app/components/dynamic-modal';

interface StudentData {
  name: string;
  email: string;
  studentId: string;
  grade: string;
  avatar: string;
}

interface Quiz {
  id: number;
  name: string;
  score: number;
}

interface Exam {
  id: number;
  name: string;
  date: string;
  timeLeft: string;
  duration: string;
}

interface ShopItem {
  id: number;
  name: string;
  price: number;
  icon: string;
  description: string;
}

type Screen = 'dashboard' | 'shop' | 'Misc';

export default function StudentDashboard() {
  const [currentScreen, setCurrentScreen] = useState<Screen>('dashboard');
  const [credits, setCredits] = useState<number>(500);
  const [cart, setCart] = useState<Record<number, number>>({});
  const {addToast, studentsInfo, setStudentInfo } = useToast();
  const service:CoreService = new CoreService();
  const [reviewData, setReviewData] = useState<LogFactory[]>([]);
  const [shopItems, setShopItems] = useState<ProductFormData[]>([]);
  const [payment, setPayment] = useState<boolean>(false);
  const router = useRouter();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [performanceSearch, setPerformanceSearch] = useState('');
  const [quizKey, setQuizKey] = useState('');
  const [isKeyModalOpen, setIsKeyModalOpen] = useState(false);
  const [isKeyLoading, setIsKeyLoading] = useState(false);
  const [paySubscription, setPaySubscription] = useState<boolean>(false);
  
  const refresh = async(email: string, code: string) => {
      try {
          const res = await service.send('/users/api/login-student', {
              email,
              code
          });
          if(res.success){
              const result = Users.fromJson(res.data!);
              setStudentInfo(result);
          }else{
              addToast(res.message,'error');
          }
      }catch(e:any){
          addToast(e.message,'error');
      }
    }

  const fetchReviews = async() => {
    try{
        const res = await service.get(`/review/api/fetch-reviews?userId=${studentsInfo.id}`);
        if(res.success){
            const result = Array.isArray(res.data) ? res.data : [res.data];
            const value = result.map((u) => LogFactory.fromJson(u));
            setReviewData(value);
        }else{
            addToast(res.message,'error');
        }
    }catch(e:any){
        addToast(e.message,'error');
    }
  }

  const fetchShopItems = async() => {
    try{
        const res = await service.get('/shop/api/fetch-products');
        const result = Array.isArray(res.data) ? res.data : [res.data];
        const value = result.map((u) => Product.fromJson(u));
        setShopItems(value);
        console.log(res.data)
    }catch(e:any){
        addToast(e.message,'error');
    }
  }

  useEffect(() => {
    fetchReviews()
    fetchShopItems();
    const userSession = sessionStorage.getItem('userSession');
  if (!userSession) {
    router.push('/pages/login');
    return;
  }

     const handleBeforeUnload = (e: BeforeUnloadEvent) => {
    e.preventDefault();
    e.returnValue = '';
    // Clear session safely
    sessionStorage.removeItem('userSession');
  };

  window.addEventListener('beforeunload', handleBeforeUnload);

  return () => {
    window.removeEventListener('beforeunload', handleBeforeUnload);
  };
  },[]);

  const filteredPerformance = reviewData?.filter(quiz => 
    quiz.name.toLowerCase().includes(performanceSearch.toLowerCase())
  );


  const addToCart = (item: ShopItem): void => {
    const map = Object.entries(cart).map((val, index) => val);
    if(map.length === 1) {
        addToast('You can only purchase one item at a time');
        return;
    }
    setCart(prev => ({
      ...prev,
      [item.id]: (prev[item.id] || 0) + 1
    }));
    addToast('Added to cart successfully', 'success');
  };

  const removeFromCart = (itemId: number): void => {
    setCart(prev => {
      const newCart = { ...prev };
      if (newCart[itemId] > 1) {
        newCart[itemId] -= 1;
      } else {
        delete newCart[itemId];
      }
      return newCart;
    });
  };

  const generateRandomUid = () => {
    return Math.random().toString(36).substring(2, 11);
  };


const handleCompletedPurchace = async () => {
  const uniqueId = generateRandomUid();
  try {
    for (const [productIdStr, quantity] of Object.entries(cart)) {
      const productId = Number(productIdStr);

      const payload = {
        productId,
       params:
        productId === 1
            ? { attempts: quantity } : 
             productId === 2 ? { time: quantity * 15 }
            : productId === 3 ? { quizKey: uniqueId } : 
            productId == 4 ? {program: shopItems.find((item) => item.id === 4)?.name} :
            productId == 5 ? {program: shopItems.find((item) => item.id === 5)?.name} :
            {program: shopItems.find((item) => item.id === 6)?.name} 
      };

     const res = await service.send(`/users/api/update-after-pay/${studentsInfo.id}`, payload);
     if(res.success){
        addToast(res.message, 'success');
        await refresh(studentsInfo.email, studentsInfo.codeInfo.code)
     }else{
        addToast(res.message, 'error');
     }
    }

    
    setCart({});
    setPayment(false);
  } catch (e: any) {
    addToast(e.message, 'error');
  }
};

 
  const cartTotal = Object.entries(cart).reduce((sum, [id, qty]) => {
    const item = shopItems.find(s => s.id === parseInt(id));
    return sum + (item?.price || 0) * qty;
  }, 0);

  const checkout = (): void => {
    if (cartTotal < 1) {
      addToast('Cart items too low','error');
      return;
    }
    setPayment(true)
  };

  const handleQuizAccess = async() => {
    if (quizKey.trim() === "") {
      addToast("Please enter a valid access key", "error");
      return;
    }
    setIsKeyLoading(true);
    try {
      const res = await service.send(`/misc/api/validate-key/${studentsInfo.id}`, { key: quizKey });
      if (res.success) {
        localStorage.setItem('revealQuizId', res.data!.quizId);
        router.push('/pages/reveal-quiz');
        setIsKeyModalOpen(false);
        setQuizKey("");
      } else {
        addToast(res.message, "error");
      }
    } finally {
      setIsKeyLoading(false);
    }
  };

  const handleCompletedSubcription = async() => {
    try{
    const res = await service.get(`${process.env.NEXT_PUBLIC_ACTIVATE_USER_LINK}/${studentsInfo.id}`);
    if(res.success){
      await refresh(studentsInfo.email, studentsInfo.codeInfo.code);
      setPaySubscription(false);
      addToast(res.message,'success')
    }else{
      addToast(res.message,'error');
    }
   
   }catch(e: any){
    addToast(e.message,'error');
   }
  }

  if(paySubscription){
    return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0d0d1a",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "40px 20px",
        fontFamily: "'DM Sans', sans-serif",
        position: "relative",
        overflow: "hidden",
      }}
    >
       
          <div className='flex justify-center items-center inset-0 bg-slate-900/60 backdrop-blur-sm fixed w-full h-screen z-50'>
            <InitializePayment name={studentsInfo.name} email={studentsInfo.email} amount={2000} callback={async() => await handleCompletedSubcription()} onClose={() => setPayment(false)}></InitializePayment>
          </div>
    </div>
    );
  }



  const activatedChecker:Announcement[] = [
    {
      id: 'Student-Activation',
      title: 'Subscription Status',
      body: 'Your subscription is currently inactive. Please activate your subscription to access all features.',
      cta: { label: 'Activate Dashboard', onClick: () => {
        setPaySubscription(true);
      } }
    }
  ];

  const Sidebar = () => (
    <>
      {/* Mobile Overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}
      
      <aside className={`fixed top-0 left-0 h-full bg-white border-r border-slate-100 z-50 transition-transform duration-300 lg:translate-x-0 w-72 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="p-8 flex flex-col h-full">
          <div className="flex items-center gap-3 mb-12">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-200">
              <BookOpen className="w-6 h-6 text-white" />
            </div>
            <h2 className="text-xl font-black text-slate-900 tracking-tight">Lan&apos;s Hub</h2>
          </div>

          <nav className="space-y-2 flex-1">
            <button 
              onClick={() => { setCurrentScreen('dashboard'); setIsSidebarOpen(false); }}
              className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl font-bold text-sm transition-all ${currentScreen === 'dashboard' ? 'bg-indigo-50 text-indigo-600' : 'text-slate-500 hover:bg-slate-50'}`}
            >
              <LayoutDashboard className="w-5 h-5" /> Dashboard
            </button>
            <button 
              onClick={() => { setCurrentScreen('shop'); setIsSidebarOpen(false); }}
              className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl font-bold text-sm transition-all ${currentScreen === 'shop' ? 'bg-indigo-50 text-indigo-600' : 'text-slate-500 hover:bg-slate-50'}`}
            >
              <ShoppingCart className="w-5 h-5" /> Shop
            </button>
            <button 
              onClick={() => { router.push('/pages/reviews'); setIsSidebarOpen(false); }}
              className="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl font-bold text-sm text-slate-500 hover:bg-slate-50 transition-all"
            >
              <Book className="w-5 h-5" /> My Reviews
            </button>
             <button 
              onClick={() => { setCurrentScreen('Misc') }}
              className="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl font-bold text-sm text-slate-500 hover:bg-slate-50 transition-all"
            >
              <ToolCaseIcon className="w-5 h-5" /> Miscellenous
            </button>
          </nav>

          <div className="pt-8 border-t border-slate-100 space-y-4">
            <div className="flex items-center gap-3 px-2">
              <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center">
                <User2 className="w-5 h-5 text-slate-500" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-slate-900 truncate">{studentsInfo.name}</p>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Student</p>
              </div>
            </div>
            <button 
              onClick={() => { sessionStorage.removeItem('userSession'); router.push('/pages/login'); }}
              className="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl font-bold text-sm text-rose-500 hover:bg-rose-50 transition-all"
            >
              <LogOut className="w-5 h-5" /> Logout
            </button>
          </div>
        </div>
      </aside>
    </>
  );


  if (currentScreen === 'shop') {
    return (
      <div className="min-h-screen bg-[#F8FAFC] p-4 md:p-8 font-sans">
        {payment && (
          <div className='flex justify-center items-center inset-0 bg-slate-900/60 backdrop-blur-sm fixed w-full h-screen z-50'>
            <InitializePayment name={studentsInfo.name} email={studentsInfo.email} amount={cartTotal} callback={async() => await handleCompletedPurchace()} onClose={() => setPayment(false)}></InitializePayment>
          </div>
        )}
        <Sidebar />
        <div className="lg:ml-72 max-w-5xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="lg:hidden p-2 bg-white border border-slate-200 rounded-xl"
            >
              <Menu className="w-6 h-6 text-slate-600" />
            </button>
            <h1 className="text-2xl font-black text-slate-900 lg:hidden">Shop</h1>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Shop Items */}
            <div className="lg:col-span-8">
              <div className="mb-8">
                <h1 className="text-4xl font-black text-slate-900 tracking-tight mb-2">Student Shop</h1>
                <p className="text-slate-500 font-medium">Enhance your learning experience with power-ups.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {shopItems.map(item => (
                  <div key={item.id} className="bg-white rounded-4xl border border-slate-100 p-6 shadow-[0_8px_30px_rgb(0,0,0,0.02)] hover:shadow-[0_20px_40px_rgb(0,0,0,0.06)] transition-all group">
                    <div className="flex justify-between items-start mb-6">
                      <div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center text-3xl shadow-inner group-hover:scale-110 transition-transform">
                        {item.icon}
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Price</p>
                        <p className="text-xl font-black text-indigo-600">₦{item.price}</p>
                      </div>
                    </div>
                    <h3 className="text-lg font-bold text-slate-900 mb-2">{item.name}</h3>
                    <p className="text-sm text-slate-500 mb-8 leading-relaxed">{item.description}</p>
                    <button
                      onClick={() => addToCart(item)}
                      className="w-full py-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold text-slate-600 hover:bg-indigo-600 hover:text-white hover:border-indigo-600 transition-all flex items-center justify-center gap-2"
                    >
                      <Plus className="w-4 h-4" /> Add to Cart
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Cart Sidebar */}
            <div className="lg:col-span-4">
              <div className="bg-slate-900 rounded-4xl p-8 text-white shadow-2xl sticky top-8">
                <div className="flex items-center gap-3 mb-8">
                  <div className="w-10 h-10 bg-indigo-500/20 rounded-xl flex items-center justify-center">
                    <ShoppingCart className="w-5 h-5 text-indigo-400" />
                  </div>
                  <h3 className="text-xl font-bold">Your Cart</h3>
                </div>

                {Object.keys(cart).length === 0 ? (
                  <div className="py-12 text-center">
                    <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
                      <ShoppingCart className="w-6 h-6 text-slate-600" />
                    </div>
                    <p className="text-slate-400 text-sm font-medium">Your cart is empty</p>
                  </div>
                ) : (
                  <>
                    <div className="space-y-6 mb-8">
                      {Object.entries(cart).map(([id, qty]) => {
                        const item = shopItems.find(s => s.id === parseInt(id));
                        return (
                          <div key={id} className="flex justify-between items-center group">
                            <div className="flex-1">
                              <p className="font-bold text-sm mb-1">{item?.name}</p>
                              <p className="text-xs text-indigo-400 font-black">₦{item?.price} × {qty}</p>
                            </div>
                            <div className="flex items-center gap-3 bg-slate-800 p-1.5 rounded-xl">
                              <button
                                onClick={() => removeFromCart(parseInt(id))}
                                className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-700 transition-colors"
                              >
                                <Minus className="w-3 h-3" />
                              </button>
                              <span className="text-xs font-black w-4 text-center">{qty}</span>
                              <button
                                onClick={() => addToCart(item!)}
                                className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-700 transition-colors"
                              >
                                <Plus className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <div className="border-t border-slate-800 pt-6">
                      <div className="flex justify-between items-center mb-8">
                        <span className="text-slate-400 text-sm font-bold uppercase tracking-widest">Total</span>
                        <span className="text-3xl font-black text-white">₦{cartTotal}</span>
                      </div>
                      <button
                        onClick={checkout}
                        className="w-full py-5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-black transition-all shadow-xl shadow-indigo-900/40 active:scale-[0.98]"
                      >
                        Complete Purchase
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }
  if(currentScreen === 'Misc'){
    return (
      <div className="min-h-screen bg-[#F8FAFC] p-4 md:p-8 font-sans">
        <Sidebar/>
        
        {/* Main Content */}
        <div className="lg:ml-72 mx-auto">
          {/* Mobile Menu Button */}
          <button
            onClick={() => setIsSidebarOpen(true)}
            className="lg:hidden p-2 bg-white border border-slate-200 rounded-xl mb-4"
          >
            <Menu className="w-6 h-6 text-slate-600" />
          </button>

          {/* Header */}
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-[#1E293B]">Miscellaneous</h1>
            <p className="text-[#64748B] text-sm mt-1">Current program information and metrics</p>
          </div>

          {/* Status Cards - Minimal */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
            {/* Program Status */}
            <div className="bg-white rounded-xl p-5 border border-[#E2E8F0]">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[#64748B] text-xs uppercase tracking-wide font-medium">Program Status</p>
                  <p className="text-xl font-bold text-[#1E293B] mt-1">{studentsInfo.currentProgram}</p>
                </div>
                <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
              </div>
              <p className="text-xs text-[#64748B] mt-2">Last updated: 2 min ago</p>
            </div>

            {/* Total Products */}
            <div className="bg-white rounded-xl p-5 border border-[#E2E8F0]">
              <p className="text-[#64748B] text-xs uppercase tracking-wide font-medium">Total Products</p>
              <p className="text-xl font-bold text-[#1E293B] mt-1">{shopItems.length}</p>
              <p className="text-xs text-[#64748B] mt-2">All in Stock</p>
            </div>

            {/* Environment */}
            <div className="bg-white rounded-xl p-5 border border-[#E2E8F0]">
              <p className="text-[#64748B] text-xs uppercase tracking-wide font-medium">Environment</p>
              <p className="text-xl font-bold text-[#1E293B] mt-1">Production</p>
              <p className="text-xs text-[#64748B] mt-2">Region: US-East</p>
            </div>
          </div>

          {/* Bottom Grid - 2 columns */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* System Metrics - Browser Data */}
            <div className="bg-white rounded-xl p-5 border border-[#E2E8F0]">
              <h3 className="text-sm font-semibold text-[#1E293B] mb-3">🖥️ System Info</h3>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-[#64748B]">Browser</span>
                  <span className="font-medium text-[#1E293B]">{navigator.userAgent.split(' ').slice(-2).join(' ')}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-[#64748B]">Screen Size</span>
                  <span className="font-medium text-[#1E293B]">{window.innerWidth} × {window.innerHeight}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-[#64748B]">Connection</span>
                  <span className="font-medium text-[#1E293B]">{(navigator as any).connection?.effectiveType || 'Unknown'}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-[#64748B]">Language</span>
                  <span className="font-medium text-[#1E293B]">{navigator.language}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-[#64748B]">Time Zone</span>
                  <span className="font-medium text-[#1E293B]">{Intl.DateTimeFormat().resolvedOptions().timeZone}</span>
                </div>
              </div>
            </div>

           {/* Browser Information */}
<div className="bg-white rounded-xl p-5 border border-[#E2E8F0]">
  <h3 className="text-sm font-semibold text-[#1E293B] mb-3">🌐 Browser Information</h3>
  <div className="space-y-2 text-sm">
    <div className="flex justify-between items-center py-1 border-b border-[#F1F5F9]">
      <span className="text-[#64748B]">Browser</span>
      <span className="font-medium text-[#1E293B]">
        {navigator.userAgent.split(' ').slice(-2).join(' ')}
      </span>
    </div>
    <div className="flex justify-between items-center py-1 border-b border-[#F1F5F9]">
      <span className="text-[#64748B]">Platform</span>
      <span className="font-medium text-[#1E293B]">{navigator.platform}</span>
    </div>
    <div className="flex justify-between items-center py-1 border-b border-[#F1F5F9]">
      <span className="text-[#64748B]">Screen Resolution</span>
      <span className="font-medium text-[#1E293B]">{screen.width} × {screen.height}</span>
    </div>
    <div className="flex justify-between items-center py-1 border-b border-[#F1F5F9]">
      <span className="text-[#64748B]">Color Depth</span>
      <span className="font-medium text-[#1E293B]">{screen.colorDepth}-bit</span>
    </div>
    <div className="flex justify-between items-center py-1 border-b border-[#F1F5F9]">
      <span className="text-[#64748B]">Cookies Enabled</span>
      <span className="font-medium text-[#1E293B]">{navigator.cookieEnabled ? '✅ Yes' : '❌ No'}</span>
    </div>
    <div className="flex justify-between items-center py-1">
      <span className="text-[#64748B]">Do Not Track</span>
      <span className="font-medium text-[#1E293B]">{navigator.doNotTrack || 'Not set'}</span>
    </div>
  </div>
</div>
            {/* Quick Info - Full Width */}
            <div className="bg-linear-to-br from-[#EFF6FF] to-[#DBEAFE] rounded-xl p-5 border border-[#BFDBFE] md:col-span-2">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-[#1E293B]">ℹ️ Quick Info</h3>
                  <ul className="mt-2 space-y-1 text-sm text-[#475569]">
                    <li>• Next scheduled maintenance: July 5, 2026</li>
                    <li>• API status: <span className="text-green-600 font-medium">Operational</span></li>
                    <li>• Current timezone: UTC-4</li>
                    <li>• Total students enrolled: 1,247</li>
                  </ul>
                </div>
                <span className="text-xs bg-white/50 px-3 py-1 rounded-full text-[#1E293B] border border-[#BFDBFE]">
                  Updated
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }
  return (
    <div className="min-h-screen bg-[#F8FAFC] p-4 md:p-8 font-sans">
      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #e2e8f0;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #cbd5e1;
        }
      `}</style>
      {payment && (
        <div className='flex justify-center items-center inset-0 bg-slate-900/60 backdrop-blur-sm fixed w-full h-screen z-50'>
          <InitializePayment name={studentsInfo.name} email={studentsInfo.email} amount={cartTotal} callback={async() => await handleCompletedPurchace()} onClose={() => setPayment(false)}></InitializePayment>
        </div>
      )}
      
      {isKeyModalOpen && (
        <div className="fixed inset-0 z-100 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl border border-slate-100">
            <h3 className="text-2xl font-black text-slate-900 mb-2">Reveal Quiz</h3>
            <p className="text-slate-500 text-sm mb-6">Enter the secret key purchased from the shop.</p>
            <input 
              type="text" 
              value={quizKey}
              onChange={(e) => setQuizKey(e.target.value)}
              placeholder="Enter Access Key..."
              className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl mb-6 focus:border-indigo-500 focus:outline-none font-bold text-lg transition-all text-black placeholder:text-black"
            />
            <div className="flex gap-3">
              <button onClick={() => setIsKeyModalOpen(false)} className="flex-1 py-4 rounded-2xl font-bold text-slate-500 hover:bg-slate-50 transition-all">Cancel</button>
              <button 
                onClick={handleQuizAccess} 
                disabled={isKeyLoading}
                className="flex-1 py-4 bg-indigo-600 text-white rounded-2xl font-bold shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition-all flex items-center justify-center gap-2"
              >
                {isKeyLoading ? <Loader className="w-5 h-5 animate-spin" /> : 'Unlock Quiz'}
              </button>
            </div>
          </div>
        </div>
      )}

      <Sidebar />
      
      <div className="lg:ml-72 max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setIsSidebarOpen(true)}
              className="lg:hidden p-3 bg-white border border-slate-200 rounded-2xl shadow-sm"
            >
              <Menu className="w-6 h-6 text-slate-600" />
            </button>
          <div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tight">Student Dashboard</h1>
            <div className="flex items-center gap-3 mt-1">
              <p className="text-slate-500 font-medium">Welcome back, {studentsInfo.name.split(' ')[0]}!</p>
              <div className="flex items-center gap-1.5 px-2.5 py-1 bg-indigo-50 border border-indigo-100 rounded-full">
                <span className="text-[10px] font-black text-indigo-400 uppercase tracking-wider">ID</span>
                <span className="text-xs font-bold text-indigo-600">#{studentsInfo.id}</span>
              </div>
            </div>
          </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Main Content - Left Side */}
          <div className="lg:col-span-8 space-y-8">
            {/* Profile Card */}
            <div className="bg-white rounded-4xl border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] p-8 relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50 rounded-bl-full -mr-10 -mt-10 transition-transform group-hover:scale-110 duration-500"></div>
              <div className="flex flex-col md:flex-row items-center gap-8 relative z-10">
                <div className="shrink-0 bg-slate-50 rounded-3xl p-2 border border-slate-100">
                  <LottieAnimation path={'/read.json'} style={{width:'140px', height:'140px'}}/>
                </div>
                <div className="text-center md:text-left flex-1">
                  <h2 className="text-2xl font-bold text-slate-900 mb-1">{studentsInfo.name}</h2>
                  <p className="text-slate-500 text-sm mb-4">{studentsInfo.email}</p>
                  <div className="flex flex-wrap justify-center md:justify-start gap-3">
                    <div className="px-4 py-2 bg-indigo-50 rounded-xl border border-indigo-100">
                      <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest">Avg Score</p>
                      <p className="text-lg font-black text-indigo-600">{studentsInfo.score}%</p>
                    </div>
                    <button
                      onClick={() => router.push('/pages/reviews')}
                      className="px-5 py-2.5 bg-white border-2 border-slate-200 text-slate-700 rounded-xl font-bold text-sm hover:bg-slate-50 hover:border-slate-300 transition-all flex items-center gap-2"
                    >
                      <MessageSquareText className="w-4 h-4 text-indigo-500" /> View Responses
                    </button>
                    <button
                      onClick={() => setIsKeyModalOpen(true)}
                      className="px-5 py-2.5 bg-indigo-600 text-white rounded-xl font-bold text-sm hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 flex items-center gap-2"
                    >
                      <Star className="w-4 h-4 fill-current" /> Reveal Quiz
                    </button>
                  </div>
                </div>
              </div>

              {(() => {
                const isNearDeadline = studentsInfo.deadline && 
                  (new Date(studentsInfo.deadline).getTime() - new Date().getTime()) < (3 * 24 * 60 * 60 * 1000); // 3 days
                
                const isUrgent = studentsInfo.deadline && 
                  (new Date(studentsInfo.deadline).getTime() - new Date().getTime()) < (1 * 24 * 60 * 60 * 1000); // 1 day
                
                return (
                  <div className={`mt-8 p-6 border rounded-3xl flex items-center justify-between transition-colors duration-500 ${
                    isUrgent
                      ? 'bg-red-100 border-red-200 shadow-lg shadow-red-100 animate-pulse'
                      : isNearDeadline 
                      ? 'bg-rose-50 border-rose-100'
                      : 'bg-emerald-50 border-emerald-100 shadow-lg shadow-emerald-50'
                  }`}>
                <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${isUrgent ? 'bg-red-200 text-red-700' : isNearDeadline ? 'bg-rose-100 text-rose-600' : 'bg-emerald-100 text-emerald-600'}`}>
                        <Clock className="w-6 h-6" />
                      </div>
                      <div>
                        <p className={`text-xs font-black uppercase tracking-widest ${isUrgent ? 'text-red-500' : isNearDeadline ? 'text-rose-400' : 'text-emerald-500'}`}>{isUrgent ? 'Urgent Deadline' : isNearDeadline ? 'Upcoming Deadline' : 'Safe Status'}</p>
                        <h4 className={`text-lg font-bold ${isUrgent ? 'text-red-900' : isNearDeadline ? 'text-rose-900' : 'text-emerald-900'}`}>{isNearDeadline ? 'Your test is due on' : 'Deadline is set for'}</h4>
                      </div>
                </div>
                    <div className="text-right"><p className={`text-lg font-black ${isUrgent ? 'text-red-700' : isNearDeadline ? 'text-rose-600' : 'text-emerald-600'}`}>{studentsInfo.deadline ? new Date(studentsInfo.deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'No deadline set'}</p></div>
              </div>
                );
              })()}
            </div>

            {/* Quiz Attempts Section */}
            <div className="bg-white rounded-4xl border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] p-8">
              <div className="flex items-center justify-between mb-8">
                <h3 className="text-xl font-bold text-slate-900 flex items-center gap-3">
                  <div className="w-10 h-10 bg-amber-50 rounded-xl flex items-center justify-center">
                    <BookOpen className="w-5 h-5 text-amber-600" />
                  </div>
                  Learning Progress
                </h3>
                <div className="relative w-full md:w-64">
                  <input 
                    type="text" 
                    placeholder="Filter quizzes..." 
                    value={performanceSearch}
                    onChange={(e) => setPerformanceSearch(e.target.value)}
                    className="w-full pl-4 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                <div className="bg-slate-50 rounded-2xl p-6 border border-slate-100">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Available Attempts</p>
                  <div className="flex items-end gap-2">
                    <p className="text-4xl font-black text-slate-900">{studentsInfo.codeInfo.attempts}</p>
                    <p className="text-sm font-bold text-slate-400 mb-1.5">Remaining</p>
                  </div>
                </div>
                <div className="bg-slate-50 rounded-2xl p-6 border border-slate-100">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Time Limit</p>
                  <div className="flex items-end gap-2">
                    <p className="text-4xl font-black text-slate-900">{studentsInfo.time}</p>
                    <p className="text-sm font-bold text-slate-400 mb-1.5">Sec / Question</p>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4">Recent Performance</h4>
                <div className="space-y-3 max-h-75 overflow-y-auto pr-2 custom-scrollbar">
                  {filteredPerformance?.map(quiz => (
                    <div key={quiz.id} className="flex justify-between items-center p-4 bg-white border border-slate-100 rounded-2xl hover:border-indigo-100 hover:shadow-sm transition-all">
                      <div className="flex items-center gap-3">
                        <div className="w-2 h-2 rounded-full bg-indigo-400"></div>
                        <span className="font-bold text-slate-700">{quiz.name}</span>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="w-24 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div className="h-full bg-indigo-500" style={{width: `${quiz.score}%`}}></div>
                        </div>
                        <span className="text-sm font-black text-indigo-600 w-10 text-right">{quiz.score}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Sidebar - Right Side */}
          <div className="lg:col-span-4 space-y-8">
            <button
              onClick={() => setCurrentScreen('shop')}
              className="w-full bg-indigo-600 text-white rounded-[28px] p-8 hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100 group"
            >
              <div className="flex items-center justify-between">
                <div className="text-left">
                  <h3 className="text-2xl font-bold mb-1">Visit Shop</h3>
                  <p className="text-indigo-100 text-sm">Browse all items & upgrades</p>
                </div>
                <ArrowRight className="w-8 h-8" />
              </div>
            </button>

            <div className="bg-white rounded-4xl border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] p-6">
              <h3 className="text-lg font-bold text-slate-900 mb-6 px-2">Featured Items</h3>
              <div className="space-y-4 max-h-125 overflow-y-auto pr-2 custom-scrollbar">
                {shopItems.map(item => (
                  <div key={item.id} className="p-4 rounded-2xl border border-slate-50 bg-slate-50/50 hover:bg-white hover:border-indigo-100 hover:shadow-md transition-all group">
                    <div className="flex justify-between items-start mb-3">
                      <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-xl shadow-sm">
                        {item.icon}
                      </div>
                      <span className="font-black text-indigo-600">₦{item.price}</span>
                    </div>
                    <p className="font-bold text-slate-800 text-sm mb-1">{item.name}</p>
                    <p className="text-[11px] text-slate-500 mb-4 line-clamp-1">{item.description}</p>
                    <button
                      onClick={() => addToCart(item)}
                      className="w-full py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-indigo-600 hover:text-white hover:border-indigo-600 transition-all flex items-center justify-center gap-2"
                    >
                      <Plus className="w-3 h-3" /> Add to Cart
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-slate-900 rounded-4xl p-8 text-white shadow-xl">
              <div className="flex items-center gap-3 mb-6">
                <ShoppingCart className="w-5 h-5 text-indigo-400" />
                <h3 className="text-lg font-bold">Your Cart</h3>
              </div>
              
              {Object.keys(cart).length === 0 ? (
                <p className="text-slate-400 text-sm italic">Cart is empty...</p>
              ) : (
                <>
                  <div className="space-y-4 mb-8">
                    {Object.entries(cart).map(([id, qty]) => {
                      const item = shopItems.find(s => s.id === parseInt(id));
                      return (
                        <div key={id} className="flex justify-between items-center">
                          <div>
                            <p className="font-bold text-sm">{item?.name}</p>
                            <p className="text-xs text-indigo-400">₦{item?.price} × {qty}</p>
                          </div>
                          <div className="flex items-center gap-2 bg-slate-800 rounded-lg p-1">
                            <button onClick={() => removeFromCart(parseInt(id))} className="p-1 hover:text-indigo-400"><Minus className="w-3 h-3" /></button>
                            <span className="text-xs font-bold w-4 text-center">{qty}</span>
                            <button onClick={() => addToCart(item!)} className="p-1 hover:text-indigo-400"><Plus className="w-3 h-3" /></button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="border-t border-slate-800 pt-6">
                    <div className="flex justify-between items-center mb-6">
                      <span className="text-slate-400 text-sm">Total Amount</span>
                      <span className="text-2xl font-black text-white">₦{cartTotal}</span>
                    </div>
                    <button onClick={checkout} className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-bold transition-all shadow-lg shadow-indigo-900/20">
                      Checkout
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
      {!studentsInfo.activated && (
        <AnnouncementModal isOpen={true} onClose={() => {}} announcements={activatedChecker} />)}
      <Validator/>
    </div>
  );
}