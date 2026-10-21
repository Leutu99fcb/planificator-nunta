import type { ReactNode } from "react";

/** Un pas din animație: textul afișat sub ecran și, opțional, unde „apasă” degetul. */
export interface GuideStep {
  caption: string;
  /** cât ține pasul (ms) */
  ms: number;
  /** `data-target` al elementului spre care merge degetul */
  target?: string;
  /** degetul apasă (cu efect de atingere); ecranul reacționează după atingere */
  tap?: boolean;
}

export interface ScreenProps {
  step: number;
  /** true după ce degetul a apăsat în pasul curent (sau imediat, dacă pasul nu are atingere) */
  acted: boolean;
}

export interface GuideScene {
  id: string;
  title: string;
  steps: GuideStep[];
  Screen: (p: ScreenProps) => ReactNode;
}
