// Vercel serverless function: GET /api/youtube
// Returns channel stats + latest uploads for the Pushpen Gaming channel.
//
// With YOUTUBE_API_KEY set (Vercel → Project → Settings → Environment Variables)
// it uses the YouTube Data API v3: subscribers, total views, video count, latest videos.
// Without a key it falls back to public pages: RSS feed for latest videos, About page for channel totals.

const CHANNEL_ID = 'UC1w2Fo7Sk-uACEaH51UdThg'; // @PushpenGaming
const MAX_VIDEOS = 6;

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300'); // refresh every minute
  try {
    const key = process.env.YOUTUBE_API_KEY;
    const data = key ? await viaDataApi(key) : await viaRss();
    res.status(200).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message || 'youtube fetch failed' });
  }
};

async function viaDataApi(key) {
  const base = 'https://www.googleapis.com/youtube/v3/';
  const ch = await getJson(base + 'channels?part=statistics,contentDetails&id=' + CHANNEL_ID + '&key=' + key);
  const item = ch.items && ch.items[0];
  if (!item) throw new Error('channel not found');
  const st = item.statistics || {};
  const uploads = item.contentDetails && item.contentDetails.relatedPlaylists && item.contentDetails.relatedPlaylists.uploads;

  let videos = [];
  if (uploads) {
    const pl = await getJson(base + 'playlistItems?part=snippet,contentDetails&maxResults=' + MAX_VIDEOS + '&playlistId=' + uploads + '&key=' + key);
    const ids = (pl.items || []).map(function (it) { return it.contentDetails.videoId; });
    let viewsById = {}, liveById = {};
    if (ids.length) {
      const vs = await getJson(base + 'videos?part=statistics,snippet&id=' + ids.join(',') + '&key=' + key);
      (vs.items || []).forEach(function (v) { viewsById[v.id] = Number(v.statistics.viewCount); liveById[v.id] = v.snippet.liveBroadcastContent; });
    }
    videos = (pl.items || []).map(function (it) {
      const sn = it.snippet || {};
      const th = sn.thumbnails || {};
      const id = it.contentDetails.videoId;
      return {
        id: id,
        title: sn.title,
        published: it.contentDetails.videoPublishedAt || sn.publishedAt,
        thumb: (th.maxres || th.standard || th.high || th.medium || {}).url || ('https://i.ytimg.com/vi/' + id + '/hqdefault.jpg'),
        views: viewsById[id] != null ? viewsById[id] : null,
        live: liveById[id] === 'live' ? 'live' : (liveById[id] === 'upcoming' ? 'upcoming' : null)
      };
    });
  }

  let liveNow = videos.find(function (v) { return v.live === 'live'; }) || null;
  if (!liveNow) {
    const lid = await liveVideoId();
    if (lid) {
      const lv = await getJson(base + 'videos?part=snippet,statistics,liveStreamingDetails&id=' + lid + '&key=' + key);
      const it = lv.items && lv.items[0];
      if (it) {
        liveNow = { id: lid, title: it.snippet.title, published: it.snippet.publishedAt, thumb: (it.snippet.thumbnails.maxres || it.snippet.thumbnails.high || {}).url || ('https://i.ytimg.com/vi/' + lid + '/hqdefault.jpg'), views: it.liveStreamingDetails && it.liveStreamingDetails.concurrentViewers ? Number(it.liveStreamingDetails.concurrentViewers) : null, live: 'live' };
        videos = [liveNow].concat(videos.filter(function (v) { return v.id !== lid; }));
      }
    }
  }
  return {
    source: 'api',
    live: liveNow ? { id: liveNow.id, title: liveNow.title } : null,
    stats: {
      subscribers: st.hiddenSubscriberCount ? null : Number(st.subscriberCount),
      views: Number(st.viewCount),
      videos: Number(st.videoCount)
    },
    videos: videos
  };
}

// Is the channel live right now? youtube.com/channel/<id>/live redirects to the stream when one is public.
// Costs no API quota. Returns the live video id or null.
async function liveVideoId() {
  try {
    const r = await fetch('https://www.youtube.com/channel/' + CHANNEL_ID + '/live', {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36', 'Accept-Language': 'en-US,en;q=0.9', 'Cookie': 'CONSENT=YES+1; SOCS=CAI' }
    });
    if (!r.ok) return null;
    const html = await r.text();
    const canon = pick(html, new RegExp('<link rel="canonical" href="https://www\\.youtube\\.com/watch\\?v=([A-Za-z0-9_-]{11})"'));
    if (canon && /"isLive":true|"isLiveNow":true/.test(html)) return canon;
    return null;
  } catch (e) { return null; }
}

// Public channel totals scraped from the About page (no key needed). Returns null on any change in YouTube's markup.
async function publicStats() {
  try {
    const r = await fetch('https://www.youtube.com/channel/' + CHANNEL_ID + '/about', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
        'Cookie': 'CONSENT=YES+1; SOCS=CAI'
      }
    });
    if (!r.ok) return null;
    const html = await r.text();
    const subs = pick(html, /"subscriberCountText":"([^"]+)"/);
    const views = pick(html, /"viewCountText":"([^"]+)"/);
    const vids = pick(html, /"videoCountText":"([^"]+)"/);
    if (!subs && !views && !vids) return null;
    return { subscribers: parseCount(subs), views: parseCount(views), videos: parseCount(vids) };
  } catch (e) { return null; }
}
// "454 subscribers" → 454, "1.2K subscribers" → 1200, "10,962 views" → 10962
function parseCount(s) {
  if (!s) return null;
  const m = s.replace(/,/g, '').match(/([\d.]+)\s*([KMB])?/i);
  if (!m) return null;
  const mult = { K: 1e3, M: 1e6, B: 1e9 }[(m[2] || '').toUpperCase()] || 1;
  return Math.round(parseFloat(m[1]) * mult);
}

async function viaRss() {
  const xml = await getText('https://www.youtube.com/feeds/videos.xml?channel_id=' + CHANNEL_ID);
  const entries = xml.split('<entry>').slice(1);
  const videos = entries.slice(0, MAX_VIDEOS).map(function (e) {
    const id = pick(e, /<yt:videoId>([^<]+)<\/yt:videoId>/);
    const viewsMatch = e.match(/<media:statistics views="(\d+)"/);
    return {
      id: id,
      title: decode(pick(e, /<title>([^<]*)<\/title>/)),
      published: pick(e, /<published>([^<]+)<\/published>/),
      thumb: 'https://i.ytimg.com/vi/' + id + '/hqdefault.jpg',
      views: viewsMatch ? Number(viewsMatch[1]) : null
    };
  });
  const stats = await publicStats();
  const lid = await liveVideoId();
  let live = null;
  if (lid) {
    const hit = videos.find(function (v) { return v.id === lid; });
    live = { id: lid, title: hit ? hit.title : 'Live now' };
    if (hit) hit.live = 'live';
    else videos.unshift({ id: lid, title: live.title, published: new Date().toISOString(), thumb: 'https://i.ytimg.com/vi/' + lid + '/hqdefault.jpg', views: null, live: 'live' });
  }
  return { source: 'rss', live: live, stats: stats, videos: videos };
}

async function getJson(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error('HTTP ' + r.status + ' from YouTube');
  return r.json();
}
async function getText(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error('HTTP ' + r.status + ' from YouTube');
  return r.text();
}
function pick(s, re) { const m = s.match(re); return m ? m[1] : ''; }
function decode(s) {
  return s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
}
