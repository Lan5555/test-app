'use client'
import { useState } from "react";
import Game from "./game/page";
import MainMenu from "./menu/page";
import { useRouter } from "next/navigation";
import { AudioController } from "./hooks/audioHandler";

export default function Home() {
  const router = useRouter();
  const continueGame = async () => {
  try {
    AudioController.playInitialMusicOnLoad();
  } catch (err) {
    console.warn("[menu] audio failed", err);
  }

  router.push("/pages/embrace-game/game");

  await new Promise<void>((resolve) => setTimeout(resolve, 0));
};
  const onNewGame = () => {
    AudioController.playInitialMusicOnLoad();
    router.push('/pages/embrace-game/game');
  }
  const onWatch = () => {
   // AudioController.playInitialMusicOnLoad();
    router.push('/pages/embrace-game/watch');
  }
  const onBattle = () =>router.push('/pages/embrace-game/game');


  return (
    <MainMenu onContinue={continueGame} onNewGame={onNewGame} onWatch={onWatch} onBattle={onBattle}></MainMenu>
  )
}
