# Pages Structure

## Current Active Pages

### Dashboard (`/dashboard`)
- **Status**: Active
- **Component**: `src/pages/StabilizationPage.tsx`
- **Purpose**: Main stabilization dashboard for viewing Goobs, items, and managing creature stabilization
- **Features**:
  - Goob inventory display
  - Item inventory with filtering
  - Stabilization Points (SP) tracking
  - Whitelist gating for write actions

### Landing Page (`/`)
- **Status**: Active (HomePage)
- **Component**: `src/pages/HomePage.tsx`
- **Purpose**: Entry point for the application
- **Note**: May be updated/redesigned as the main landing page

### Lab Page (`/lab`)
- **Status**: To be created
- **Purpose**: New lab interface for stabilization experiments
- **Note**: This will be the primary interaction page for the stabilization system

## Legacy Pages

### Experiment Page (`/experiment`)
- **Status**: Legacy - Not currently linked
- **Component**: `src/pages/ExperimentPage.tsx`
- **Purpose**: Kept for a different version later on
- **Note**: This page will not have navigation links to it in the current version
- **Route**: Still exists in router but should not be accessible via navigation

## Navigation Notes

- The experiment page route exists but should not be linked from navigation menus
- Focus development on Dashboard and Lab pages
- Landing page may be updated to serve as the main entry point

