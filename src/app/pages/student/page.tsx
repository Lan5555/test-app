'use client'
import React, { useEffect, useState } from 'react';
import { User, ShoppingCart, Clock, BookOpen, Star, Plus, Minus, ArrowRight, User2, Book, Circle } from 'lucide-react';
import { LogFactory, Product, ProductFormData, Review, Users } from '@/app/helpers/factories';
import { useToast } from '@/app/components/toast';
import { CoreService } from '@/app/helpers/api-handler';
import { useRouter } from 'next/navigation';
import { InitializePayment } from '@/app/components/payment';
import LottieAnimation from '@/app/components/lottie';
import { Badge } from '@/app/components/badge';

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
    const userSession = localStorage.getItem('userSession');
  if (!userSession) {
    router.push('/pages/login');
    return;
  }

     const handleBeforeUnload = (e: BeforeUnloadEvent) => {
    e.preventDefault();
    e.returnValue = '';
    // Clear session safely
    localStorage.removeItem('userSession');
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

  if (currentScreen === 'shop') {
    return (
      <div className="min-h-screen bg-linear-to-br from-blue-50 to-indigo-100 p-6">
        <div className="max-w-7xl mx-auto">
          <button
            onClick={() => setCurrentScreen('dashboard')}
            className="mb-6 flex items-center gap-2 text-indigo-600 font-semibold hover:text-indigo-800 transition"
          >
            ← Back to Dashboard
          </button>
          <div className="bg-white rounded-xl shadow-lg p-8">
            <h1 className="text-4xl font-bold text-gray-800 mb-6">Shop Screen</h1>
             <div className="space-y-3 max-h-80 overflow-y-auto">
                {shopItems.map(item => (
                  <div key={item.id} className="border border-gray-200 rounded-lg p-3 hover:border-indigo-400 hover:bg-indigo-50 transition">
                    <div className="flex justify-between items-start gap-2 mb-2">
                      <div className="flex-1">
                        <p className="font-semibold text-gray-800">{item.name}</p>
                        <p className="text-xs text-gray-600">{item.description}</p>
                      </div>
                      <span className="text-2xl">{item.icon}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-indigo-600">₦{item.price} 🏷️</span>
                      <button
                        onClick={() => addToCart(item)}
                        className="bg-indigo-600 text-white px-4 py-1 rounded text-sm hover:bg-indigo-700 transition flex justify-center gap-2 items-center"
                      >
                        <ShoppingCart className='w-4 h-4'></ShoppingCart> Add to cart
                      </button>
                    </div>
                  </div>
                ))}
              </div>
          </div>
          <div className="bg-white rounded-xl shadow-lg p-6 mt-10">
              <h3 className="text-lg font-bold text-gray-800 mb-4">Cart</h3>
              {Object.keys(cart).length === 0 ? (
                <p className="text-gray-600 text-sm">Your cart is empty</p>
              ) :  (
                <>
                  <div className="space-y-2 mb-4 max-h-40 overflow-y-auto">
                    {Object.entries(cart).map(([id, qty]) => {
                      const item = shopItems.find(s => s.id === parseInt(id));
                      return (
                        <div key={id} className="flex justify-between items-center text-sm border-b pb-2">
                          <div>
                            <p className="font-semibold text-gray-800">{item?.name}</p>
                            <p className="text-gray-600 animate-pulse">₦{item?.price} 🏷️ × {qty}</p>
                          </div>
                          <div className="flex gap-1">
                            <button
                              onClick={() => removeFromCart(parseInt(id))}
                              className="bg-gray-200 text-gray-700 p-1 rounded hover:bg-gray-300 transition"
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                            <button
                              onClick={() => addToCart(item!)}
                              className="bg-gray-200 text-gray-700 p-1 rounded hover:bg-gray-300 transition"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="border-t pt-3">
                    <div className="flex justify-between items-center mb-3">
                      <span className="font-bold text-gray-800">Total:</span>
                      <span className="text-lg font-bold text-indigo-600">{cartTotal} 🏷️</span>
                    </div>
                    <button
                      onClick={checkout}
                      disabled={cartTotal < 1}
                      className={`w-full py-2 rounded font-semibold transition ${
                        cartTotal < 1
                          ? 'bg-gray-300 text-gray-600 cursor-not-allowed'
                          : 'bg-indigo-600 text-white hover:bg-indigo-700'
                      }`}
                    >
                      Checkout
                    </button>
                  </div>
                </>
              )}
            </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-linear-to-br from-blue-50 to-indigo-100 p-6">
        {payment && (
            <div className='flex justify-center items-center inset-0 bg-black/50 fixed top-[50%] left-[50%] w-full h-screen transform-[translate(-50%,-50%)]'>
            <InitializePayment name={studentsInfo.name} email={studentsInfo.email} amount={cartTotal} callback={async() => await handleCompletedPurchace()} onClose={() => setPayment(false)}></InitializePayment>
            </div>
            )}
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-800">Student Dashboard</h1>
          <p className="text-gray-600 mt-2">Welcome back, track your progress and shop for study resources</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content - Left Side */}
          <div className="lg:col-span-2 space-y-6">
            {/* Profile Card */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <div className="flex items-center gap-6">
                <LottieAnimation path={'/read.json'} style={{width:'150px', height:'150px'}}/>
                {/* <div className="text-6xl rounded-full p-2 shadow"><User2 className='text-black'></User2></div> */}
                <div>
                  <h2 className="text-2xl text-purple-700 font-semibold">Name: {studentsInfo.name}</h2>
                  <p className="text-gray-600">User id: {studentsInfo.id}</p>
                  <p className="text-gray-600">Email: {studentsInfo.email}</p>
                  <p className="text-indigo-600 font-semibold mt-1">Average score: {studentsInfo.score}</p>
                  <button className='bg-linear-to-tr from-indigo-600 to-purple-600 p-2 shadow rounded-xl mt-4 transition hover:bg-amber-50 cursor-pointer flex justify-center gap-2' onClick={() => router.push('/pages/reviews')}><Book></Book>View Your Responses</button>
                </div>
              </div>
            </div>

            {/* Quiz Attempts Section */}
            <div className="bg-white rounded-xl shadow-lg p-6 space-y-6">
              <h3 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                <BookOpen className="w-6 h-6 text-indigo-600" />
                Quiz Attempts
              </h3>

              {/* Overall Attempts Bar */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="font-semibold text-gray-800">Overall Attempts</span>
                  <span className="text-sm font-bold text-indigo-600">{studentsInfo.codeInfo.attempts}</span>
                </div>
                <div className="bg-gray-200 rounded-full h-3">
                  <div 
                    className="bg-indigo-600 h-3 rounded-full transition-all duration-300" 
                    style={{width: `${(studentsInfo.codeInfo.attempts / studentsInfo.codeInfo.attempts) * 100}%`}}
                  ></div>
                </div>
              </div>

              {/* Available Attempts & Time per Question */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-indigo-50 rounded-lg p-4 border border-indigo-200">
                  <p className="text-sm text-gray-600 mb-1">Available Attempts</p>
                  <p className="text-3xl font-bold text-indigo-600">{studentsInfo.codeInfo.attempts}</p>
                </div>
                <div className="bg-purple-50 rounded-lg p-4 border border-purple-200">
                  <p className="text-sm text-gray-600 mb-1">Time per Question</p>
                  <p className="text-3xl font-bold text-purple-600">{studentsInfo.time}s</p>
                </div>
              </div>

              {/* Recent Quizzes */}
              <div>
                <h4 className="text-lg font-semibold text-gray-800 mb-3">Recent Quizzes</h4>
                <div className="space-y-2">
                  {reviewData?.map(quiz => (
                    <div key={quiz.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                      <span className="font-medium text-gray-800">{quiz.name}</span>
                      <span className="text-sm font-bold text-white bg-indigo-600 px-3 py-1 rounded-full">
                        {quiz.score}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Shop - Right Side */}
          <div className="lg:col-span-1 space-y-6">


            {/* Shop Button */}
            <button
              onClick={() => setCurrentScreen('shop')}
              className="w-full bg-linear-to-r from-indigo-600 to-purple-600 text-white rounded-xl shadow-lg p-6 hover:shadow-xl transition transform hover:scale-105"
            >
              <div className="flex items-center justify-between">
                <div className="text-left">
                  <h3 className="text-2xl font-bold mb-1">Visit Shop</h3>
                  <p className="text-indigo-100 text-sm">Browse all items & upgrades</p>
                </div>
                <ArrowRight className="w-8 h-8" />
              </div>
            </button>

            {/* Shop Items Preview */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h3 className="text-lg font-bold text-gray-800 mb-4">Featured Items</h3>
              <div className="space-y-3 max-h-80 overflow-y-auto">
                {shopItems.map(item => (
                  <div key={item.id} className="border border-gray-200 rounded-lg p-3 hover:border-indigo-400 hover:bg-indigo-50 transition">
                    <div className="flex justify-between items-start gap-2 mb-2">
                      <div className="flex-1">
                        <p className="font-semibold text-gray-800">{item.name}</p>
                        <p className="text-xs text-gray-600">{item.description}</p>
                      </div>
                      <span className="text-2xl">{item.icon}</span>
                    </div>
                    <div className="flex justify-between items-center">
                        <Badge variant={'danger'} label=''>
                        <div className='flex justify-center items-center border p-1 rounded-xl bg-linear-to-tr from-purple-100 to-transparent'>
                      <span className="font-bold text-indigo-600">₦{item.price} 🏷️</span>
                      
                      </div>
                      </Badge>
                      <button
                        onClick={() => addToCart(item)}
                        className="bg-indigo-600 text-white px-3 py-1 rounded text-sm hover:bg-indigo-700 transition flex justify-center gap-2 items-center"
                      >
                       <ShoppingCart className='w-4 h-4'></ShoppingCart> Add to cart
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Cart */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h3 className="text-lg font-bold text-gray-800 mb-4">Cart</h3>
              {Object.keys(cart).length === 0 ? (
                <p className="text-gray-600 text-sm">Your cart is empty</p>
              ) : (
                <>
                  <div className="space-y-2 mb-4 max-h-40 overflow-y-auto">
                    {Object.entries(cart).map(([id, qty]) => {
                      const item = shopItems.find(s => s.id === parseInt(id));
                      return (
                        <div key={id} className="flex justify-between items-center text-sm border-b pb-2">
                          <div>
                            <p className="font-semibold text-gray-800">{item?.name}</p>
                            <p className="text-gray-600">₦{item?.price} 🏷️ × {qty}</p>
                          </div>
                          <div className="flex gap-1">
                            <button
                              onClick={() => removeFromCart(parseInt(id))}
                              className="bg-gray-200 text-gray-700 p-1 rounded hover:bg-gray-300 transition"
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                            <button
                              onClick={() => addToCart(item!)}
                              className="bg-gray-200 text-gray-700 p-1 rounded hover:bg-gray-300 transition"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="border-t pt-3">
                    <div className="flex justify-between items-center mb-3">
                      <span className="font-bold text-gray-800">Total:</span>
                      <span className="text-lg font-bold text-indigo-600">{cartTotal} 🏷️</span>
                    </div>
                    <button
                      onClick={checkout}
                      disabled={cartTotal < 1}
                      className={`w-full py-2 rounded font-semibold transition ${
                        cartTotal < 1
                          ? 'bg-gray-300 text-gray-600 cursor-not-allowed'
                          : 'bg-indigo-600 text-white hover:bg-indigo-700'
                      }`}
                    >
                      Checkout
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