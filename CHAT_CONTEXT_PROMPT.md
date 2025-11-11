# Chat Context Prompt for Closer Project

Copy this entire prompt into a new chat session to get up to speed:

---

## PROJECT OVERVIEW
This is a frequency-tuning game called "XPRMINT" (formerly "Feed The Frequency"). Players adjust a specimen's resonance frequency to match a target frequency using number chips.

## CURRENT STATE

### Game Mechanics
- **Target Frequency**: Random value between 0-10,000 Hz (displayed in center of "Spectrum Analysis" scale)
- **Resonance Hz**: Current specimen frequency (0-10,000 Hz), starts at random or can be set for testing
- **Numbers**: Player has 1-3 number chips (1-500 each) to add/subtract from resonance
- **Goal**: Match `resonanceHz` to `targetHz` exactly

### Key Components

1. **CreatureCanvas** (`src/components/CreatureCanvas/CreatureCanvas.tsx`)
   - Displays specimen orb inside a tank (background: `specimen_bg2.png`)
   - Orb size scales linearly with `resonanceHz`: 0 Hz = 10% of max, 10,000 Hz = 100% of max
   - Orb positioned at 65% down the canvas (in the "liquid" area)
   - White/gray orb with pulsing white rings
   - Background image shows a specimen tank/jug

2. **MovesTicker** (`src/components/MovesTicker/MovesTicker.tsx`)
   - Renamed to "Spectrum Analysis" (vertical scale)
   - Shows target frequency at center (50% vertical position)
   - Shows "Current" marker at `resonanceHz` position
   - Shows "me" marker for player's closest attempt
   - Scale zooms adaptively based on distance from target
   - Higher frequencies appear ABOVE target, lower frequencies BELOW
   - Grid marks with increments: 500, 200, 100, 25, 10, or 1 Hz (based on distance)

3. **FrequencyReadout** (`src/components/FrequencyReadout/FrequencyReadout.tsx`)
   - Two buttons: "Add +xxx Hz" and "Subtract -xxx Hz"
   - Shows electrode (anode/cathode) graphics
   - Triggers lightning bolts to specimen when clicked
   - Lightning targets random positions on specimen canvas

4. **CenterDial** (`src/components/CenterDial/CenterDial.tsx`)
   - Contains `NumberChips` (player's number inventory)
   - Contains small "Buy" button beneath numbers
   - Height: 300px

5. **Layout** (`src/pages/ExperimentPage.tsx`)
   - Top row: HeaderBar (pot info) + SoundToggle
   - Specimen row: Placeholder (invisible, matches MovesTicker width) + CreatureCanvas (centered, 55% width) + MovesTicker (vertical scale)
   - Dial row: FrequencyReadout (down) + CenterDial + FrequencyReadout (up)

### State Management (`src/state/gameStore.ts`)
- Uses Zustand store
- Key values:
  - `targetHz`: Random 0-10,000 Hz
  - `resonanceHz`: Currently set to **10000** for testing (line 62, 99, 160)
  - `numbers`: Array of 1-3 numbers (1-500 each)
  - `pot`: Prize pool
  - `status`: 'idle'|'active'|'win'|'timeout'

## CURRENT TASK
**Testing orb size at maximum resonance (10,000 Hz)**

The `resonanceHz` is currently hardcoded to `10000` in `gameStore.ts` at:
- Line 62: Initial state
- Line 99: `joinWithInitialPack` action
- Line 160: `resetRound` action

This was set to test the orb at maximum size to ensure it fits exactly in the tank.

## RECENT FIXES & DECISIONS

1. **Orb Scaling**: Orb scales from 0-10,000 Hz, with max size calculated to fit tank dimensions
2. **Spectrum Analysis**: Vertical scale with adaptive zoom, target at center, current and player markers
3. **Layout Stability**: Fixed widths/heights to prevent layout shifts
4. **Background Image**: Using `specimen_bg2.png` for specimen tank
5. **No Color**: Specimen is white/gray orb only (no colored vat/liquid rendering)
6. **Lightning**: SVG bolts from electrodes to random positions on specimen
7. **Title**: "XPRMINT" centered at top (no navigation links)

## FILE STRUCTURE
```
src/
  state/
    gameStore.ts          # Zustand store (resonanceHz = 10000 for testing)
  components/
    CreatureCanvas/       # Specimen orb + tank background
    MovesTicker/          # Spectrum Analysis vertical scale
    FrequencyReadout/     # Add/Subtract buttons + electrodes + lightning
    CenterDial/           # Number chips + Buy button
    HeaderBar/            # Pot info
    TitleHeader/          # "XPRMINT" title
  pages/
    ExperimentPage.tsx    # Main game layout
```

## IMPORTANT NOTES
- **TEST MODE**: `TEST_INFINITE_NGT = true` in gameStore (players never run out of NGT)
- **Orb Position**: `cy = h * 0.65` (65% down canvas)
- **Orb Size**: Scales linearly 0-10,000 Hz, max radius = min(tankWidth, tankHeight) / 2
- **Scale Mapping**: Higher Hz = higher on scale (above target), lower Hz = lower (below target)
- **Canvas Selector**: `[data-specimen-canvas="true"]` for lightning targeting

## NEXT STEPS
User wants to test different `resonanceHz` values to see orb scaling. Currently set to 10000 for max size testing.

---

**END OF CONTEXT PROMPT**

