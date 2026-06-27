export interface NowPlayingInfo {
  title: string;
  artist: string;
  album: string;
  duration: number;
  position: number;
  isPlaying: boolean;
}

const emptyNowPlaying: NowPlayingInfo = {
  title: '',
  artist: '',
  album: '',
  duration: 0,
  position: 0,
  isPlaying: false,
};

function readMediaSession(): NowPlayingInfo | null {
  if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return null;

  const metadata = navigator.mediaSession.metadata;
  if (!metadata) return null;

  return {
    title: metadata.title || '',
    artist: metadata.artist || '',
    album: metadata.album || '',
    duration: 0,
    position: 0,
    isPlaying: navigator.mediaSession.playbackState === 'playing',
  };
}

export function createMediaSessionPoller(onUpdate: (info: NowPlayingInfo | null) => void, intervalMs = 500) {
  let lastKey = '';

  const tick = () => {
    const info = readMediaSession();
    const key = info ? `${info.title}|${info.artist}|${info.isPlaying}` : '';
    if (key !== lastKey) {
      lastKey = key;
      onUpdate(info);
    }
  };

  tick();
  const timer = window.setInterval(tick, intervalMs);

  return () => {
    window.clearInterval(timer);
  };
}

export function createDemoPlayback(onTick: (position: number, isPlaying: boolean) => void) {
  let position = 0;
  let isPlaying = true;
  let timer: number | null = null;

  const start = () => {
    if (timer !== null) return;
    timer = window.setInterval(() => {
      if (isPlaying) {
        position += 0.05;
        onTick(position, isPlaying);
      }
    }, 50);
  };

  const stop = () => {
    if (timer !== null) {
      window.clearInterval(timer);
      timer = null;
    }
  };

  start();

  return {
    getPosition: () => position,
    setPosition: (nextPosition: number) => {
      position = Math.max(0, nextPosition);
      onTick(position, isPlaying);
    },
    togglePlaying: () => {
      isPlaying = !isPlaying;
      onTick(position, isPlaying);
    },
    setPlaying: (playing: boolean) => {
      isPlaying = playing;
      onTick(position, isPlaying);
    },
    reset: () => {
      position = 0;
      onTick(position, isPlaying);
    },
    dispose: stop,
  };
}

export { emptyNowPlaying };
