'use client'
import { useState } from "react";
import Game from "./game/page";
import MainMenu from "./menu/page";
import { useRouter } from "next/navigation";
import { AudioController } from "./hooks/audioHandler";

export default function Home() {
  const router = useRouter();
  const continueGame = () => {
    AudioController.playGameSong();
    router.push('/pages/embrace-game/game');
  }
  const onNewGame = () => {
    AudioController.playGameSong();
    router.push('/pages/embrace-game/game');
  }
  const onWatch = () => {
    AudioController.playGameSong();
    router.push('/pages/embrace-game/watch');
  }
  const onBattle = () =>router.push('/pages/embrace-game/game');


  return (
    <MainMenu onContinue={continueGame} onNewGame={onNewGame} onWatch={onWatch} onBattle={onBattle}></MainMenu>
  )
}
