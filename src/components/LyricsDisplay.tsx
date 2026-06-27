import React, { useMemo, useEffect, useState, useRef, useCallback } from 'react';
import {
  enrichLyricsWithWords,
  getActiveLyricIndex,
  getWordFillProgress,
  parseLRC,
} from '@/lib/lyrics';
import type { ThemePreset } from '@/lib/themes';

interface LyricsDisplayProps {
  lrcText: string;
  currentTime: number;
  accentHex?: string;
  theme?: ThemePreset;
  isPlaying?: boolean;
  compact?: boolean;
  wordKaraoke?: boolean;
  fontScale?: number;
}

function useSmoothedTime(currentTime: number, isPlaying: boolean): number {
  const [displayTime, setDisplayTime] = useState(currentTime);
  const anchorRef = useRef({ time: currentTime, at: performance.now() });

  useEffect(() => {
    anchorRef.current = { time: currentTime, at: performance.now() };
    if (!isPlaying) {
      setDisplayTime(currentTime);
    }
  }, [currentTime, isPlaying]);

  useEffect(() => {
    if (!isPlaying) return;

    let raf = 0;
    const tick = () => {
      const { time, at } = anchorRef.current;
      setDisplayTime(time + (performance.now() - at) / 1000);
      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [isPlaying]);

  return isPlaying ? displayTime : currentTime;
}

function KaraokeLine({
  words,
  currentTime,
  theme,
}: {
  words: { time: number; text: string }[];
  currentTime: number;
  theme: ThemePreset;
}) {
  const { accent, pendingLyric, sungLyric } = theme;

  return (
    <>
      {words.map((word, wi) => {
        const progress = getWordFillProgress(words, currentTime, wi);

        if (progress >= 0.999) {
          return (
            <span
              key={`${word.time}-${wi}`}
              style={{ color: sungLyric, textShadow: `0 0 12px ${accent}55` }}
            >
              {word.text}
            </span>
          );
        }

        if (progress <= 0.001) {
          return (
            <span key={`${word.time}-${wi}`} style={{ color: pendingLyric }}>
              {word.text}
            </span>
          );
        }

        const fillPercent = `${Math.round(progress * 100)}%`;
        return (
          <span
            key={`${word.time}-${wi}`}
            style={{
              backgroundImage: `linear-gradient(90deg, ${sungLyric} ${fillPercent}, ${pendingLyric} ${fillPercent})`,
              WebkitBackgroundClip: 'text',
              backgroundClip: 'text',
              color: 'transparent',
              textShadow: `0 0 16px ${accent}66`,
            }}
          >
            {word.text}
          </span>
        );
      })}
    </>
  );
}

export const LyricsDisplay: React.FC<LyricsDisplayProps> = ({
  lrcText,
  currentTime,
  accentHex = '#22d3ee',
  theme,
  isPlaying = true,
  compact = false,
  wordKaraoke = false,
  fontScale = 1,
}) => {
  const fontSizes = useMemo(
    () => ({
      activeMd: Math.round(32 * fontScale),
      inactiveMd: Math.round(18 * fontScale),
    }),
    [fontScale],
  );

  const activeTheme = theme ?? {
    id: 'default',
    name: 'Default',
    nameZh: '默认',
    background: 'transparent',
    accent: accentHex,
    cool: accentHex,
    warm: accentHex,
    pendingLyric: 'rgba(255,255,255,0.36)',
    sungLyric: accentHex,
  };

  const smoothTime = useSmoothedTime(currentTime, isPlaying);

  const lyrics = useMemo(() => {
    const parsed = parseLRC(lrcText);
    return wordKaraoke ? enrichLyricsWithWords(parsed) : parsed;
  }, [lrcText, wordKaraoke]);

  const activeIndex = useMemo(
    () => getActiveLyricIndex(lyrics, smoothTime),
    [lyrics, smoothTime],
  );

  const containerRef = useRef<HTMLDivElement>(null);
  const scrollWrapperRef = useRef<HTMLDivElement>(null);
  const [offsetY, setOffsetY] = useState(0);

  const centerLine = useCallback((lineIndex: number) => {
    if (!scrollWrapperRef.current || !containerRef.current || lineIndex < 0) return;
    const lineEl = scrollWrapperRef.current.children[lineIndex + 1] as HTMLElement | undefined;
    if (!lineEl) return;
    const containerCenter = containerRef.current.clientHeight / 2;
    const elTop = lineEl.offsetTop;
    const elHeight = lineEl.clientHeight;
    setOffsetY(containerCenter - elTop - elHeight / 2);
  }, []);

  useEffect(() => {
    if (activeIndex !== -1) {
      centerLine(activeIndex);
      return;
    }
    if (scrollWrapperRef.current && containerRef.current && scrollWrapperRef.current.children.length > 1) {
      const firstEl = scrollWrapperRef.current.children[1] as HTMLElement;
      const containerCenter = containerRef.current.clientHeight / 2;
      setOffsetY(containerCenter - firstEl.offsetTop + 60);
    } else {
      setOffsetY(0);
    }
  }, [activeIndex, lyrics.length, centerLine]);

  if (lyrics.length === 0) {
    return (
      <div className="flex h-full w-full items-center justify-center px-8">
        <p className="font-sans text-sm tracking-[0.2em] text-white/40 uppercase">等待歌词...</p>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`lyrics-display h-full w-full overflow-hidden select-none transition-all duration-1000 ease-out ${
        isPlaying ? 'opacity-100 blur-none' : 'opacity-70 blur-[1px]'
      }`}
      style={{
        maskImage: 'linear-gradient(to bottom, transparent, black 12%, black 88%, transparent)',
        WebkitMaskImage: 'linear-gradient(to bottom, transparent, black 12%, black 88%, transparent)',
        perspective: '1200px',
        perspectiveOrigin: compact ? 'center center' : 'left center',
      }}
    >
      <div
        className="relative flex h-full w-full flex-col px-6 md:px-10"
        style={{
          transform: compact ? 'rotateY(8deg) rotateX(2deg)' : 'rotateY(20deg) rotateX(5deg) translateZ(-50px)',
          transformOrigin: compact ? 'center center' : 'left center',
          transformStyle: 'preserve-3d',
        }}
      >
        <div
          ref={scrollWrapperRef}
          className="relative flex w-full flex-col"
          style={{
            transform: `translateY(${offsetY}px)`,
            transition: 'transform 800ms cubic-bezier(0.2, 0.8, 0.2, 1)',
          }}
        >
          <div className="absolute top-0 bottom-0 left-[8px] w-px bg-white/10 shadow-[0_0_10px_rgba(255,255,255,0.1)]" />

          {lyrics.map((line, idx) => {
            const isActive = idx === activeIndex;
            const isPast = idx < activeIndex;
            const showKaraoke = wordKaraoke && isActive && line.words && line.words.length > 0;

            return (
              <div key={`${line.time}-${idx}`} className="relative w-full py-3 pl-10 transition-all duration-700 ease-out md:py-3.5">
                <div className="absolute top-1/2 left-[8px] z-10 flex -translate-x-1/2 -translate-y-1/2 items-center justify-center">
                  {isActive ? (
                    <div
                      className="flex h-4 w-4 items-center justify-center rounded-full border-2 bg-black/50 transition-all duration-500 ease-out"
                      style={{
                        borderColor: activeTheme.accent,
                        color: activeTheme.accent,
                        boxShadow: `0 0 15px ${activeTheme.accent}88`,
                      }}
                    >
                      <div className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: activeTheme.accent }} />
                    </div>
                  ) : (
                    <div
                      className="h-[3px] w-[3px] rounded-full transition-all duration-500 ease-out"
                      style={{
                        boxShadow: isPast ? `0 0 5px ${activeTheme.accent}44` : 'none',
                        backgroundColor: isPast ? activeTheme.accent : 'rgba(255,255,255,0.2)',
                      }}
                    />
                  )}
                </div>

                <div
                  className={`pointer-events-none font-serif tracking-[0.05em] whitespace-pre-wrap drop-shadow-xl transition-all duration-700 ease-out ${
                    isActive
                      ? 'font-medium opacity-100'
                      : isPast
                        ? 'font-normal text-white/20 opacity-40 blur-[1px]'
                        : 'font-normal text-white/40 opacity-50'
                  }`}
                  style={{
                    fontSize: isActive ? fontSizes.activeMd : fontSizes.inactiveMd,
                    transform: isActive ? 'translateY(0) scale(1.05)' : 'translateY(0) scale(1)',
                    transformOrigin: 'left center',
                    textShadow: isActive
                      ? `0 0 20px ${activeTheme.accent}66, 0 2px 4px rgba(0,0,0,0.0)`
                      : '0 2px 4px rgba(0,0,0,0.0)',
                    color: isActive && !showKaraoke ? '#ffffff' : undefined,
                  }}
                >
                  {showKaraoke ? (
                    <KaraokeLine words={line.words!} currentTime={smoothTime} theme={activeTheme} />
                  ) : (
                    line.text
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
