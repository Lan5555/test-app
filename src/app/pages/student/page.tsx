"use client";
import { Dialog } from "@mui/material";
import { Loader, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { AnnouncementModal } from "@/app/components/dynamic-modal";
import PageState from "@/app/components/page-state";
import { InitializePayment } from "@/app/components/payment";
import {
  PortalAccount,
  PortalDashboard,
  PortalHeader,
  type PortalScreen,
  PortalShop,
  PortalSidebar,
} from "@/app/components/student/portal";
import { useToast } from "@/app/components/toast";
import Validator from "@/app/components/validator";
import { CoreService } from "@/app/helpers/api-handler";
import {
  LogFactory,
  Product,
  type ProductFormData,
  Users,
} from "@/app/helpers/factories";
import "@/app/components/study/study.css";

type Screen = PortalScreen;
const service = new CoreService();

export default function StudentDashboard() {
  const [currentScreen, setCurrentScreen] = useState<Screen>("dashboard");

  const [cart, setCart] = useState<Record<number, number>>({});
  const { addToast, studentsInfo, setStudentInfo } = useToast();
  const [reviewData, setReviewData] = useState<LogFactory[]>([]);
  const [shopItems, setShopItems] = useState<ProductFormData[]>([]);
  const [reviewsLoading, setReviewsLoading] = useState(true);
  const [reviewsError, setReviewsError] = useState("");
  const [shopLoading, setShopLoading] = useState(true);
  const [shopError, setShopError] = useState("");
  const [payment, setPayment] = useState<boolean>(false);
  const router = useRouter();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [performanceSearch, setPerformanceSearch] = useState("");
  const [quizKey, setQuizKey] = useState("");
  const [isKeyModalOpen, setIsKeyModalOpen] = useState(false);
  const [isKeyLoading, setIsKeyLoading] = useState(false);
  const [paySubscription, setPaySubscription] = useState<boolean>(false);

  const refresh = async (email: string, code: string) => {
    try {
      const res = await service.send("/users/api/login-student", {
        email,
        code,
      });
      if (res.success) {
        const result = Users.fromJson(res.data!);
        setStudentInfo(result);
      } else {
        addToast(res.message, "error");
      }
    } catch (e: any) {
      addToast(e.message, "error");
    }
  };

  const fetchReviews = useCallback(async () => {
    setReviewsLoading(true);
    setReviewsError("");
    try {
      const res = await service.get(
        `/review/api/fetch-reviews?userId=${studentsInfo.id}`,
      );
      if (res.success) {
        const result = Array.isArray(res.data)
          ? res.data
          : res.data
            ? [res.data]
            : [];
        const value = result.map((u) => LogFactory.fromJson(u));
        setReviewData(value);
      } else {
        setReviewsError(
          res.message || "Your reviews could not be loaded. Please try again.",
        );
      }
    } catch (e: any) {
      setReviewsError(e.message || "Your reviews could not be loaded.");
    } finally {
      setReviewsLoading(false);
    }
  }, [studentsInfo.id]);

  const fetchShopItems = useCallback(async () => {
    setShopLoading(true);
    setShopError("");
    try {
      const res = await service.get("/shop/api/fetch-products");
      if (!res.success)
        throw new Error(
          res.message || "The shop is unavailable. Please try again.",
        );
      const result = Array.isArray(res.data)
        ? res.data
        : res.data
          ? [res.data]
          : [];
      const value = result.map((u) => Product.fromJson(u));
      setShopItems(value);
    } catch (e: any) {
      setShopError(e.message || "The shop could not be loaded.");
    } finally {
      setShopLoading(false);
    }
  }, []);

  useEffect(() => {
    const userSession = sessionStorage.getItem("userSession");
    if (!userSession) {
      router.push("/pages/login");
      return;
    }

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
      // Clear session safely
      sessionStorage.removeItem("userSession");
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [router]);
  useEffect(() => {
    if (studentsInfo.id > 0) {
      void fetchReviews();
      void fetchShopItems();
    }
  }, [studentsInfo.id, fetchReviews, fetchShopItems]);

  const addToCart = (item: ProductFormData): void => {
    if (Object.keys(cart).length > 0 && !cart[item.id]) {
      addToast("You can only purchase one item at a time");
      return;
    }
    setCart((prev) => ({
      ...prev,
      [item.id]: (prev[item.id] || 0) + 1,
    }));
    addToast("Added to cart successfully", "success");
  };

  const removeFromCart = (itemId: number): void => {
    setCart((prev) => {
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
              ? { attempts: quantity }
              : productId === 2
                ? { time: quantity * 15 }
                : productId === 3
                  ? { quizKey: uniqueId }
                  : productId === 4
                    ? { program: shopItems.find((item) => item.id === 4)?.name }
                    : productId === 5
                      ? {
                          program: shopItems.find((item) => item.id === 5)
                            ?.name,
                        }
                      : {
                          program: shopItems.find((item) => item.id === 6)
                            ?.name,
                        },
        };

        const res = await service.send(
          `/users/api/update-after-pay/${studentsInfo.id}`,
          payload,
        );
        if (res.success) {
          addToast(res.message, "success");
          await refresh(studentsInfo.email, studentsInfo.codeInfo.code);
        } else {
          addToast(res.message, "error");
        }
      }

      setCart({});
      setPayment(false);
    } catch (e: any) {
      addToast(e.message, "error");
    }
  };

  const cartTotal = Object.entries(cart).reduce((sum, [id, qty]) => {
    const item = shopItems.find((s) => s.id === parseInt(id));
    return sum + (item?.price || 0) * qty;
  }, 0);

  const checkout = (): void => {
    if (cartTotal < 1) {
      addToast("Cart items too low", "error");
      return;
    }
    setPayment(true);
  };

  const handleQuizAccess = async () => {
    if (quizKey.trim() === "") {
      addToast("Please enter a valid access key", "error");
      return;
    }
    setIsKeyLoading(true);
    try {
      const res = await service.send(
        `/misc/api/validate-key/${studentsInfo.id}`,
        { key: quizKey },
      );
      if (res.success) {
        localStorage.setItem("revealQuizId", res.data!.quizId);
        router.push("/pages/reveal-quiz");
        setIsKeyModalOpen(false);
        setQuizKey("");
      } else {
        addToast(res.message, "error");
      }
    } finally {
      setIsKeyLoading(false);
    }
  };

  const handleCompletedSubcription = async () => {
    try {
      const res = await service.get(
        `${process.env.NEXT_PUBLIC_ACTIVATE_USER_LINK}/${studentsInfo.id}`,
      );
      if (res.success) {
        await refresh(studentsInfo.email, studentsInfo.codeInfo.code);
        setPaySubscription(false);
        addToast(res.message, "success");
      } else {
        addToast(res.message, "error");
      }
    } catch (e: any) {
      addToast(e.message, "error");
    }
  };

  if (!studentsInfo.id)
    return (
      <div className="student-portal">
        <PageState
          loading
          title="Opening your learning space."
          description="Preparing your student profile and assessment details."
        />
        <Validator />
      </div>
    );
  return (
    <div className="student-portal">
      <PortalSidebar
        student={studentsInfo}
        screen={currentScreen}
        open={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        onNavigate={setCurrentScreen}
        onLogout={() => {
          sessionStorage.removeItem("userSession");
          router.push("/pages/login");
        }}
      />
      <div className="student-main">
        <PortalHeader
          menuOpen={isSidebarOpen}
          screen={currentScreen}
          onOpenMenu={() => setIsSidebarOpen(true)}
          cartCount={Object.values(cart).reduce(
            (sum, quantity) => sum + quantity,
            0,
          )}
          onOpenShop={() => setCurrentScreen("shop")}
        />
        {currentScreen === "dashboard" ? (
          <PortalDashboard
            student={studentsInfo}
            reviews={reviewData}
            loading={reviewsLoading}
            error={reviewsError}
            search={performanceSearch}
            onSearch={setPerformanceSearch}
            onRetry={fetchReviews}
            onReveal={() => setIsKeyModalOpen(true)}
            onShop={() => setCurrentScreen("shop")}
          />
        ) : currentScreen === "shop" ? (
          <PortalShop
            products={shopItems}
            loading={shopLoading}
            error={shopError}
            onRetry={fetchShopItems}
            cart={cart}
            onAdd={addToCart}
            onRemove={removeFromCart}
            onCheckout={checkout}
          />
        ) : (
          <PortalAccount student={studentsInfo} />
        )}
      </div>
      {(payment || paySubscription) && (
        <div className="student-payment-overlay">
          <InitializePayment
            name={studentsInfo.name}
            email={studentsInfo.email}
            amount={paySubscription ? 2000 : cartTotal}
            callback={
              paySubscription
                ? handleCompletedSubcription
                : handleCompletedPurchace
            }
            onClose={() => {
              setPayment(false);
              setPaySubscription(false);
            }}
          />
        </div>
      )}
      {isKeyModalOpen && (
        <Dialog
          open
          onClose={() => setIsKeyModalOpen(false)}
          maxWidth="xs"
          fullWidth
          aria-labelledby="student-key-title"
        >
          <section
            className="student-access-dialog"
            aria-labelledby="student-key-title"
          >
            <button
              type="button"
              className="student-dialog-close"
              onClick={() => setIsKeyModalOpen(false)}
              aria-label="Close quiz access"
            >
              <X size={20} />
            </button>
            <p className="study-eyebrow">Ready for a closer look?</p>
            <h2 id="student-key-title">Unlock your quiz.</h2>
            <p>
              Enter the access key purchased from your student shop to reveal
              the quiz.
            </p>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                void handleQuizAccess();
              }}
            >
              <label htmlFor="student-quiz-key">Quiz access key</label>
              <input
                id="student-quiz-key"
                value={quizKey}
                onChange={(event) => setQuizKey(event.target.value)}
                placeholder="Enter your access key"
                required
              />
              <button
                type="submit"
                className="study-button-primary"
                disabled={isKeyLoading}
              >
                {isKeyLoading ? (
                  <>
                    <Loader size={17} className="animate-spin" />
                    Checking your key…
                  </>
                ) : (
                  "Reveal quiz"
                )}
              </button>
            </form>
            <button
              type="button"
              className="student-access-cancel"
              onClick={() => setIsKeyModalOpen(false)}
            >
              Back to your dashboard
            </button>
          </section>
        </Dialog>
      )}
      {currentScreen === "dashboard" &&
        !studentsInfo.activated &&
        !paySubscription && (
          <AnnouncementModal
            isOpen
            onClose={() => {}}
            announcements={[
              {
                id: "Student-Activation",
                title: "Activate your learning space",
                body: "Your account is currently inactive. Activate your subscription to access all features.",
                cta: {
                  label: "Activate dashboard",
                  onClick: () => setPaySubscription(true),
                },
              },
            ]}
          />
        )}
      <Validator />
    </div>
  );
}
