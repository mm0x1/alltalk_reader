# Device checklist

What the automated tests can't cover: real audio hardware, the lock screen, installing the app,
system settings. Run it on a real iPhone (Safari) and a real Android phone (Chrome) before a
release or a demo, against the real AllTalk. Note the date, devices and anything that fails in
the table at the end.

## Before you start

- Readhouse built from the commit under test and running (`mise run build && mise run start`),
  with AllTalk running and Settings showing **Connected**.
- Served over HTTPS (`tailscale serve`, see the README), since offline chapters, the installed
  app and some lock-screen features need it. Do the **Plain http** section separately.
- A real EPUB with several chapters (a Project Gutenberg download is fine) and an AO3 download.
- Headphones (wired or Bluetooth).

## First run

1. Open the address in Safari / Chrome. The library shows; the type is comfortable to read.
2. **Add a book** with the EPUB. It opens at Chapter 1 with the dithered band and the drop cap.
3. Tap **Play**. The first passage starts within a few seconds (AllTalk is generating it) and
   the sentence being read is in reverse ink. *iPhone: the very first tap must start sound; if
   nothing plays, that is a bug.*
4. Let it read through at least three passages. There is no gap longer than a moment between
   passages (the next ones are prepared ahead).
5. Tap a paragraph further down. Reading jumps there.

## New since 2026-10-31

1. **Big books from the phone.** Add a large EPUB (Dune is 1.7 MB) from the phone's files. It
   gets in (books over 512 KB used to be refused) and opens at the story, not the praise or
   copyright pages (Dune: *Book One: Dune*). Front matter is still in Contents.
2. **Fanfic dialogue.** In the AO3 download, play a stretch of short dialogue lines. Several
   lines are highlighted and read together as one passage; AO3's "See the end of the chapter
   for more notes" isn't read; a web address is read as "a link".
3. **Passage length** (Settings > Voice). Try short (about 60) and long (about 500): short
   starts sooner and pauses more between passages, long sounds smoother. Save, go back to the
   book, play: the change applies.
4. **Preparing audio** (Settings > On this device). With *Prepare ahead* 1 and *Before playing*
   0, then *Prepare ahead* 5 and *Before playing* 2: the second waits longer at the start but
   doesn't stop between passages.
5. **Hear this voice** (Settings > Voice, pick a voice). The sample plays from the phone's
   speaker on the first tap. *iPhone: if nothing plays, that is a bug.* The book pauses.
6. **Model** (Settings > AllTalk). Switch to *apitts* and back: the flower shows while AllTalk
   loads it (about 15 s on the laptop), then a notice; reading works with each.
7. **Text size** (Settings > On this device): Tiny to Extra large resizes everything, the book
   text and drop cap included; nothing runs off the screen at Extra large.
8. **Make the audiobook** (Contents, top; called *Prepare the whole book* before 2026-11-02). Progress shows while the computer works; you can
   close the phone meanwhile. When done it says what it was prepared with. Then switch AllTalk
   off (or change its model or the voice in Settings): the book still plays, in the voice it was
   prepared with. *Forget* returns it to the current settings.
9. **Covers.** A book without a cover shows an engraved one on the shelf: the title on paper,
    dithered ink at the foot, readable in all three themes.
10. **Player and frame.** No numeral over the chapter; the band fades downward. The player says
    "Ch. 2 of 20"; the play button clears the frame; the speed opens a sheet from 0.5x to 2x.
    On a long page the frame runs the full length.
11. **Removing a book** asks in a sheet from below; *Keep it* is the safe answer. **Saving a
   chapter** for offline shows a rule filling under its row, then a dark notice when done.

## New since 2026-11-02

1. **Keyboard on a computer** (Safari and Chrome, or a tablet with a keyboard). In a book,
   Space plays and pauses, the left and right arrows move by passage. Click *Next passage*
   with the mouse, then press Space: it plays (it doesn't skip again). With the speed or sleep
   sheet open, the keys do nothing to playback.
2. **Make the audiobook** (Contents, top; was *Prepare the whole book*). The button fits on one
   line in the computer's sidebar; while it works it says *Making the audiobook*, then
   *Audiobook made with...* with *Make it again* and *Forget*. Settings says *AllTalk's
   default*, *Voice conversion (RVC)* and *Stop preparing audio*.
3. **Long chapters over mobile data.** With Wi-Fi off, open Readhouse over Tailscale and go to
   a long chapter (Dune's *Book One* sections, or any chapter of 10,000+ words). It opens
   within a second or two and scrolls smoothly; pages and data are now sent compressed.
4. **Screen readers find the book text.** With VoiceOver (iPhone, and on the Mac with
   Cmd+F5 in Safari) or TalkBack, open a book and use the landmarks rotor / "main" navigation:
   it lands on the chapter text (the reader had no main region before). Then step through the
   player: every button says its name, and Play / Pause is announced.
5. **Reduce Motion while listening.** Turn on Reduce Motion, play a book and let it read on:
   the page jumps to each new passage instead of gliding.
6. **Long chapter names in Contents.** Open Dune's Contents on the phone and on the computer:
   a name that wraps (*Praise for The Dune Chronicles*) has its word count and dots on its last
   line. On the computer, the chapter being read sits in the middle of the sidebar, whole.
7. **Drop caps that fit.** In the AO3 download, the chapter that starts "1. At a meeting" has no
   drop cap on the "1."; the first real paragraph after it has it. Books that open normally
   (Pride and Prejudice, Dune's chapters) look as before.
8. **Shelf on the computer.** A long title that wraps over two lines still has its dotted leader
   running straight on from the author.

## Lock screen and background

1. While playing, lock the phone. Playback continues across passages for at least two minutes.
2. The lock screen shows the book and chapter, with play/pause, next and previous. Each works.
3. Pause from the lock screen, wait a minute, resume. It continues from the same passage.
4. Unlock: the page shows the passage now being read.
5. Set the **Sleep timer** to *End of chapter*, lock the phone, and let it reach the chapter's
   end (pick a short chapter). It stops there, and resumes from the next chapter on Play.

## Audio routes and interruptions

1. With headphones in, play, then unplug them (or turn Bluetooth off). Playback pauses; it does
   not continue out of the speaker.
2. During playback, receive a call or start a voice memo / another app's audio. Readhouse pauses
   and Play resumes it afterwards.
3. Change the speed (1x, 1.25x, ...). The voice speeds up without a pitch change.

## Offline

1. Open **Contents** and save the current chapter for offline listening. It shows as saved.
2. Turn on airplane mode. Reload the page: the book still opens.
3. Play the saved chapter. It plays all the way through without errors.
4. Move to a chapter that isn't saved. The player explains that it needs a connection, rather
   than failing silently.
5. Turn airplane mode off. Playing an unsaved chapter works again without reloading.
6. **Settings > Offline listening** shows the space used; removing the copies frees it.

## Installed app

1. **Add to Home Screen** (iPhone: Share > Add to Home Screen; Android: install prompt or menu).
   The icon and name are right, and it opens without browser bars.
2. Repeat **Lock screen and background** steps 1 and 2 in the installed app.
3. *Android:* share an EPUB or .txt file from Files (or a downloads app) to Readhouse. The
   library offers it in **Add a book**; nothing is added until you tap.
4. *Android:* share a web link to Readhouse. It explains that it can't open web links.

## Accessibility

1. Set the phone's text size to the largest (iPhone: Settings > Display & Brightness > Text
   Size, and Accessibility > Larger Text; Android: Settings > Display > Font size). Library,
   reader, player and Settings all grow; nothing overlaps or runs off the screen.
2. Turn on VoiceOver / TalkBack. Every button is announced by name (Play, Pause, Contents,
   Settings, Remove ...), and the player announces what is happening.
3. Turn on Reduce Motion. Nothing slides or animates.
4. Switch Light, Sepia and Dark in Settings. Each is readable everywhere, including the band.

## AO3

1. Add the AO3 download (EPUB, and an HTML page saved from AO3 or pasted). Title, author and
   chapters come through; the AO3 notes and summary don't get read as the story.

## Passcode

1. With `ACCESS_PASSCODE` set, open Readhouse on a phone that hasn't unlocked it. It asks for the
   passcode; a wrong one is refused; the right one opens the library and stays unlocked after
   closing the browser.

## Plain http (home network)

1. Open `http://<computer-ip>:3000`. Reading and listening work. Settings explains that offline
   chapters need HTTPS instead of showing broken controls.

## Results

| Date | Commit | Device and OS | Browser / installed | Failed steps and notes |
| ---- | ------ | ------------- | ------------------- | ---------------------- |
| 2026-11-02 | 4bce17e | Phone (not recorded), laptop AllTalk on APITTS, plain http | Browser | New since 2026-10-31, item 8 (Prepare the whole book): all passed by hand, including playback with AllTalk off, settings kept after changes, the model-switch pause and every control. |
| 2026-11-02 | 4bce17e | Phone (not recorded), laptop AllTalk on APITTS, plain http | Browser | New since 2026-10-31, items 1–7 and 9–11 (big EPUB upload, fanfic dialogue, passage length, buffer, voice preview, model switch, text size, covers, player and frame, remove-book sheet and saved notice): all verified by hand, no failures. |
| 2026-11-02 | 640540a | Real phones (user), laptop AllTalk on APITTS, plain http and Tailscale https | Browser and installed | Every section validated by the user: First run, Lock screen and background, Audio routes, Offline, Installed app, Accessibility, AO3, Passcode, Plain http. No failures reported. |
