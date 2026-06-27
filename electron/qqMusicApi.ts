const QQ_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

interface SearchSong {
  mid: string;
  name: string;
  singer: string;
}

interface MusicuComm {
  g_tk: number;
  uin: number;
  format: string;
  inCharset: string;
  outCharset: string;
  notice: number;
  platform: string;
  needNewCode: number;
  ct: number;
  cv: number;
}

function qqHeaders(cookie: string): Record<string, string> {
  return {
    'User-Agent': QQ_UA,
    Referer: 'https://y.qq.com/',
    Origin: 'https://y.qq.com',
    ...(cookie.trim() ? { Cookie: cookie.trim() } : {}),
  };
}

function parseUinFromCookie(cookie: string): number {
  const match = /(?:^|;\s*)uin=(\d+)/i.exec(cookie);
  if (!match) return 0;
  return Number.parseInt(match[1], 10) || 0;
}

function buildComm(cookie: string): MusicuComm {
  return {
    g_tk: 5381,
    uin: parseUinFromCookie(cookie),
    format: 'json',
    inCharset: 'utf-8',
    outCharset: 'utf-8',
    notice: 0,
    platform: 'h5',
    needNewCode: 1,
    ct: 23,
    cv: 0,
  };
}

async function callMusicu<T>(payload: Record<string, unknown>, cookie: string): Promise<T> {
  const res = await fetch('https://u.y.qq.com/cgi-bin/musicu.fcg?format=json', {
    method: 'POST',
    headers: {
      ...qqHeaders(cookie),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    throw new Error(`QQ 音乐 API 失败: HTTP ${res.status}`);
  }

  return (await res.json()) as T;
}

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/\(live\)|（live）/gi, '')
    .replace(/[^\p{L}\p{N}]/gu, '');
}

function scoreSongMatch(candidate: SearchSong, title: string, artist: string): number {
  const titleNorm = normalizeText(title);
  const artistNorm = normalizeText(artist);
  const nameNorm = normalizeText(candidate.name);
  const singerNorm = normalizeText(candidate.singer);

  let score = 0;
  if (nameNorm === titleNorm) score += 100;
  else if (nameNorm.includes(titleNorm) || titleNorm.includes(nameNorm)) score += 60;

  if (artistNorm && singerNorm) {
    const artistParts = artist.split(/[/,、|+&]/).map((part) => normalizeText(part)).filter(Boolean);
    if (artistParts.length > 0) {
      const matchedParts = artistParts.filter(
        (part) => singerNorm.includes(part) || part.includes(singerNorm),
      ).length;
      score += matchedParts * 20;
    } else if (singerNorm.includes(artistNorm) || artistNorm.includes(singerNorm)) {
      score += 40;
    }
  }

  return score;
}

function buildSearchQuery(title: string, artist: string): string {
  const cleanTitle = title.replace(/\(live\)|（live）/gi, '').trim();
  const cleanArtist = artist.trim();
  return `${cleanTitle} ${cleanArtist}`.trim() || title.trim();
}

export async function searchSongMid(
  title: string,
  artist: string,
  cookie: string,
): Promise<string | null> {
  const keyword = buildSearchQuery(title, artist);
  if (!keyword) return null;

  const data = await callMusicu<{
    req_1?: {
      code?: number;
      data?: {
        body?: {
          song?: {
            list?: Array<{
              mid?: string;
              name?: string;
              singer?: Array<{ name?: string }>;
            }>;
          };
        };
      };
    };
  }>(
    {
      comm: buildComm(cookie),
      req_1: {
        module: 'music.search.SearchCgiService',
        method: 'DoSearchForQQMusicDesktop',
        param: {
          query: keyword,
          num_per_page: 10,
          page_num: 1,
          search_type: 0,
        },
      },
    },
    cookie,
  );

  const list = data.req_1?.data?.body?.song?.list ?? [];
  if (list.length === 0) return null;

  const candidates: SearchSong[] = list
    .filter((item) => item.mid && item.name)
    .map((item) => ({
      mid: item.mid!,
      name: item.name!,
      singer: item.singer?.map((s) => s.name).filter(Boolean).join('/') ?? '',
    }));

  candidates.sort(
    (a, b) => scoreSongMatch(b, title, artist) - scoreSongMatch(a, title, artist),
  );

  return candidates[0]?.mid ?? null;
}

function decodeLyricField(value: string): string {
  if (!value) return '';
  if (value.includes('[')) return value;
  try {
    return Buffer.from(value, 'base64').toString('utf8');
  } catch {
    return value;
  }
}

function mergeLyricWithTranslation(lyric: string, trans: string): string {
  const timeRegex = /\[(\d{2}):(\d{2}\.\d{2,3})\]/;
  const transMap = new Map<string, string>();

  for (const line of trans.split('\n')) {
    const match = timeRegex.exec(line);
    if (!match) continue;
    const text = line.replace(timeRegex, '').trim();
    if (text) transMap.set(`[${match[1]}]`, text);
  }

  return lyric
    .split('\n')
    .flatMap((line) => {
      const match = timeRegex.exec(line);
      if (!match) return [line];
      const key = `[${match[1]}]`;
      const translation = transMap.get(key);
      return translation ? [line, `${key}${translation}`] : [line];
    })
    .join('\n');
}

export async function fetchSongLyrics(songmid: string, cookie: string): Promise<string> {
  const data = await callMusicu<{
    req?: {
      code?: number;
      data?: {
        lyric?: string;
        trans?: string;
      };
    };
  }>(
    {
      comm: buildComm(cookie),
      req: {
        module: 'music.musichallSong.PlayLyricInfo',
        method: 'GetPlayLyricInfo',
        param: {
          songMID: songmid,
          songID: 0,
        },
      },
    },
    cookie,
  );

  if (data.req?.code !== 0) {
    throw new Error('QQ 音乐未返回歌词（可能需要 Cookie 或该曲无歌词）');
  }

  const lyric = decodeLyricField(data.req?.data?.lyric ?? '');
  if (!lyric.trim()) {
    throw new Error('歌词为空');
  }

  const trans = decodeLyricField(data.req?.data?.trans ?? '');
  if (trans.includes('[')) {
    return mergeLyricWithTranslation(lyric, trans);
  }

  return lyric;
}

const lyricCache = new Map<string, string>();

export function clearLyricCache() {
  lyricCache.clear();
}

export async function resolveLyricsForTrack(
  title: string,
  artist: string,
  cookie: string,
): Promise<string> {
  const songmid = await searchSongMid(title, artist, cookie);
  if (!songmid) throw new Error(`未找到歌曲：${title}${artist ? ` - ${artist}` : ''}`);

  const cached = lyricCache.get(songmid);
  if (cached) return cached;

  const lyrics = await fetchSongLyrics(songmid, cookie);
  lyricCache.set(songmid, lyrics);
  return lyrics;
}
