export interface LyricWord {
  time: number;
  text: string;
}

export interface LyricLine {
  time: number;
  text: string;
  words?: LyricWord[];
}

const TIME_TAG = /\[(\d{2}):(\d{2})\.(\d{2,3})\]/;

function parseTimeTag(tag: string): number | null {
  const match = TIME_TAG.exec(tag);
  if (!match) return null;
  const minutes = parseInt(match[1], 10);
  const seconds = parseInt(match[2], 10);
  let msStr = match[3];
  if (msStr.length === 2) msStr += '0';
  const milliseconds = parseInt(msStr, 10);
  return minutes * 60 + seconds + milliseconds / 1000;
}

function splitLyricUnits(text: string): string[] {
  if (!text) return [];
  if (typeof Intl !== 'undefined' && 'Segmenter' in Intl) {
    const segmenter = new Intl.Segmenter('zh-Hans', { granularity: 'grapheme' });
    return [...segmenter.segment(text)].map((part) => part.segment);
  }
  return [...text];
}

function parseYrcWords(text: string, lineStart: number): LyricWord[] | null {
  const yrcRegex = /(\S.*?)\((\d+),(\d+)\)/g;
  const words: LyricWord[] = [];
  let match: RegExpExecArray | null;
  while ((match = yrcRegex.exec(text)) !== null) {
    const wordText = match[1];
    const offsetMs = Number.parseInt(match[2], 10);
    if (wordText) {
      words.push({ time: lineStart + offsetMs / 1000, text: wordText });
    }
  }
  return words.length > 0 ? words : null;
}

function parseMultiTimestampLine(line: string): LyricLine | null {
  const tagRegex = /\[(\d{2}):(\d{2})\.(\d{2,3})\]/g;
  const matches = [...line.matchAll(tagRegex)];
  if (matches.length <= 1) return null;

  const words: LyricWord[] = [];
  for (let i = 0; i < matches.length; i++) {
    const current = matches[i];
    const time = parseTimeTag(current[0]);
    if (time === null) continue;

    const textStart = current.index! + current[0].length;
    const textEnd = i + 1 < matches.length ? matches[i + 1].index! : line.length;
    const text = line.slice(textStart, textEnd);
    if (text) words.push({ time, text });
  }

  if (words.length === 0) return null;
  return {
    time: words[0].time,
    text: words.map((word) => word.text).join(''),
    words,
  };
}

function charWeight(char: string): number {
  if (/^\s$/.test(char)) return 0.12;
  if (/[，。！？、；：,.!?;:'"()（）【】\[\]《》…—\-]/.test(char)) return 0.28;
  return 1;
}

function interpolateLineWords(line: LyricLine, nextLineTime: number): LyricWord[] {
  const units = splitLyricUnits(line.text);
  if (units.length === 0) return [];

  const weights = units.map(charWeight);
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0) || 1;
  const rawDuration = Math.max(nextLineTime - line.time, 0.4);
  const duration = rawDuration * 0.92;

  let elapsed = 0;
  return units.map((text, index) => {
    const word: LyricWord = { time: line.time + elapsed, text };
    elapsed += (weights[index] / totalWeight) * duration;
    return word;
  });
}

export function getWordEndTime(words: LyricWord[], index: number): number {
  if (index + 1 < words.length) return words[index + 1].time;
  return words[index].time + 0.28;
}

export function getWordFillProgress(words: LyricWord[], currentTime: number, index: number): number {
  const start = words[index].time;
  const end = getWordEndTime(words, index);
  if (currentTime <= start) return 0;
  if (currentTime >= end) return 1;
  const t = (currentTime - start) / (end - start);
  return t * t * (3 - 2 * t);
}

export function enrichLyricsWithWords(lines: LyricLine[]): LyricLine[] {
  return lines.map((line, index) => {
    if (line.words && line.words.length > 0) return line;
    const nextLineTime = index < lines.length - 1 ? lines[index + 1].time : line.time + 4;
    return {
      ...line,
      words: interpolateLineWords(line, nextLineTime),
    };
  });
}

export function parseLRC(lrc: string): LyricLine[] {
  const result: LyricLine[] = [];

  for (const rawLine of lrc.split('\n')) {
    const line = rawLine.trimEnd();
    if (!line.trim()) continue;

    const multi = parseMultiTimestampLine(line);
    if (multi) {
      result.push(multi);
      continue;
    }

    const match = TIME_TAG.exec(line);
    if (!match) continue;

    const time = parseTimeTag(match[0]);
    if (time === null) continue;

    const text = line.replace(TIME_TAG, '').trim();
    if (!text) continue;

    const yrcWords = parseYrcWords(text, time);
    if (yrcWords) {
      result.push({
        time,
        text: yrcWords.map((word) => word.text).join(''),
        words: yrcWords,
      });
      continue;
    }

    result.push({ time, text });
  }

  return result.sort((a, b) => a.time - b.time);
}

export function getActiveLyricIndex(lyrics: LyricLine[], currentTime: number, anticipation = 0.2): number {
  let activeIndex = -1;
  for (let i = 0; i < lyrics.length; i++) {
    if (currentTime >= lyrics[i].time - anticipation) {
      activeIndex = i;
    } else {
      break;
    }
  }
  return activeIndex;
}

export function getActiveWordIndex(words: LyricWord[], currentTime: number): number {
  let activeIndex = -1;
  for (let i = 0; i < words.length; i++) {
    if (currentTime >= words[i].time) {
      activeIndex = i;
    } else {
      break;
    }
  }
  return activeIndex;
}
