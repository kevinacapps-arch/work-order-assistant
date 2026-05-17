# iPad Shortcut Blueprint

This is the replacement workflow. Build these in order.

## Folder Layout

Create this in iCloud Drive:

```text
Shortcuts/Work Order Packets/
```

Each day gets a folder:

```text
Shortcuts/Work Order Packets/2026-05-15/
```

Each work order gets its own packet folder:

```text
Shortcuts/Work Order Packets/2026-05-15/1432 - 204 kitchen sink/
```

Packet files:

```text
metadata.json
source_text.txt
field_notes.txt
ocr_text.txt
labor_notes.txt
follow_up.txt
draft_note.txt
final_note.txt
status.txt
photos/
```

Human-facing output should go to Apple Notes. The packet files are the backup/source records; techs should not have to dig through Files to copy text.

Recommended Notes folders:

```text
Work Order Drafts
Work Order Final Notes
```

## Shortcut 1: WO Capture Packet

Purpose: collect field scraps fast and offline.

Shortcut settings:

```text
Show in Share Sheet: On
Accepts: Text, Images, PDFs, Files
```

Actions:

1. `Format Date`
   Format: `yyyy-MM-dd`
   Save as variable: `Today`

2. `Get File`
   Path: `Shortcuts/Work Order Packets/[Today]`
   If Not Found: create folder

3. `Choose from Menu`
   Prompt: `Capture work order`
   Options: `New Job`, `Add To Existing Job`

4. `New Job` branch:
   `Ask for Input`
   Prompt: `Job label`
   Example: `204 kitchen sink`
   Save as variable: `Job Label`

   `Format Date`
   Format: `HHmm`
   Save as variable: `Job Time`

   `Text`
   Contents: `[Job Time] - [Job Label]`
   Save as variable: `Packet Name`

   `Create Folder`
   Path: `Shortcuts/Work Order Packets/[Today]/[Packet Name]`
   Save as variable: `Packet Folder`

   `Create Folder`
   Path: `[Packet Folder]/photos`

   `Text`
   Contents:
   ```json
   {
     "label": "[Job Label]",
     "created_at": "[Current Date]",
     "status": "unprocessed"
   }
   ```

   `Save File`
   Path: `[Packet Folder]/metadata.json`
   Ask Where to Save: Off

   `Text`
   Contents: `unprocessed`

   `Save File`
   Path: `[Packet Folder]/status.txt`
   Ask Where to Save: Off

5. `Add To Existing Job` branch:
   `Get Contents of Folder`
   Path: `Shortcuts/Work Order Packets/[Today]`

   `Choose from List`
   Prompt: `Pick job packet`
   Save as variable: `Packet Folder`

6. After the menu:
   `Choose from Menu`
   Prompt: `What are you adding?`
   Options:
   `Work order text`
   `Field notes`
   `Labor context`
   `Follow-up`
   `Photo / screenshot`

7. Text branches:
   For `Work order text`, ask/dictate text and append to:
   ```text
   [Packet Folder]/source_text.txt
   ```

   For `Field notes`, ask/dictate text and append to:
   ```text
   [Packet Folder]/field_notes.txt
   ```

   For `Labor context`, ask/dictate text and append to:
   ```text
   [Packet Folder]/labor_notes.txt
   ```

   For `Follow-up`, ask/dictate text and append to:
   ```text
   [Packet Folder]/follow_up.txt
   ```

   Use `Append to File`, not `Set Variable`.

8. Photo / screenshot branch:
   Use Shortcut Input if present, otherwise `Select Photos`.

   `Save File`
   Path: `[Packet Folder]/photos/`
   Ask Where to Save: Off

   `Extract Text from Image`

   `Append to File`
   Path:
   ```text
   [Packet Folder]/ocr_text.txt
   ```

9. End:
   `Show Notification`
   Text: `Saved to [Packet Name]`

## Shortcut 2: WO Process Today

Purpose: process every unprocessed packet for the day, one at a time.

Actions:

1. `Format Date`
   Format: `yyyy-MM-dd`
   Save as variable: `Today`

2. `Get Contents of Folder`
   Path: `Shortcuts/Work Order Packets/[Today]`

3. `Repeat with Each`
   Item: packet folder

4. Inside repeat, read these files if they exist:
   ```text
   metadata.json
   source_text.txt
   field_notes.txt
   ocr_text.txt
   labor_notes.txt
   follow_up.txt
   ```

5. `Dictionary`
   Keys:
   ```text
   packetId
   label
   sourceText
   fieldNotes
   ocrText
   laborNotes
   followUp
   ```

6. `Get Contents of URL`
   URL:
   ```text
   https://your-backend-domain.com/api/draft
   ```

   Method: `POST`

   Headers:
   ```text
   Content-Type: application/json
   Authorization: Bearer your-shared-secret
   ```

   Request Body: JSON dictionary from step 5

7. Get `draftNote` from response dictionary.

8. `Save File`
   Path:
   ```text
   [Packet Folder]/draft_note.txt
   ```
   Ask Where to Save: Off

9. `Append to File`
   Path:
   ```text
   Shortcuts/Work Order Packets/[Today]/Daily Output - [Today].txt
   ```

   Text to append:
   ```text
   [Packet Folder Name]:
   [draftNote]

   ```

10. `Create Note`
    Folder: `Work Order Drafts`

    Title:
    ```text
    [Packet Folder Name]
    ```

    Body:
    ```text
    [draftNote]
    ```

    This is the tech-facing note they can open, read, edit, and copy from Apple Notes.

11. `Text`
    Contents: `drafted`

12. `Save File`
    Path:
    ```text
    [Packet Folder]/status.txt
    ```
    Ask Where to Save: Off

## Shortcut 3: WO Refine Note

Purpose: keep the correction loop fast.

Actions:

1. Pick today's packet folder.
2. Read `draft_note.txt`.
3. `Ask for Input`
   Prompt: `What needs changed?`
4. Build dictionary:
   ```text
   packet: original packet fields
   currentNote: draft_note.txt
   correction: typed/dictated correction
   ```
5. POST to:
   ```text
   https://your-backend-domain.com/api/refine
   ```
6. Get `revisedNote`.
7. Save to:
   ```text
   [Packet Folder]/final_note.txt
   ```
8. `Create Note`
   Folder: `Work Order Final Notes`

   Title:
   ```text
   FINAL - [Packet Folder Name]
   ```

   Body:
   ```text
   [revisedNote]
   ```

9. `Copy to Clipboard`
   Text: `revisedNote`

10. `Show Result`
    Text: `revisedNote`

## Build Notes

The most important Shortcuts habit here is file appending. Do not carry a full-day note as one variable. Every branch writes to the current packet folder, and the processor reads each folder separately.

For users, the finished text lives in Apple Notes. Files are for the shortcut to stay organized; Notes is where the tech reads/copies/edits the output.
