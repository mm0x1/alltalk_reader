# Presenting Readhouse

For showing Readhouse when AO3 is back (about 2026-11-13).

## The pitch

> **Readhouse reads your books aloud: EPUBs, text files and AO3 fics, in voices you choose,
> from your own computer to your phone.**

Shorter, for a slide title or a post: **Your books, read aloud. On your phone, from your own
computer.**

Longer, if there is a breath for a second sentence: *It's a quiet reading room: the sentence
being read is marked as it goes, it keeps your place on every device, and saved chapters play
offline.*

## The video

[`docs/media/readhouse-phone.mp4`](media/readhouse-phone.mp4): 32 seconds on an iPhone-sized
screen, no sound (browser recordings have none; the voice is AllTalk's, so play real audio live
if you can). What it shows, in order, with a line to say over each part:

| Time | On screen | Say |
| --- | --- | --- |
| 0–2 s | The shelf: the book to continue, then the rest | "Your books, on a shelf that remembers where you were." |
| 2–17 s | Pride and Prejudice opens; play; the passage being read in reverse ink, the page following along | "Tap play and it reads to you, marking each passage as the voice reaches it." |
| 17–24 s | Contents: save Chapter 2; the rule fills; "Chapter 2 is saved for listening offline." | "Save a chapter and it plays on the train, offline." |
| 24–27 s | Settings: the dark theme | "Light, dark and sepia, set like an engraved book." |
| 27–32 s | The shelf at night with the mini player, then back to reading | "Leave the book and it keeps your place; come back and carry on." |

## Making it again

`mise run demo` records it again from `tests/e2e/demo.spec.ts` (its own server and a fake
AllTalk speaking at a brisk pace) and writes the MP4. Watch it before committing.
