# Work Order Assistant

Small backend for the iPad Shortcut workflow. The Shortcut captures one work order packet at a time, then this server turns each packet into an AppFolio-ready maintenance note.

The important design choice is that one job equals one packet. Daily batch processing loops through packets one at a time, so jobs do not get mixed together and giant OCR dumps do not break the whole run.

## Run Locally

1. Copy `.env.example` to `.env`.
2. Add your `OPENAI_API_KEY`.
3. Optional: set `APP_SHARED_SECRET` so Shortcuts can call your backend without exposing the OpenAI key.
4. Start the server:

```powershell
npm start
```

The server listens at:

```text
http://localhost:8787
```

Open the browser test page:

```text
http://localhost:8787/test
```

Open the browser work surface:

```text
http://localhost:8787/app
```

## Endpoints

### Draft

```http
POST /api/draft
Authorization: Bearer your-shared-secret
Content-Type: application/json
```

Shortcuts can also use this header instead of `Authorization`:

```http
X-App-Secret: your-shared-secret
Content-Type: application/json
```

Body:

```json
{
  "packetId": "2026-05-15-1432-unit-204-kitchen-sink",
  "label": "204 kitchen sink",
  "sourceText": "Tenant reports kitchen sink backing up.",
  "fieldNotes": "Disposal humming but not spinning. Trap had blockage. Cleared trap and freed disposal.",
  "ocrText": "",
  "laborNotes": "Extra time due to tight cabinet access.",
  "followUp": ""
}
```

Response:

```json
{
  "packetId": "2026-05-15-1432-unit-204-kitchen-sink",
  "label": "204 kitchen sink",
  "draftNote": "Found kitchen sink backed up...",
  "usage": {},
  "trimReport": []
}
```

### Refine

```http
POST /api/refine
```

Body:

```json
{
  "packet": {
    "label": "204 kitchen sink",
    "fieldNotes": "Trap had blockage. Disposal was jammed. Cleared trap and freed disposal."
  },
  "currentNote": "Found kitchen sink backed up...",
  "correction": "Too formal. Make it shorter and do not say performed."
}
```

### Batch

```http
POST /api/batch
```

Body:

```json
{
  "packets": [
    {
      "label": "204 kitchen sink",
      "fieldNotes": "Trap had blockage. Disposal jammed. Cleared trap and freed disposal."
    },
    {
      "label": "112 bathroom ceiling",
      "fieldNotes": "Checked ceiling stain. No active drip found in notes provided."
    }
  ]
}
```

## Shortcut Role

The iPad Shortcuts should not do the hard AI work. They should:

- capture raw text/photos/OCR into one packet folder per job
- append later notes/photos to the chosen packet
- process packets one at a time through `/api/draft`
- send corrections through `/api/refine`
- create Apple Notes for drafts/finals so techs can read, edit, and copy the finished text easily

See `SHORTCUTS.md` for the exact action blueprint.

## Deploy

See `DEPLOYMENT.md` for the hosted setup. The iPad Shortcut needs a public HTTPS URL, not `localhost`.
