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
|      |        |               |                     |                        |
