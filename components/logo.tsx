import React from 'react';

export const Logo = ({ scale = 1 }: { scale?: number }) => {
  const [isMounted, setIsMounted] = React.useState(false);

  React.useEffect(() => {
    const timer = setTimeout(() => setIsMounted(true), 100);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div 
      className="flex items-center gap-1.5 group cursor-default"
      style={{ transform: `scale(${scale})`, transformOrigin: 'left' }}
    >
      {/* Icon Container */}
      <div className="relative flex h-14 w-14 items-center justify-center shrink-0">
        <svg 
          viewBox="0 0 100 100" 
          style={{ width: '40px', height: '40px' }} 
          className="relative z-10"
          shapeRendering="geometricPrecision"
        >
          {/* V Path Background */}
          <path d="M15 35 L50 90 L85 35" stroke="#1e293b" strokeWidth="10" strokeLinecap="round" fill="none" />
          
          {/* V Path: Deep Blue Flow */}
          <path 
            d="M15 35 L50 90 L85 35" 
            stroke="#1d4ed8" 
            strokeWidth="10" 
            strokeLinecap="round" 
            fill="none"
            strokeDasharray="30 150" 
            className={isMounted ? "animate-[flowV_4s_linear_infinite]" : ""}
          />
          
          {/* T Path Background: Size strictly H35-65, V20-65 */}
          <path d="M35 20 H65 M50 20 V65" stroke="#475569" strokeWidth="10" strokeLinecap="round" fill="none" />
          
          {/* Single Dash: High-Impact Collision then Fade-to-White */}
          <path 
            d="M35 20 L65 20 M50 20 L50 65" 
            stroke="#ffffff"
            strokeWidth="10" 
            strokeLinecap="round" 
            fill="none"
            strokeDasharray="18 150" 
            className={isMounted ? "animate-[collisionFade_2s_linear_infinite]" : ""} 
          />

          {/* Pulsing Status Indicator */}
          <circle cx="50" cy="88" r="4" fill="white" className="animate-pulse" />
        </svg>
      </div>

      {/* Brand Text Container */}
      <div className="flex flex-col justify-center translate-y-1 h-14">
        <div className="flex items-baseline leading-none">
          <span className="text-3xl font-black tracking-tighter text-white uppercase italic">
            Time
          </span>
          <span className="text-3xl font-extralight tracking-tighter italic ml-1.5 bg-gradient-to-b from-blue-400 via-blue-600 to-blue-900 bg-clip-text text-transparent">
            Vault
          </span>
        </div>

        {/* Tagline Section */}
        <div className="flex items-center gap-3 pl-1 opacity-80 mt-1">
          <div className="h-[1px] w-8 bg-gradient-to-r from-blue-600/60 to-transparent shrink-0 -translate-y-[1px]" />
          <span className="text-[9px] uppercase tracking-[0.45em] text-zinc-400 font-bold font-mono whitespace-nowrap -translate-y-[1px]">
            Legacy Secured
          </span>
        </div>
      </div>
      
      <style jsx>{`
        @keyframes flowV {
          from { stroke-dashoffset: 180; }
          to { stroke-dashoffset: 0; }
        }

        /* Collision + End Fade Logic */
        @keyframes collisionFade {
          /* Starts White on the left of the T-bar */
          0%, 5% {
            stroke: #ffffff;
            filter: brightness(1) drop-shadow(0 0 0px transparent);
          }
          /* Quickly turns Blue as it hits the junction */
          15%, 60% {
            stroke: #3b82f6;
            filter: brightness(2) drop-shadow(0 0 12px #3b82f6);
          }
          /* Nears the bottom: Returns to White before the end of the stroke */
          80%, 100% { 
            stroke: #ffffff;
            filter: brightness(1) drop-shadow(0 0 0px transparent);
          }
          from { stroke-dashoffset: 165; }
          to { stroke-dashoffset: 0; }
        }
        
        svg path {
          will-change: stroke-dashoffset, stroke, filter;
          transform: translateZ(0); 
          backface-visibility: hidden;
        }
      `}</style>
    </div>
  );
};