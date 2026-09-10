'use client';

import { Lock, User } from "lucide-react";
import CustomInput from "./custom-input";
import WutheringButton from "./styled-button";
import { useState, FormEvent } from "react";
import FloatingParticles from "./particles";


const JoinRoom = () => {
  const [name, setName] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsLoading(true);
    // Add your join room logic here
    console.log("Joining room:", { name, roomCode });
  };

  return (
    <main className="min-h-screen w-full bg-[url('/dark-forest.jpeg')] bg-cover bg-center bg-no-repeat flex justify-center items-center p-4">
      <FloatingParticles />

      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md p-8 sm:p-10 backdrop-blur-md bg-black/40 border border-white/20 rounded-2xl shadow-2xl flex flex-col items-center justify-center gap-6 text-center"
      >
        <h1 className="text-white text-3xl sm:text-4xl font-semibold font-serif tracking-wider" style={{
            fontFamily: 'ui-rounded'
        }}>
          JOIN ROOM
        </h1>

        <div className="w-full flex flex-col gap-4">
          <CustomInput
            leadingIcon={<User className="size-4 text-white/80" />}
            onValueChange={setName}
            placeholder="Enter Name"
            value={name}
            required
          />

          <CustomInput
            leadingIcon={<Lock className="size-4 text-white/80" />}
            onValueChange={setRoomCode}
            placeholder="Enter Room Code (Optional)"
            value={roomCode}
            type="password"
          />
        </div>

        <WutheringButton
          type="submit"
          disabled={!name.trim() || isLoading}
          className="w-full mt-2"
        >
          {isLoading ? "Joining..." : "Join"}
        </WutheringButton>
      </form>
    </main>
  );
};

export default JoinRoom;