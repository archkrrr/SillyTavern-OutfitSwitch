# Outfit Switcher for SillyTavern

Outfit Switcher is the streamlined sibling to Costume Switcher—a focused companion that manages a single character’s wardrobe while borrowing the same automation backbone. Point the extension at one folder, add optional variants, and it will stream-watch every response to launch the correct costume the moment a keyword or regex fires. Manual overrides remain one click away, so you can keep dramatic reveals perfectly timed without juggling multiple profiles.

**Costume Switcher for SillyTavern**

Costume Switcher is the companion piece to Lenny’s **Character Expressions** extension—it uses the same foundations, but instead of changing facial expressions it swaps the entire costume or avatar folder the moment a new speaker takes the spotlight. Install both and SillyTavern keeps the correct character in focus *and* their emotions in sync, giving you a live stage crew that reacts faster than you can type.

Outfit Switcher is the big sibling in this duo, designed for hyper-focused wardrobe curation. Costume Switcher is its little brother, watching the whole cast and dressing whoever grabs the spotlight while Outfit Switcher keeps a single star perfectly styled. Together they extend Character Expressions into a full backstage crew: Expressions handles nuanced emotions, Costume Switcher handles wardrobe changes, and Outfit Switcher locks in the hero shot whenever you need it.

Under the hood both extensions listen to streaming output from your model, score every mention they care about, and immediately update the displayed costume to match the active speaker. Costume Switcher ships with powerful tooling, scene awareness, and a fully redesigned configuration UI so you can understand *why* a switch happened and tune the behaviour to fit any story, while Outfit Switcher keeps those smarts but channels them into a single-character pipeline.

> **New to the Switcher family?** Start with Costume Switcher to learn the fundamentals, then hop over to the Character Expressions README. Wrap up by configuring Outfit Switcher and you will have a best-friends trio handling expressions, wardrobe changes, and solo focus in perfect sync.

---

## Shared Wardrobe Workflow Tips

Many of the wardrobe strategies from Costume Switcher translate directly to Outfit Switcher. Keep your SillyTavern character folders organised so every variant is easy to reference and debug later.

### Prepare your character folders

Organise each performer inside a readable directory tree. Subfolders can hold portrait variants, background art, or expression packs without leaking into other looks.

```
SillyTavern/data/default-user/characters/Frostglen Dorm/
├── Ember Hart/
├── Quinn Vale/
└── Mira Snow/
```

If Ember occasionally switches into a winter outfit, add another directory—`Frostglen Dorm/Ember Hart/Winter Gala/`—and point an Outfit Switcher variant at that path. The base mapping still targets `Frostglen Dorm/Ember Hart`, while the variant appends the extra folder when its trigger (for example, "snowstorm" or a `/winter/i` regex) fires.

### Organising multi-character cards

When a single SillyTavern card contains several characters (bandmates, roommates, or rival teams), mirror that structure in your folders. Create a directory per character and add optional subfolders for alternate personas or shared scenes. Outfit Switcher can focus on the main performer, while Costume Switcher covers the ensemble if you need broader automation.

```
SillyTavern/data/default-user/characters/Neon Skyline/
├── Lead Echo/
├── Bass Nova/
└── Drummer Pulse/
```

Use `Neon Skyline/Lead Echo`, `Neon Skyline/Bass Nova`, and `Neon Skyline/Drummer Pulse` as your base folders. When the group performs an acoustic set, prepare alternate directories such as `Neon Skyline/Lead Echo/Unplugged/` and assign Outfit Switcher variants to call them on demand.

---

## Contents

1. [Highlights at a Glance](#highlights-at-a-glance)
2. [Requirements](#requirements)
3. [Installation](#installation)
4. [Architecture Overview](#architecture-overview)
5. [Trigger & Variant Model](#trigger--variant-model)
6. [Getting Started in Five Minutes](#getting-started-in-five-minutes)
7. [Tour of the Settings UI](#tour-of-the-settings-ui)
    1. [Character Card](#character-card)
    2. [Variant Gallery](#variant-gallery)
    3. [Trigger Table](#trigger-table)
    4. [Status & Tips](#status--tips)
8. [Understanding Automatic Switches](#understanding-automatic-switches)
9. [Slash Command Reference](#slash-command-reference)
10. [Troubleshooting Checklist](#troubleshooting-checklist)
11. [Support & Contributions](#support--contributions)

---

## Highlights at a Glance

- **Single-character focus** – Keep one avatar in the spotlight and let Outfit Switcher handle every outfit change for that performer.
- **Stream-aware triggers** – Keywords and regexes are evaluated as tokens arrive, ensuring the correct outfit lands before the message finishes rendering.
- **Variant shortcuts** – Pair friendly names with costume folders so dramatic looks, seasonal outfits, and casual wear are just a click away.
- **Manual safety net** – Fire any variant from the panel or via slash command without waiting for automation.
- **Non-destructive switching** – Every action resolves to `/costume` calls; speaker focus never changes, avoiding accidental role swaps.

---

## Requirements

- **SillyTavern** v1.10.9 or newer (release or staging).
- **Streaming enabled** for your model or connector. Without streaming tokens, automatic switching will not run.
- **Browser storage access** to persist settings under the Outfit Switcher namespace.

---

## Installation

1. Open **Settings → Extensions → Extension Manager** in SillyTavern.
2. Click **Install from URL** and paste the repository address:
   ```
   https://github.com/archkrrr/SillyTavern-OutfitSwitch
   ```
3. Press **Install**. SillyTavern downloads the extension and refreshes the page.
4. Enable **Outfit Switcher** from the Extensions list if it is not activated automatically.

To update, revisit the Extension Manager and choose **Update all** or reinstall from the same URL.

---

## Architecture Overview

Outfit Switcher leans on the same event hooks as Costume Switcher but simplifies every step around a single character profile:

1. **Stream listener** – The extension subscribes to rendered and streaming assistant tokens, cleaning and buffering text without blocking the UI.
2. **Profile loader** – Your configured focus folder, variants, and triggers are compiled into a lightweight runtime bundle.
3. **Trigger evaluation** – As new text arrives, keyword and regex triggers run against the rolling buffer. Matches resolve to a target folder (base or variant).
4. **Switch dispatcher** – Matched triggers invoke `/costume` for the configured folder while respecting cooldowns and duplicate suppression.
5. **Status reporting** – The UI surfaces success and error banners, making it clear when a trigger fired or was ignored.

With one character to manage, you always know which folder will be used while still benefiting from real-time automation.

---

## Trigger & Variant Model

Outfit Switcher stores a single profile object containing:

- **Character folder** – The default costume path used when no trigger is active.
- **Variants** – Named shortcuts that append to the base folder or override it entirely for special looks.
- **Triggers** – Entries with a friendly name, keyword/regex, and target folder. Each trigger can reference the base folder or any variant.

This structure mirrors the Outfit Lab’s per-character view: one hero with optional alternates and a clear trigger list.

---

## Getting Started in Five Minutes

1. Enable the extension in **Settings → Extensions** and open the Outfit Switcher panel.
2. Enter your focus character’s display name and default costume folder (e.g., `characters/Ember Hart`).
3. Add variants for special outfits such as `characters/Ember Hart/Winter Gala` or `.../Battle Gear`.
4. Create trigger rows with friendly names, match text (plain keywords or regex), and the variant to run.
5. Talk with your model—when the trigger phrase appears, Outfit Switcher fires the mapped outfit automatically.

You can always click a variant’s **Run** button or use the slash command to override automation instantly.

---

## Tour of the Settings UI

### Character Card
Set the reference name and default costume folder. The card includes quick actions to test the default outfit and confirm the extension is enabled.

### Variant Gallery
Add, rename, or remove outfit variants. Each entry shows the resolved folder path plus a one-click **Run** button for manual switches.

### Trigger Table
Create trigger rows with three fields: friendly name, match text (keyword or regex), and the variant to activate. Buttons appear inline to test detection or delete the trigger.

### Status & Tips
Inline banners surface validation errors, successful saves, or warnings when a folder path is missing. The footer links to quick-start tips drawn from the Costume Switcher documentation.

---

## Understanding Automatic Switches

- **Keyword vs. regex** – Plain text triggers match case-insensitively, while regex triggers obey JavaScript syntax (wrap in `/pattern/` to enable flags like `i`).
- **Buffer window** – Up to 2,000 of the most recent characters are scanned to balance responsiveness with context.
- **Cooldowns** – Rapid repeat matches are ignored briefly so the same line does not spam costume calls.
- **Reset events** – Clearing chat or regenerating a message resets the buffer, ensuring fresh context for the next response.

If a trigger does not fire, open the browser console for detailed logs that show the processed buffer and which triggers were evaluated.

---

## Slash Command Reference

| Command | Description |
| --- | --- |
| `/outfitswitch <trigger>` | Launches the outfit mapped to `<trigger>`. Unknown triggers or disabled states are safely ignored. |

---

## Troubleshooting Checklist

1. **No switches occur:** Verify streaming output is enabled and the extension toggle is on.
2. **Trigger never fires:** Confirm the match text appears exactly (or adjust the regex), and ensure the variant points to an existing folder.
3. **Wrong outfit runs:** Check the trigger’s target in the table and confirm no duplicate trigger names exist.
4. **Manual runs fail:** Make sure `/costume` works for the chosen folder outside the extension—missing directories prevent switches.

---

## Support & Contributions

Issues and pull requests are welcome. When reporting a problem, include:

- The trigger or variant that misbehaved and the text that was expected to match.
- Your SillyTavern build number and API provider.
- Whether the issue happened during streaming automation or a manual command.

These details make it easier to reproduce the behaviour and suggest accurate fixes.
