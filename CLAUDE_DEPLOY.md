# Claude Render Deploy Checklist

Use this when a new commit has been pushed but Render is still showing an older version.

## Service

```text
Render service: work-order-assistant
Live URL: https://work-order-assistant.onrender.com
GitHub repo: kevinacapps-arch/work-order-assistant
Branch: main
```

## What To Do

1. Open the Render dashboard.
2. Open the `work-order-assistant` service.
3. Go to `Deploys`.
4. Check the latest GitHub commit on `main`.
5. Check the currently live deploy commit.
6. If the live deploy is not the latest commit, click:

```text
Manual Deploy -> Deploy latest commit
```

7. Wait for the deploy to finish.
8. Confirm the deploy status says `Live`.
9. Open:

```text
https://work-order-assistant.onrender.com
```

10. Expected result: the browser UI loads. It should not show the old JSON endpoint list.

## Do Not Change

Do not edit:

```text
OPENAI_API_KEY
APP_SHARED_SECRET
```

Do not delete or recreate the service.

Do not change billing, repo, branch, or environment variables unless Kevin explicitly asks.

## If It Fails

Open the failed deploy logs and report the exact error. Do not guess or change settings blindly.
