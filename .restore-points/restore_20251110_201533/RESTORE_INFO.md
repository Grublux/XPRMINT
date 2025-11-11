# Restore Point: STABLE VERSION

## Created
2025-11-10 20:15:33

## Project State
- Vite + React + TypeScript project
- Experiment Frequency game
- Complete UI with all components working
- Responsive design for mobile
- All heights scaled by 0.9 multiplier

## Key Features
- XPRMINT title header (separate component)
- HeaderBar with Pot, Target Frequency, NGT balance, Timer
- Target Frequency panel (50% width, centered)
- MovesTicker showing recent moves
- Specimen panel with vat, liquid, and submerged orb
- Dial row: Subtract button (cathode) | Center Dial (knob + numbers + Buy button) | Add button (anode)
- Frequency readout buttons with electrodes above
- Lightning bolt animations from electrodes to random vat positions
- Number chips with fixed widths (3 slots, placeholders when empty)
- Waveform window above center dial showing selected number frequency
- All components properly centered and responsive

## Layout Structure
```
XPRMINT (TitleHeader)
[HeaderBar] [SoundToggle]
Target Frequency (50% width, centered)
MovesTicker
[Specimen]
[Subtract] [Center Dial] [Add]
```

## To Restore
Copy files from this directory back to project root:
```bash
cd /Users/stoph/Desktop/learn_to_code/Cursor/Project_Downloads/Backups/closer
cp -r .restore-points/restore_20251110_201533/src/* src/
cp .restore-points/restore_20251110_201533/package.json .
cp .restore-points/restore_20251110_201533/vite.config.ts .
```
