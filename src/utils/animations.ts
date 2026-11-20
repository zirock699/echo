export const animations = {
  // Entrance animations
  fadeIn: "animate-in fade-in duration-200",
  slideUp: "animate-in slide-in-from-bottom-4 duration-300",
  slideDown: "animate-in slide-in-from-top-4 duration-300",
  slideRight: "animate-in slide-in-from-right-8 duration-300",
  scaleIn: "animate-in zoom-in-95 duration-200",

  // Exit animations
  fadeOut: "animate-out fade-out duration-150",
  slideOutDown: "animate-out slide-out-to-bottom-4 duration-200",

  // Micro-interactions
  scalePress: "active:scale-95 transition-transform duration-100",
  scaleHover: "hover:scale-105 transition-transform duration-200",

  // Shimmer for loading states
  shimmer:
    "animate-pulse bg-gradient-to-r from-slate-800 via-slate-700 to-slate-800",
} as const;

export const transitions = {
  smooth: "transition-all duration-200 ease-out",
  fast: "transition-all duration-150 ease-out",
  colors: "transition-colors duration-200",
  transform: "transition-transform duration-200",
  opacity: "transition-opacity duration-200",
  shadow: "transition-shadow duration-300",
} as const;
