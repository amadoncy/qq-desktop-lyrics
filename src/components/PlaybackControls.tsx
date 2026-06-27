import React from 'react';
import { Pause, Play, SkipBack, SkipForward } from 'lucide-react';

interface PlaybackControlsProps {
  visible: boolean;
  isPlaying: boolean;
  accentHex: string;
  disabled?: boolean;
  onToggle: () => void;
  onPrevious: () => void;
  onNext: () => void;
  onMouseEnter?: () => void;
}

export const PlaybackControls: React.FC<PlaybackControlsProps> = ({
  visible,
  isPlaying,
  accentHex,
  disabled = false,
  onToggle,
  onPrevious,
  onNext,
  onMouseEnter,
}) => {
  const buttonClass =
    'no-drag rounded-full p-2.5 text-white/70 transition hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-30';

  return (
    <div
      className="pointer-events-none absolute inset-x-0 bottom-0 z-50 flex items-end justify-center pb-5"
      onMouseEnter={onMouseEnter}
    >
      <div
        className={`no-drag pointer-events-auto flex items-center justify-center gap-1 rounded-full border border-white/10 bg-black/45 px-4 py-2 backdrop-blur-md transition-all duration-300 ease-out ${
          visible ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0 pointer-events-none'
        }`}
        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
      >
        <button type="button" className={buttonClass} disabled={disabled} onClick={onPrevious} title="上一首">
          <SkipBack size={18} />
        </button>
        <button
          type="button"
          className={`${buttonClass} px-3`}
          disabled={disabled}
          onClick={onToggle}
          title={isPlaying ? '暂停' : '播放'}
          style={{ color: isPlaying ? accentHex : undefined }}
        >
          {isPlaying ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" />}
        </button>
        <button type="button" className={buttonClass} disabled={disabled} onClick={onNext} title="下一首">
          <SkipForward size={18} />
        </button>
      </div>
    </div>
  );
};
