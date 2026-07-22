import type { DetailedHTMLProps, HTMLAttributes } from "react";

declare module "react" {
  namespace JSX {
    interface IntrinsicElements {
      "model-viewer": DetailedHTMLProps<HTMLAttributes<HTMLElement>, HTMLElement> & {
        src?: string;
        alt?: string;
        ar?: boolean;
        "ar-modes"?: string;
        "ar-placement"?: "floor" | "wall";
        "ar-scale"?: "auto" | "fixed";
        "camera-controls"?: boolean;
        "touch-action"?: string;
        "auto-rotate"?: boolean;
        autoplay?: boolean;
        "shadow-intensity"?: string;
        "shadow-softness"?: string;
        exposure?: string;
      };
    }
  }
}
