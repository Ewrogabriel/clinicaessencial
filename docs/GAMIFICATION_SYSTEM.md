# Gamification System

## Overview

The gamification system rewards patients and professionals for engaging with the clinic platform. Users earn points, unlock achievements, complete challenges, and redeem rewards — driving retention and healthy habits.

---

## Components

| Component | Path | Description |
|-----------|------|-------------|
| `LeaderboardPatient` | `pages/gamification/LeaderboardPatient` | Patient-facing ranking page |
| `RewardsCatalog` | `pages/gamification/RewardsCatalog` | Browse and redeem available rewards |
| `AchievementCard` | `components/gamification/AchievementCard` | Displays a single achievement badge |
| `ProgressBar` | `components/gamification/ProgressBar` | Visual progress toward a goal |
| `ChallengeCard` | `components/gamification/ChallengeCard` | Displays an active or completed challenge |

---

## Modules

| Module | Path | Description |
|--------|------|-------------|
| `gamificationService` | `modules/gamification/services/gamificationService` | Core API calls (Supabase) |
| `useGamification` | `modules/gamification/hooks/useGamification` | General gamification state hook |
| `useLeaderboard` | `modules/gamification/hooks/useLeaderboard` | Leaderboard data fetching |
| `useChallenges` | `modules/gamification/hooks/useChallenges` | Challenge list and completion |
| `useRewards` | `modules/gamification/hooks/useRewards` | Rewards catalog and redemption |

---

## Database Tables

### `gamification_conquistas`
Stores achievement definitions and which users have unlocked them.

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid | Primary key |
| `titulo` | text | Achievement title |
| `descricao` | text | Achievement description |
| `icone` | text | Badge icon identifier |
| `pontos` | integer | Points awarded |
| `criterio` | jsonb | Unlock criteria |
| `criado_em` | timestamptz | Creation timestamp |

### `gamification_desafios`
Challenge definitions with start/end dates and objectives.

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid | Primary key |
| `titulo` | text | Challenge title |
| `descricao` | text | Challenge description |
| `pontos` | integer | Points on completion |
| `data_inicio` | date | Challenge start date |
| `data_fim` | date | Challenge end date |
| `criterio` | jsonb | Completion criteria |
| `ativo` | boolean | Whether the challenge is active |

### `gamification_recompensas`
Reward catalog available for point redemption.

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid | Primary key |
| `titulo` | text | Reward name |
| `descricao` | text | Reward description |
| `custo_pontos` | integer | Points required |
| `estoque` | integer | Available quantity (`null` = unlimited) |
| `ativo` | boolean | Whether reward is available |

### `gamification_resgates`
Records of reward redemptions by users.

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid | Primary key |
| `user_id` | uuid | FK → `auth.users` |
| `recompensa_id` | uuid | FK → `gamification_recompensas` |
| `pontos_utilizados` | integer | Points spent |
| `resgatado_em` | timestamptz | Redemption timestamp |
| `status` | text | `pendente`, `aprovado`, `cancelado` |

### `gamification_pontos`
Point ledger tracking every credit/debit event.

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid | Primary key |
| `user_id` | uuid | FK → `auth.users` |
| `pontos` | integer | Points delta (positive = credit, negative = debit) |
| `motivo` | text | Reason for the transaction |
| `referencia_id` | uuid | Optional reference to source record |
| `criado_em` | timestamptz | Transaction timestamp |

### `gamification_leaderboard` (view)
Aggregated view summing points per user for ranking display.

| Column | Type | Description |
|--------|------|-------------|
| `user_id` | uuid | User identifier |
| `nome` | text | User display name |
| `avatar_url` | text | Profile image URL |
| `total_pontos` | integer | Sum of all points |
| `posicao` | integer | Rank position |

---

## Features

### Leaderboard Rankings
The `/gamificacao/ranking` route renders `LeaderboardPatient`, which uses the `useLeaderboard` hook to fetch the `gamification_leaderboard` view. Rankings refresh in real-time via Supabase subscriptions.

### Achievement Badges
Achievements are defined in `gamification_conquistas`. When a user meets the `criterio`, a row is inserted in the user's achievement record and displayed via `AchievementCard`.

### Challenge System
Time-boxed challenges are managed through `gamification_desafios`. The `useChallenges` hook returns active challenges and handles completion. Progress is tracked with `ProgressBar`.

### Reward Redemption
The `/gamificacao/recompensas` route renders `RewardsCatalog`. Users browse available rewards and redeem them via `useRewards`, which calls `gamificationService.redeemReward()` and creates a `gamification_resgates` record.

---

## Hook Usage

```tsx
// Leaderboard
const { rankings, isLoading } = useLeaderboard();

// User challenges
const { challenges, completeChallenge } = useChallenges();

// Rewards catalog
const { rewards, redeem, isRedeeming } = useRewards();

// General gamification state (points balance, achievements)
const { points, achievements, refresh } = useGamification();
```

---

## Security

All gamification tables enforce **Row Level Security (RLS)**:

- **Read:** Users can read their own records (`user_id = auth.uid()`). The leaderboard view exposes only aggregated, non-sensitive data.
- **Insert/Update:** Restricted to server-side operations (service role) or specific clinic-role users to prevent point manipulation.
- **Admin access:** Users with `admin`, `gestor`, or `master` roles can manage challenge and reward definitions via `GamificationAdminPanel` (`/gamificacao-admin`).
