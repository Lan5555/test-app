'use client'
import React, { useEffect, useState } from 'react';
import { User, ShoppingCart, Clock, BookOpen, Star, Plus, Minus, ArrowRight, User2, Book, Circle, BookDashed, MessageSquareText, LayoutDashboard, LogOut, Settings, Menu, X } from 'lucide-react';
import { LogFactory, Product, ProductFormData, Users } from '@/app/helpers/factories';
import { useToast } from '@/app/components/toast';
import { CoreService } from '@/app/helpers/api-handler';
import { useRouter } from 'next/navigation';
import { InitializePayment } from '@/app/components/payment';
import LottieAnimation from '@/app/components/lottie';
import { Badge } from '@/app/components/badge';
import Validator from '@/app/components/validator';

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

type Screen = 'dashboard' | 'shop';

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



const handleCompletedPurchace = async () => {
  try {
    for (const [productIdStr, quantity] of Object.entries(cart)) {
      const productId = Number(productIdStr);

      const payload = {
        productId,
       params:
        productId === 1
            ? { attempts: quantity }
            : { time: quantity * 15 }

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

  return (
    <div className="min-h-screen bg-[#F8FAFC] p-4 md:p-8 font-sans">
      {payment && (
        <div className='flex justify-center items-center inset-0 bg-slate-900/60 backdrop-blur-sm fixed w-full h-screen z-50'>
          <InitializePayment name={studentsInfo.name} email={studentsInfo.email} amount={cartTotal} callback={async() => await handleCompletedPurchace()} onClose={() => setPayment(false)}></InitializePayment>
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
                      className="px-6 py-2 bg-slate-900 text-white rounded-xl font-bold text-sm hover:bg-indigo-600 transition-all shadow-lg shadow-slate-200 flex items-center gap-2"
                    >
                      <Book className="w-4 h-4" /> View Responses
                    </button>
                  </div>
                </div>
              </div>
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
                <div className="space-y-3">
                  {reviewData?.map(quiz => (
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
              <div className="space-y-4">
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
      <Validator/>
    </div>
  );
}