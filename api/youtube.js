// Vercel serverless function: GET /api/youtube
// Returns channel stats + latest uploads for the Pushpen Gaming channel.
//
// With YOUTUBE_API_KEY set (Vercel → Project → Settings → Environment Variables)
// it uses the YouTube Data API v3: subscribers, total views, video count, latest videos.
// Without a key it falls back to the public RSS feed: latest videos only (no channel totals).

const CHANNEL_ID = 'UC1w2Fo7Sk-uACEaH51UdThg'; // @PushpenGaming
const MAX_VIDEOS = 6;

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate=3600');
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
    let viewsById = {};
    if (ids.length) {
      const vs = await getJson(base + 'videos?part=statistics&id=' + ids.join(',') + '&key=' + key);
      (vs.items || []).forEach(function (v) { viewsById[v.id] = Number(v.statistics.viewCount); });
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
        views: viewsById[id] != null ? viewsById[id] : null
      };
    });
  }

  return {
    source: 'api',
    stats: {
      subscribers: st.hiddenSubscriberCount ? null : Number(st.subscriberCount),
      views: Number(st.viewCount),
      videos: Number(st.videoCount)
    },
    videos: videos
  };
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
  return { source: 'rss', stats: null, videos: videos };
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
