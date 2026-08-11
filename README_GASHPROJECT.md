# GASHPROJECT — Полный сайт поднят ✅

Сайт успешно собран из твоего `repomix-output.xml` и запущен на **порту 3000**.

## 🔗 Просмотр

В интерфейсе Arena нажми **Live Preview** рядом с процессом `GASHPROJECT Prod v2` — откроется сайт.
Прямая ссылка в E2B: `https://3000-{sandboxId}.e2b.app` (sandboxId автоматически в preview).

Локально внутри контейнера: http://localhost:3000

## 🧱 Что внутри — структура из кода

Это Next.js 16 (App Router) + Tailwind 4 + Drizzle ORM + Postgres

**12 разделов:**

### 🔊 Звук
- `/music` — музыкальный хаб: Audius (полные треки), Internet Archive (2.7 млн), ccMixter, **YouTube Music engine** для полных треков. Визуализатор Web Audio, тексты с таймкодами LRCLIB, персональный микс
- `/playlists` — плейлисты (гость по `guest_key` или по аккаунту)
- `/radio` — Radio Browser API 50k станций, прокси потока `/api/radio/stream`

### 📈 Рынки
- `/rates` — крипта: Binance ticker + CoinGecko fallback, графики (`/api/crypto/chart`), Fear&Greed alternative.me, курсы ЦБ РФ `cbr-xml-daily`, топ монет, биржи, Mempool difficulty, Kraken сверка
- `/weather` — Open-Meteo + избранные города
- `/news` — новости (открытые источники)

### 🎲 Развлечения
- `/casino` — 8 игр provably fair (HMAC-SHA256 serverSeed + clientSeed):
  - Crash (формула 99/(1-r), хвост ×1000), Mines, Dice, Coinflip, Roulette, Plinko, Tower, Slots, Blackjack (реальная колода deckofcardsapi)
  - Внешняя энтропия: random.org + csrng.net
- `/ai` — генерация картинок через Pollinations Flux без ключа, ру→англ перевод MyMemory, 12 стилей
- `/video` — скачивание через Cobalt + Piped mirrors, поддержка YouTube ID парсер
- `/reels` — VK короткие видео `video.search shorter=180`

### 💬 Общение
- `/notes` — публичные посты с лайками, гостевой ключ
- `/chat` — общий чат
- `/messages` — личка + real-time SSE (`/api/realtime`), typing индикатор, presence онлайн 45 сек

### Прочее
- `/tools`, `/profile`, `/login`, `/register` — auth по телефону (OTP 6 цифр, демо-код в ответе) + логин/пароль bcrypt

### 🧠 Система уровней
- `lib/levels.ts`: xpForLevel квадратичный, ранги от Новичок до Бог GASH, достижения 12 шт, монеты
- `middleware.ts` — гарантирует `guest_key` криптографически для всех гостей

## 🔑 API (41 роут)
- `/api/auth/*`, `/api/music/*` (8), `/api/crypto/*` (5), `/api/casino/*` (4), `/api/vk/*`, `/api/video/*`, `/api/radio/*`, `/api/stats`, `/api/realtime`

## 🗄 БД — схема `src/db/schema.ts`
users, otp_codes, sessions, casino_history, notes, note_likes, chat_messages, direct_messages, playlists, playlist_tracks, user_stats, game_rounds, ai_images, listening_history, favorite_cities

## 🚀 Как запускал

```bash
npm install
# DATABASE_URL обязателен (для просмотра поставил заглушку)
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/app_db npm run build
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/app_db npm run dev -- --port 3000 --hostname 0.0.0.0
# prod быстрее:
DATABASE_URL=... npx next start --port 3000 --hostname 0.0.0.0
```

Если есть реальный Postgres — подставь в .env и прогони `npx drizzle-kit push`.

## 🎨 Frontend фишки
- `globals.css` 1340 строк — неоморфный дизайн, aurora blobs, glass sidebar 248px
- `PlayerContext` — единый плеер: `<audio>` + скрытый YouTubeEngine (iframe 320x180 за экраном left:-9999 чтобы обойти политику автоплея), Web Audio Analyser → Visualizer 48 баров
- Sidebar с live XP прогрессбар, монеты, мобильная шторка
- Компоненты: `CryptoChart`, `MarketSentiment`, `BlackjackGame`, `CrashGame`, `PlinkoGame`, `RouletteWheel`, `SlotsReels`, `TowerGame`...

## ⚠️ Для полной работы нужно
- Postgres (если хочешь сохранять плейлисты/историю/чат)
- VK_TOKEN для видео/рилс

Но даже без БД главная, музыка (Audius/Archive/YouTube), крипта, AI-арт, радио, видео-скачка — работают.

## 📂 Исходники восстановлены в `/home/user/src/`

Все 110 файлов из repomix распакованы и лежат в воркспейсе.
