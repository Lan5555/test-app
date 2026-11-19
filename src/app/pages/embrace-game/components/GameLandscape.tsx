import { RotateCw, Smartphone } from "lucide-react";
import type { ReactNode } from "react";
import styles from "./game-landscape.module.css";

export default function GameLandscape({ children, required = true }: { children: ReactNode; required?: boolean }) {
  return (
    <>
      <div className={styles.game} data-required={required || undefined}>{children}</div>
      {required && <main className={styles.prompt} aria-labelledby="embrace-landscape-title">
        <div>
          <span className={styles.icon} aria-hidden="true">
            <Smartphone size={38} />
            <RotateCw size={22} />
          </span>
          <h1 id="embrace-landscape-title">Rotate to play</h1>
          <p>Turn your device sideways to continue in landscape.</p>
        </div>
      </main>}
    </>
  );
}
