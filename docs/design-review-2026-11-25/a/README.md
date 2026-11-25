# Concept A · The Listening Room

[Open The Listening Room](index.html)

The Listening Room starts with material the user has chosen to keep. Studio opens at a saved phrase and gives an independent speaking prompt a clear starting place. Library is a searchable personal collection. History brings a concrete phrase, take or prompt back into view. The player is the centre of the experience. The active sentence, transport and the next useful practice action stay together.

## What to try

| Journey | Path |
| --- | --- |
| Play a saved reference | **Resume reference** opens Nina Patel’s **Move a deadline**, paused at **0:42**. Press **Play**, **Replay** or **Next phrase**. |
| Try a fresh situation | From Studio, **Start with a speaking prompt** opens the changed deadline scenario. From the selected player phrase, **Try a new conversation** opens the changed meeting scenario. Return to the exact phrase and initiating control. |
| Listen, record and compare | From the 0:42 phrase, choose **Record and compare**. Optionally **Play reference**, then **Start sample take** → **Stop and compare**. Listen to either track explicitly, retry or keep the sample in the current visit. |
| Find or collect material | In **Library**, search for **deadline**, favourite the result and confirm it under **Favourites**. Open **Collections** → **Work conversations** → Ellis Morgan’s reference. Press **Play** to hear the second local sample at **0:54**. |
| Move away without losing the phrase | While the reference plays, choose **Browse library**. The compact current-reference control carries the same audio. Pause, reopen the full player or go to History. |
| Finish and return | Use **Finish practice** after playback. Open **View history** and the newest action record. An older history row opens its own paused position and leaves Studio’s newer saved point intact until you deliberately play the earlier point. |
| Exercise choice | **Choose an activity** opens short, optional rehearsal texts for emphasis, pausing, vocabulary and an unfamiliar conversation. |
| Start with an empty library or a missing source | Add [?empty](index.html?empty) or [?unavailable](index.html?unavailable) to the prototype URL. In either case, a speaking prompt remains usable. The unavailable variant supports reading through the transcript without claiming playback or a practised mark. |

Use a local static server from the review directory when the preview does not open HTML directly.

```sh
python3 -m http.server --bind 127.0.0.1 8080
```

Open `http://127.0.0.1:8080/a/`.

## Design decisions

- **Primary hierarchy.** A single photo and light shelf set up the Studio. Deep green marks the listening surface. A serif voice distinguishes the current phrase from the utilitarian labels and transport. The active sentence takes precedence over its neighbours. The two starting paths remain easy to reach on a phone.
- **Screen structure.** A persistent three-destination rail and an adjacent passage column use desktop width. Touch tablets keep a separate passage column. Phone player moves passages behind a disclosure without removing transport or the practice actions. Intentional listening, recording and comparison each have distinct primary actions.
- **Library.** Search, collections and favourites sit at the same level. A row opens the named reference and offers a directly visible, reversible favourite. The prepared entry is distinct from adding material. A compact player appears after opening a specific reference.
- **State and feedback.** History records observable actions and exact positions. Source unavailability keeps the passage readable and shows what can still be done. The capture mock gives explicit start, stop and cancel. Comparison uses both bundled samples on the same 2.56-second scale.
- **System.** The prototype uses a shared 44-pixel minimum control height, consistent outline icons, tonal surfaces and short hover feedback under the user’s motion preference. Labeled controls, visible keyboard focus and semantic headings are part of the sample interface.

The rendered baseline kept original speaking one action and prepared Resume → Play two. That efficiency stays. The corresponding paused transfer is already one action. The proposal places it beside the relevant phrase. Search → favourite falls from six actions in the measured baseline to three from Studio. Finish moves from three player actions to one. Paired listening is ready in three actions from the player, with one more action for optional reference playback. These are interaction counts from fixtures, not participant or time-to-speech measurements.

## Boundaries for the design decision

Audio is synthetic and local. Fixture data, demonstration history and kept samples are in memory during the visit. The comparison sample is paired to the 0:42 Nina Patel phrase. Add reference and additional learning activities demonstrate their entry and disclosure. The production routes, microphone, provider activation, import, account state and data synchronization were outside the prototype. Preserving hosted activation, the full-size provider slot, persistent native playback, exact queue semantics, optional local takes and private owner recovery remains part of a production design if selected. The value to test against the competing concept is whether users want to return for a familiar reference often enough for that reference to lead Studio.

The four target viewports were opened locally in Chromium. The matched run exercised 390 × 844, 430 × 932, 768 × 1024 and 1440 × 900. Native audio progression, second source identity, transfer return focus, distinct collection browsing, history position preservation and unavailable-source evidence were checked with synthetic fixtures. In a separate 844 × 390 touch landscape check, Play was visible from y276 to y326 and accepted a hit test at its centre without scrolling. Physical microphone behavior and participant outcomes require separate validation.

## Production placement if selected

Keep a quiet, named **Player options** gear in the player header. Playback holds mode, speed and full-recording seek. Practice holds range, speaker and status filters. Lesson holds existing source, timing, editing and management. Keep current-phrase seek, Queue and Compare discoverable beside the phrase and transport. Use the contained following transcript for active text, with tappable words for British IPA and optional full-phrase IPA. Offer Practised, Difficult and edits by explicit phrase action and in Queue. Phone opens these tools in sheets that return focus to their opener. Tablet and desktop use the right rail for grouped context, with a docked queue only when it leaves the stage usable.

Deliberate YouTube activation reveals the full-player 200 × 200 slot with unobstructed controls. Place it between the phone header and contained transcript, and in the adjacent stage lane on tablet and desktop. Keep the transport reachable in short layouts and keep the same media host when expanding or browsing. Native audio uses the compact bar. A playing YouTube source keeps its visible provider surface under the confirmed compact rule. Where that layout cannot be accommodated, pause at the current position and explain. The Audio, Player and Store APIs keep ownership of media timing, persisted positions and lesson data.

At 200% CSS zoom, Studio, the player, recording and comparison reflowed without horizontal overflow at 320 and 390 pixels. On both widths the Play target accepted touch after vertical scrolling. Keyboard checks covered entering and leaving the transfer prompt with focus restoration, starting and stopping the take, and reaching comparison playback. Production still needs its own reflow check with the visible provider surface.

[Rendered current-app baseline](../baseline/README.md) · [Owner’s mobile design reference](https://github.com/zirock699/echo/blob/1497245/docs/reference-mobile.png) · [Owner’s desktop design reference](https://github.com/zirock699/echo/blob/1497245/docs/reference-desktop.png)
