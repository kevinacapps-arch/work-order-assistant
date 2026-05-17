# Deployment

The iPad Shortcut cannot call `localhost` on your Mac once you leave the machine. It needs a public HTTPS URL.

The simplest first deployment is a small web service on Render, Railway, or Fly.io. Render is the easiest manual setup for this project because it can run the Node service straight from a GitHub repo and gives you an HTTPS `onrender.com` URL.

This repo includes `render.yaml`, so Render can read the service settings automatically. You still need to enter `OPENAI_API_KEY` and `APP_SHARED_SECRET` in Render because those should not be committed to git.

## Recommended First Deploy: Render

1. Put this project in a GitHub repository.

2. In Render, create a new `Web Service`.

3. Connect the GitHub repo.

4. Use these settings:

```text
Language: Node
Build Command: npm install
Start Command: npm start
Health Check Path: /health
```

5. Add environment variables in Render:

```text
OPENAI_API_KEY=your OpenAI API key
APP_SHARED_SECRET=a private password for your Shortcut
OPENAI_MODEL=gpt-5.4-mini
OPENAI_REASONING_EFFORT=low
MAX_SOURCE_CHARS=12000
MAX_FIELD_NOTES_CHARS=12000
MAX_OCR_CHARS=12000
MAX_LABOR_CHARS=5000
MAX_FOLLOW_UP_CHARS=5000
```

6. Deploy the service.

7. After deploy, test:

```text
https://your-service-name.onrender.com/health
```

You should see:

```json
{
  "ok": true
}
```

8. In the iPad Shortcut, use this URL:

```text
https://your-service-name.onrender.com/api/draft
```

Headers:

```text
Content-Type: application/json
Authorization: Bearer your APP_SHARED_SECRET value
```

## What Not To Deploy

Do not commit `.env`. It is ignored by `.gitignore`.

Do not put `OPENAI_API_KEY` directly in the Shortcut for other users. The Shortcut should only know `APP_SHARED_SECRET` and the backend URL.

## Quick Local Public Test

For a short test before full deployment, you can use a tunnel such as Cloudflare Tunnel or ngrok:

```text
iPad Shortcut -> temporary HTTPS tunnel -> local server on this Mac -> OpenAI API
```

This is useful for debugging but not ideal for a team because the Mac has to stay awake and the tunnel URL may change.

## Production Shape

For your first real deployment:

```text
iPad Shortcut -> Render HTTPS URL -> this backend -> OpenAI API
```

Later, if you want stronger user privacy and team controls:

```text
iPad Shortcut -> deployed backend -> user accounts / limits / private draft storage -> OpenAI API
```

That can come after the Shortcut flow is proven.
