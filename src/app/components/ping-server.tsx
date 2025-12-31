'use client'
import Lottie from "lottie-web";
import { useEffect, useRef, useState } from "react";
import { CoreService } from "../helpers/api-handler";
import { useToast } from "./toast";
import { useRouter } from "next/navigation";

const PingServer: React.FC = () => {
  const container = useRef<HTMLDivElement>(null);
  const [progressValue, setProgressValue] = useState(0);
  const service: CoreService = new CoreService();
  const { addToast } = useToast();
  const router = useRouter();

  const pingServer = async () => {
    try {
      // Simulate progress increase while pinging
      let progress = 0;
      const interval = setInterval(() => {
        progress += 5;
        if (progress > 95) progress = 95; // max before response
        setProgressValue(progress);
      }, 100);

      const res = await service.get("/users/api/ping-server");
      clearInterval(interval);

      setProgressValue(100); // complete

      if (res.success) {
        router.push("/pages/login");
      } else {
        addToast(res.message || "Server ping failed", "error");
      }
    } catch (e: any) {
      addToast(e.message, "error");
    }
  };

  useEffect(() => {
    const anim = Lottie.loadAnimation({
      container: container.current!,
      renderer: "svg",
      loop: true,
      autoplay: true,
      path: "/robot.json",
    });

    pingServer();

    return () => anim.destroy();
  }, []);

  return (
    <div className="flex flex-col justify-center items-center w-full h-screen bg-white gap-10">
      <div ref={container} style={{ width: "300px", height: "300px" }}></div>
      <h4 className="text-black">Loading server...</h4>
      <div className="w-72 h-1 rounded-full bg-gray-200 overflow-hidden shadow-inner">
        <div
            className="h-full bg-linear-to-r from-purple-500 via-pink-500 to-red-500 transition-all duration-500 ease-out"
            style={{ width: `${progressValue}%` }}
        />
        </div>

    </div>
  );
};

export default PingServer;
