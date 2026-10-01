'use client';

// The whole game is a client-side single page (spec R1: instant play, no menus before the board).
import dynamic from 'next/dynamic';

const GameShell = dynamic(() => import('./game/GameShell'), { ssr: false });

export default function Home() {
  return <GameShell />;
}
