import { Headphones } from "lucide-react";
import React, { useEffect, useState } from "react";
import FloatingParticles from "./FloatingParticles";

interface Props {
    onDone: () => void
}
const SplashScreen:React.FC<Props> = ({onDone}) => {
   
    useEffect(() => {
        setTimeout(() => {
            onDone?.();
        }, 4000);
    },[]);
    return (
        <>
        
        <div className="w-full min-h-screen flex justify-center items-center bg-black overflow-hidden">
            <div className="flex justify-center items-center gap-5 flex-col">
                <Headphones color="white" size={60} className="fade-in"></Headphones>
                <h1 className="text-white text-3xl fade-in">Better with Headphones</h1>
            </div>
            <FloatingParticles/>
        </div>
      
        </>
    )
}
export default SplashScreen;