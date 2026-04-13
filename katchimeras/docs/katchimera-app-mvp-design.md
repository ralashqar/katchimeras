# Katchimera App MVP Design

This is the reference design for the core app after onboarding. It describes the intended MVP product behavior so future engineering, Supabase, and state-model work can stay aligned.

Related references:

- `docs/home-screen-ux-and-katchimera-design-system.md`
- `docs/mvp-implementation-plan.md`
- `docs/add-moment-rotary-capture-flow.md`

## 1. Product Summary

### Concept

A mobile app where each day is transformed into a unique creature ("Katchimera") based on:

- user activity (steps, movement)
- location patterns
- optional user-added moments (tags, photos, text)

### Core Loop

Day happens -> signals collected -> user optionally adds moments -> egg forms -> end-of-day hatch -> creature generated -> reflection + insight -> repeat

### Core Value

- Emotional: "see what your day became"
- Behavioral: gentle guidance via balance insights
- Retention: daily curiosity loop

## 2. MVP Feature Scope

### Included

- Onboarding cinematic
- Today screen (egg -> creature)
- Moment input system
- Passive data ingestion (basic)
- Hatch animation (simplified)
- Timeline (top scroll)
- Creature generation system (rule-based)
- Insight + Paths system (based on 5-7 day profile)

### Excluded Post-MVP

- Map view
- Social features
- Deep analytics UI
- Complex AI inference pipelines
- Multiplayer / sharing
- Full comic system

## 3. Core Screens

### 3.1 Onboarding

Purpose:

Explain system: moments -> creature

Flow:

- Text intro
- Moments appear (animated)
- Moments converge -> egg
- Egg hatches -> example creature
- Highlight shown
- Timeline preview
- CTA: "Begin"

Output:

User proceeds to setup (permissions)

### 3.2 Permission Setup

Screen title:

"Let your days take shape"

Options:

- Primary: enable Activity + Location
- Secondary: "I'll add moments manually"

Data used in MVP:

- Steps, if available
- Foreground location, basic classification

### 3.3 Home Screen

Layout:

- Timeline (scrollable)
- Hero: Egg or Creature
- Context area: moments or highlight
- Insight + Paths module

#### 3.3.1 Timeline

Behavior:

- Horizontal scroll
- Snap to center
- Center item = active day

Items:

- Past days -> mini creatures
- Today -> egg or creature
- Tomorrow -> ghost egg

Interaction:

Scroll updates the entire screen state.

#### 3.3.2 Hero Area

States:

- Today: large animated egg, reactive to inputs
- Past day: creature displayed, fully formed
- Tomorrow: dim egg, no input

#### 3.3.3 Moments

Today only.

UI:

- "Add moment" button
- Horizontal chip list after first input

Input methods:

- Quick tag, primary
- Photo via egg-centered recent-photo ring
- Text or note, optional
- Voice, optional

Behavior on add:

- chip appears
- chip animates toward the egg
- egg reacts with a visual pulse

Interaction principle:

- tapping the egg should open a radial moment carousel around the egg
- richer capture types should stay inside that egg-centered interaction whenever possible

#### 3.3.4 Past Day View

When the timeline is not on today, show:

- Creature centered
- Highlight text
- List of moments, simple
- Optional "Add memory" journal action

#### 3.3.5 Insight + Paths Module

Data source:

Rolling 5-7 day profile

Collapsed state:

"Your days have been calm this week..."

Expanded state:

- Insight text
- Path 1
- Path 2

Path behavior:

Tap applies a bias to the current day and the egg reacts visually.

## 4. Data Model

### 4.1 Moment

```json
{
  "id": "string",
  "type": "coffee",
  "timestamp": "ISO-8601",
  "source": "manual",
  "metadata": {}
}
```

### 4.2 Day

```json
{
  "date": "YYYY-MM-DD",
  "moments": [],
  "activity": {
    "steps": 0
  },
  "location_summary": {
    "places_count": 0,
    "new_places_count": 0
  },
  "sleep": {
    "duration": 0,
    "quality": 0
  },
  "scores": {
    "energy": 0,
    "calm": 0,
    "social": 0,
    "exploration": 0,
    "focus": 0
  },
  "creature": null
}
```

### 4.3 Creature

```json
{
  "id": "string",
  "primary_trait": "string",
  "secondary_trait": "string",
  "rarity": "string",
  "visual_seed": "string",
  "name": "string",
  "highlight_moment_id": "string"
}
```

### 4.4 Week Profile

```json
{
  "energy_avg": 0,
  "calm_avg": 0,
  "social_avg": 0,
  "exploration_avg": 0,
  "focus_avg": 0
}
```

## 5. Signal To Score Mapping

Clamp all values to `0-1`.

### Energy

- +steps
- +movement moments

### Calm

- +low activity
- +calm tags

### Social

- +social tags

### Exploration

- +new places
- +location changes

### Focus

- +long stationary periods
- +focus tags

## 6. Creature Generation

### Step 1

Get day scores.

### Step 2

Find:

- dominant dimension
- secondary dimension

### Step 3

Assign:

- archetype based on dominant
- modifiers from secondary

### Step 4

Calculate rarity:

`rarity = sum(scores) + diversity_bonus`

### Step 5

Generate:

- name
- visual seed
- highlight moment

## 7. Hatch Flow

Trigger:

End of day or first open after threshold

Steps:

- Show egg
- Display moments
- Animate convergence
- Hatch -> creature
- Show highlight
- Skip support
- Tap -> instantly reveal creature

## 8. Insights System

Input:

- week profile

Output types:

- trend
- imbalance
- absence

Example:

"There hasn't been much movement recently..."

## 9. Paths System

Generation:

- detect imbalance
- create a contrast path
- create a reinforcement path

Example:

- Energy low -> suggest energy
- Calm high -> suggest either energy as contrast or deeper calm as reinforcement

Effect:

Apply bias, for example:

`energy += 0.2`

## 10. Daily Flow

### Morning

- Egg visible
- No moments yet

### Day

- Moments added
- Passive data collected

### Evening

- Egg intensifies

### Night

- Hatch
- Creature generated

## 11. Design Constraints

### Must

- Always show something, no empty states
- Keep interactions to 2 taps or less
- Keep text minimal
- Keep tone non-judgmental

### Must Not

- No stats UI
- No gamified grind
- No forced journaling
- No heavy permissions upfront

## 12. MVP Success Criteria

The user should:

- Understand the concept in under 30 seconds
- Add at least 1 moment on day 1
- Return to see hatch
- Feel the creature reflects their day

## Final Note For Engineering

This system is deterministic and rules-based, but it should feel non-deterministic and magical.

Priority is:

- smooth UI
- correct state transitions
- consistent mapping

Not:

- perfect AI
- complex inference

## Implementation Note

Future backend, Supabase schema, and state-flow work should treat this document as the target product shape, not the current shipped implementation. The current app still uses local demo state for the main user loop.
