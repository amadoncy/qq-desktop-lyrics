import React from 'react';
import type { ThemePreset } from '@/lib/themes';

export const ThemeBackground: React.FC<{ theme: ThemePreset }> = ({ theme }) => {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute inset-0" style={{ backgroundColor: theme.background }} />
      <div
        className="absolute inset-0 opacity-70"
        style={{
          background: `
            radial-gradient(ellipse 80% 60% at 75% 85%, ${theme.warm}40, transparent 58%),
            radial-gradient(ellipse 65% 50% at 15% 15%, ${theme.cool}35, transparent 52%),
            radial-gradient(ellipse 40% 35% at 50% 50%, ${theme.accent}12, transparent 70%)
          `,
        }}
      />
      <div
        className="absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage: `
            linear-gradient(${theme.cool}22 1px, transparent 1px),
            linear-gradient(90deg, ${theme.cool}22 1px, transparent 1px)
          `,
          backgroundSize: '48px 48px',
        }}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/35" />
    </div>
  );
};
