# Game logos and hover clips

Drop files here and the site picks them up automatically — no code changes.
If a file is missing, the card simply shows the built-in artwork instead.

| Game      | Logo (PNG, transparent) | Hover clip (MP4, muted) |
|-----------|-------------------------|-------------------------|
| Free Fire | `freefire.png`          | `freefire.mp4`          |
| PUBG      | `pubg.png`              | `pubg.mp4`              |
| GTA V     | `gta-v.png`             | `gta-v.mp4`             |
| Valorant  | `valorant.png`          | `valorant.mp4`          |

Hero background video (plays behind the top of the page, dimmed): `assets/hero.mp4`
— best with a 10–20 s loop of your own gameplay.

## Where to get official assets (free, for fan/creator use)

- **Free Fire** – Garena's creator/fan kit: https://ff.garena.com (footer → Media / Fan Kit)
- **PUBG / PUBG Mobile** – Krafton fan content policy + press kit: https://www.pubg.com / https://www.pubgmobile.com
- **GTA V** – Rockstar Games press assets: https://www.rockstargames.com/newswire (Rockstar's fan-site policy applies)
- **Valorant** – Riot's press kit & "Legal Jibber Jabber" fan policy: https://www.riotgames.com/en/press

Read each publisher's fan-content rules — logos are fine on a creator site as long as you don't imply the site is official.

## Recommended sizes (keeps the site fast)

- Logos: PNG with transparent background, ~600 px wide, under 150 KB.
- Hover clips: 720p, 6–12 seconds, no audio, H.264 MP4, under 3 MB each.
  Compress with HandBrake (preset "Fast 720p30") or:
  `ffmpeg -i in.mp4 -t 10 -vf scale=1280:-2 -an -crf 28 -movflags +faststart out.mp4`
- Hero video: 1080p, 10–20 s, no audio, under 8 MB.
