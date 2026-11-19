import type { ReactNode } from "react";
import styles from "./game-surface.module.css";

export default function EmbraceLayout({ children }: { children: ReactNode }) {
  return <div className={styles.gameSurface}>{children}</div>;
}
