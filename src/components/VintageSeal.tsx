import React from 'react';

export function VintageSeal({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 240 240" fill="none" className={`drop-shadow-[0_10px_20px_rgba(0,0,0,0.5)] ${className}`}>
      <defs>
        <linearGradient id="goldGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#DFBB68"/>
          <stop offset="35%" stopColor="#A87B1E"/>
          <stop offset="50%" stopColor="#D4AF37"/>
          <stop offset="65%" stopColor="#8E651D"/>
          <stop offset="100%" stopColor="#DFBB68"/>
        </linearGradient>
        <radialGradient id="goldMesh" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#F5DCA8"/>
          <stop offset="70%" stopColor="#CA9B36"/>
          <stop offset="100%" stopColor="#8E651D"/>
        </radialGradient>
        <linearGradient id="bgGradient" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#2A2E38"/>
          <stop offset="100%" stopColor="#0B0C0F"/>
        </linearGradient>
        <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
          <feMerge>
            <feMergeNode in="coloredBlur"/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
        <filter id="shadow">
          <feDropShadow dx="0" dy="8" stdDeviation="6" floodColor="#000" floodOpacity="0.7"/>
        </filter>
      </defs>

      <g filter="url(#shadow)">
        {/* Scalloped Outer Edge */}
        <path d="M 120 10 
                 C 130 10, 133 15, 140 15 
                 C 148 15, 153 10, 160 14 
                 C 167 18, 168 25, 175 30 
                 C 182 35, 190 34, 195 40 
                 C 200 46, 200 55, 205 62 
                 C 210 69, 218 73, 220 80 
                 C 222 88, 218 95, 222 103 
                 C 226 110, 232 115, 230 120 
                 C 232 125, 226 130, 222 137 
                 C 218 145, 222 152, 220 160 
                 C 218 167, 210 171, 205 178 
                 C 200 185, 200 194, 195 200 
                 C 190 206, 182 205, 175 210 
                 C 168 215, 167 222, 160 226 
                 C 153 230, 148 225, 140 225 
                 C 133 225, 130 230, 120 230 
                 C 110 230, 107 225, 100 225 
                 C 92 225, 87 230, 80 226 
                 C 73 222, 72 215, 65 210 
                 C 58 205, 50 206, 45 200 
                 C 40 194, 40 185, 35 178 
                 C 30 171, 22 167, 20 160 
                 C 18 152, 22 145, 18 137 
                 C 14 130, 8 125, 10 120 
                 C 8 115, 14 110, 18 103 
                 C 22 95, 18 88, 20 80 
                 C 22 73, 30 69, 35 62 
                 C 40 55, 40 46, 45 40 
                 C 50 34, 58 35, 65 30 
                 C 72 25, 73 18, 80 14 
                 C 87 10, 92 15, 100 15 
                 C 107 15, 110 10, 120 10 Z" 
              fill="url(#goldGradient)" />

        <path d="M 120 12 
                 C 129 12, 133 17, 140 17 
                 C 148 17, 152 12, 159 16 
                 C 166 20, 167 27, 174 32 
                 C 180 37, 188 36, 193 42 
                 C 198 48, 198 56, 203 63 
                 C 208 70, 216 74, 218 81 
                 C 220 88, 216 95, 220 103 
                 C 224 110, 230 115, 228 120 
                 C 230 125, 224 130, 220 137 
                 C 216 145, 220 152, 218 159 
                 C 216 166, 208 170, 203 177 
                 C 198 184, 198 192, 193 198 
                 C 188 204, 180 203, 174 208 
                 C 167 213, 166 220, 159 224 
                 C 152 228, 148 223, 140 223 
                 C 133 223, 129 228, 120 228 
                 C 111 228, 107 223, 100 223 
                 C 92 223, 88 228, 81 224 
                 C 74 220, 73 213, 66 208 
                 C 60 203, 52 204, 47 198 
                 C 42 192, 42 184, 37 177 
                 C 32 170, 24 166, 22 159 
                 C 20 152, 24 145, 20 137 
                 C 16 130, 10 125, 12 120 
                 C 10 115, 16 110, 20 103 
                 C 24 95, 20 88, 22 81 
                 C 24 74, 32 70, 37 63 
                 C 42 56, 42 48, 47 42 
                 C 52 36, 60 37, 66 32 
                 C 73 27, 74 20, 81 16 
                 C 88 12, 92 17, 100 17 
                 C 107 17, 111 12, 120 12 Z" 
              fill="url(#bgGradient)" />
        
        {/* Inner circles */}
        <circle cx="120" cy="120" r="92" fill="none" stroke="url(#goldGradient)" strokeWidth="2.5" />
        <circle cx="120" cy="120" r="85" fill="none" stroke="url(#goldGradient)" strokeWidth="1" strokeDasharray="3 4" />
        <circle cx="120" cy="120" r="75" fill="none" stroke="url(#goldGradient)" strokeWidth="1" />
      </g>

      {/* Decorative Leaves Vectors */}
      <g stroke="url(#goldGradient)" strokeWidth="2" strokeLinecap="round" fill="none" opacity="0.8">
        <path d="M 50 140 C 40 100, 60 60, 80 50" />
        {/* Small leaves Left */}
        <path d="M 50 130 Q 55 125 58 135" fill="url(#goldGradient)"/>
        <path d="M 46 120 Q 55 115 58 125" fill="url(#goldGradient)"/>
        <path d="M 46 110 Q 55 105 58 115" fill="url(#goldGradient)"/>
        <path d="M 48 100 Q 57 95 60 105" fill="url(#goldGradient)"/>
        <path d="M 52 90 Q 61 85 64 95" fill="url(#goldGradient)"/>
        <path d="M 58 80 Q 67 75 70 85" fill="url(#goldGradient)"/>
        <path d="M 66 70 Q 75 65 78 75" fill="url(#goldGradient)"/>
        
        <path d="M 190 140 C 200 100, 180 60, 160 50" />
        {/* Small leaves Right */}
        <path d="M 190 130 Q 185 125 182 135" fill="url(#goldGradient)"/>
        <path d="M 194 120 Q 185 115 182 125" fill="url(#goldGradient)"/>
        <path d="M 194 110 Q 185 105 182 115" fill="url(#goldGradient)"/>
        <path d="M 192 100 Q 183 95 180 105" fill="url(#goldGradient)"/>
        <path d="M 188 90 Q 179 85 176 95" fill="url(#goldGradient)"/>
        <path d="M 182 80 Q 173 75 170 85" fill="url(#goldGradient)"/>
        <path d="M 174 70 Q 165 65 162 75" fill="url(#goldGradient)"/>
      </g>

      {/* Top Text Curve */}
      <path id="curveTop" d="M 55 120 A 65 65 0 0 1 185 120" fill="transparent" />
      <text fill="url(#goldGradient)" fontSize="13" letterSpacing="2" fontWeight="bold" fontFamily="serif" style={{filter: "drop-shadow(0px 2px 2px rgba(0,0,0,1))"}}>
        <textPath href="#curveTop" startOffset="50%" textAnchor="middle">SECURITY VERIFIED</textPath>
      </text>

      {/* Stars */}
      <g fill="url(#goldGradient)" style={{filter: "drop-shadow(0px 1px 2px rgba(0,0,0,0.8))"}}>
        <polygon points="120,53 123,58 128,58 124,62 126,67 120,64 114,67 116,62 112,58 117,58" />
        <polygon points="103,58 105,62 109,62 106,65 107,69 103,67 99,69 100,65 97,62 101,62" />
        <polygon points="137,58 139,62 143,62 140,65 141,69 137,67 133,69 134,65 131,62 135,62" />
      </g>

      {/* Shield */}
      <g transform="translate(93, 75) scale(1.15)" style={{filter: "drop-shadow(0px 4px 6px rgba(0,0,0,0.8))"}}>
        <path d="M24 0 L48 10 V32 C48 48 36 62 24 68 C12 62 0 48 0 32 V10 L24 0 Z" fill="#15171C" stroke="url(#goldGradient)" strokeWidth="2" strokeLinejoin="round"/>
        <path d="M24 5 L43 13 V32 C43 45 34 56 24 62 C14 56 5 45 5 32 V13 L24 5 Z" fill="url(#goldGradient)" stroke="url(#goldGradient)" strokeWidth="1" strokeLinejoin="round"/>
        {/* Lock */}
        <path d="M19 25 V20 C19 17 21 15 24 15 C27 15 29 17 29 20 V25 M15 25 H33 V42 H15 Z" fill="#1A1C23" />
        <circle cx="24" cy="31" r="2.5" fill="url(#goldGradient)"/>
        <path d="M23 33 L22 37 H26 L25 33 Z" fill="url(#goldGradient)"/>
      </g>

      {/* Bottom Text Curve */}
      <path id="curveBot" d="M 57 145 A 63 63 0 0 0 183 145" fill="transparent" />
      <text fill="url(#goldGradient)" fontSize="10" letterSpacing="1" fontWeight="bold" fontFamily="serif">
        <textPath href="#curveBot" startOffset="50%" textAnchor="middle">TWO-FACTOR AUTHENTICATION</textPath>
      </text>
      
      <circle cx="95" cy="177" r="1.5" fill="url(#goldGradient)" />
      <circle cx="102" cy="180" r="1.5" fill="url(#goldGradient)" />
      <text x="120" y="181" fill="url(#goldGradient)" fontSize="10" letterSpacing="2" fontWeight="bold" fontFamily="serif" textAnchor="middle">PROTECTED BY</text>
      <circle cx="138" cy="180" r="1.5" fill="url(#goldGradient)" />
      <circle cx="145" cy="177" r="1.5" fill="url(#goldGradient)" />

      <polygon points="120,188 123,193 128,193 124,197 126,202 120,199 114,202 116,197 112,193 117,193" fill="url(#goldGradient)" />

      {/* Ribbon / Banner */}
      <g style={{filter: "drop-shadow(0px 6px 8px rgba(0,0,0,0.6))"}}>
        {/* Ribbon Tails */}
        <path d="M 20 140 L 40 135 V 165 L 20 170 L 30 155 Z" fill="#A87B1E" />
        <path d="M 220 140 L 200 135 V 165 L 220 170 L 210 155 Z" fill="#A87B1E" />
        {/* Ribbon Center */}
        <path d="M 35 130 H 205 Q 200 145 205 160 H 35 Q 40 145 35 130 Z" fill="url(#goldMesh)" />
        <path d="M 35 130 H 205 Q 200 145 205 160 H 35 Q 40 145 35 130 Z" fill="transparent" stroke="#251F10" strokeWidth="1" strokeDasharray="4 2" />
        <circle cx="50" cy="145" r="2.5" fill="#15171C" />
        <circle cx="190" cy="145" r="2.5" fill="#15171C" />
        <text x="120" y="152" fill="#15171C" fontSize="18" fontWeight="900" fontFamily="serif" textAnchor="middle" letterSpacing="1">2FA PROTECTED</text>
      </g>

    </svg>
  );
}
