# 💸 Expensify

A feature-rich personal and family expense tracking app built with **React Native (Expo)** and powered by **Supabase** as the backend. Expensify helps you log, visualize, and understand your spending habits — with AI-powered insights, voice input, bill scanning, and collaborative family group tracking.

---

## 📱 Screenshots & Features at a Glance

| Home Dashboard | Add Expense | AI Insights |
|:-:|:-:|:-:|
| Spending stats, charts & budget overview | Form with AI category suggestion | Automated daily/weekly/monthly summaries |

| Voice Input | Recurring Expenses | Family Group |
|:-:|:-:|:-:|
| Speak an expense to add it instantly | Manage subscriptions & recurring bills | Track spending across family members |

---

## ✨ Feature Overview

### 🏠 Home Dashboard
- **Time-period stats** — Today / This Week / This Month totals at a glance
- **Spending Pie Chart** — Category breakdown for the selected period
- **Daily Bar Chart** — Historical weekly spending trend
- **Budget Card** — Visual progress bar vs monthly budget, with category-level limits
- **AI Insight Card** — Latest AI-generated spending insight shown inline
- **Recurring nudge** — Alerts when recurring expenses are due today
- **Personal ↔ Family view toggle** — Switch between personal and group spending when in a family group
- **Member Spending Bar** — See how much each group member has spent in group view
- **Pull-to-refresh** — Instant data refresh with React Query cache invalidation

### ➕ Add Expense
- Manual form: amount (₹), merchant name, category, date, notes
- **AI category auto-suggest** — debounced call to Gemini as you type the merchant name
- **Bill scanner** — Take a photo or use gallery; AI extracts merchant, total, date, items, and category from the receipt
- Form validation with inline errors

### 🔄 Recurring Expenses
- Define daily / weekly / monthly / yearly recurring expenses (rent, subscriptions, EMIs)
- Toggle active/paused state per item
- Due-date badge (overdue / due today / due in N days)
- Accessible via a nudge on the Home screen when items are due

### 🎤 Voice Input
- Tap the mic button and speak naturally: _"Spent 480 on Swiggy"_ or _"Uber ride ₹320"_
- Audio is sent to the `parse-voice-expense` Supabase Edge Function (powered by Gemini)
- Expense is auto-saved and user returns to the previous screen
- Animated pulse effect while recording

### 🤖 AI Insights Screen
- Lists all AI-generated insights (daily / weekly / monthly summaries) in reverse chronological order
- Pull-to-refresh for new insights
- Color-coded cards with Ionicons
- Floating **"Ask AI Assistant"** button to open the chatbot

### 💬 AI Chat Assistant (`/ai-bot`)
- Conversational interface: ask anything about your spending history
- Canned suggestion chips to get started quickly
- Powered by the `ai-assistant` Supabase Edge Function (Gemini)
- Typing indicator while waiting for response

### 📊 Expenses List
- Full chronological list of all expenses
- Filterable by period; edit & delete each row

### 👨‍👩‍👧 Family Groups
- Create a new group and share the auto-generated 6-character invite code
- Join an existing group with a code
- View all members; owner can remove members
- Member-level spending breakdown shown on the Home dashboard
- Powered by Supabase RLS policies for cross-member expense visibility

### 👤 Profile & Budget Settings
- View and update profile info
- Set a **total monthly budget** and optional **per-category limits** (₹)
- Budget card on Home visualizes current spend vs limit

### 🌗 Theme System
- Full **dark mode** (currently hardcoded dark; light theme defined and ready)
- All components consume a `useTheme()` hook — zero hardcoded colors

---

## 🛠 Tech Stack

| Layer | Technology |
|---|---|
| **Framework** | React Native + Expo (SDK 54) |
| **Navigation** | Expo Router v6 (file-based routing) |
| **Backend / DB** | Supabase (PostgreSQL + RLS) |
| **Auth** | Supabase Auth (email/password) |
| **State Management** | Zustand (auth + dashboard view mode) |
| **Server State / Caching** | TanStack React Query v5 |
| **AI / ML** | Google Gemini API (via Supabase Edge Functions) |
| **Icons** | `@expo/vector-icons` — Ionicons |
| **Charts** | `react-native-chart-kit` + `victory-native` |
| **Audio Recording** | `expo-audio` |
| **Camera / Image** | `expo-image-picker` + `expo-image-manipulator` |
| **Haptics** | `expo-haptics` |
| **Notifications** | `expo-notifications` |
| **Toasts** | `react-native-toast-message` |
| **Storage** | `expo-secure-store`, `@react-native-async-storage/async-storage` |
| **Offline Detection** | `@react-native-community/netinfo` + `OfflineBanner` component |

---

## ☁️ Supabase Edge Functions

All AI and heavy-lifting logic runs as Deno-based Supabase Edge Functions:

| Function | Purpose |
|---|---|
| `categorize-expense` | Given a merchant name, returns the best-matching spending category |
| `parse-voice-expense` | Receives an audio file, transcribes it and extracts amount / merchant / category |
| `scan-bill` | Receives a base64 image of a receipt, uses Gemini Vision to extract structured data |
| `generate-insights` | Periodically generates daily / weekly / monthly AI summaries and stores them in the `insights` table |
| `ai-assistant` | Handles conversational Q&A about the user's expense history |
| `send-notifications` | Sends push notifications (e.g. recurring expense reminders) |

---

## 📂 Project Structure

```
expensify/
├── app/
│   ├── (auth)/           # Login & Signup screens
│   │   ├── login.tsx
│   │   └── signup.tsx
│   ├── (tabs)/           # Main tab navigator
│   │   ├── _layout.tsx   # Tab bar config (Ionicons icons)
│   │   ├── home.tsx      # Main dashboard
│   │   ├── expenses.tsx  # Expense list
│   │   ├── add.tsx       # Add expense form
│   │   ├── voice.tsx     # Voice input screen
│   │   ├── assistant.tsx # AI Insights + chat FAB
│   │   └── profile.tsx   # User profile
│   ├── _layout.tsx       # Root layout (auth guard)
│   ├── ai-bot.tsx        # AI chat screen
│   ├── add-recurring.tsx # Add recurring expense form
│   ├── recurring.tsx     # Recurring expenses list
│   ├── budget-settings.tsx
│   ├── edit-expense.tsx
│   └── family.tsx        # Family group management
├── components/           # Reusable UI components
│   ├── BudgetCard.tsx
│   ├── CategoryPicker.tsx
│   ├── DailyBarChart.tsx
│   ├── DashboardInsights.tsx
│   ├── DashboardSkeleton.tsx
│   ├── ExpenseListSkeleton.tsx
│   ├── ExpenseRow.tsx
│   ├── InsightCard.tsx
│   ├── MemberSpendingBar.tsx
│   ├── OfflineBanner.tsx
│   ├── RecentExpenses.tsx
│   ├── SkeletonLoader.tsx
│   ├── SpendingPieChart.tsx
│   └── StatCard.tsx
├── constants/
│   └── categories.ts     # 12 categories with Ionicons name + color
├── hooks/                # Custom React Query hooks
│   ├── useBudget.ts
│   ├── useDashboardStats.ts
│   ├── useExpenses.ts
│   ├── useFamilyGroup.ts
│   ├── useRecurring.ts
│   └── useVoiceRecorder.ts
├── lib/                  # Utility / service layer
│   ├── ai.ts             # categorizeExpense, parseVoiceExpense, pickAndScanBill
│   ├── currency.ts       # rupeesToPaise / formatAmount helpers
│   ├── haptic.ts
│   ├── supabase.ts       # Supabase client
│   ├── theme.ts          # Light + Dark theme tokens + useTheme hook
│   └── toast.ts
├── store/
│   ├── authStore.ts      # Zustand auth state
│   └── dashboardStore.ts # Zustand view mode (personal / group)
├── supabase/
│   └── functions/        # Edge Functions (Deno)
│       ├── ai-assistant/
│       ├── categorize-expense/
│       ├── generate-insights/
│       ├── parse-voice-expense/
│       ├── scan-bill/
│       └── send-notifications/
└── types/                # Shared TypeScript types
```

---

## 🚀 Getting Started

### Prerequisites

- Node.js ≥ 18
- Expo CLI (`npm install -g expo-cli`)
- Supabase account & project
- Google Gemini API key

### 1. Clone & install

```bash
git clone <repo-url>
cd Expensify
npm install
```

### 2. Configure environment variables

Create a `.env` file in the project root:

```env
EXPO_PUBLIC_SUPABASE_URL=https://<your-project>.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>
```

Set the Gemini API key as a Supabase secret:

```bash
supabase secrets set GEMINI_API_KEY=<your-gemini-key>
```

### 3. Deploy Edge Functions

```bash
supabase functions deploy categorize-expense
supabase functions deploy parse-voice-expense
supabase functions deploy scan-bill
supabase functions deploy generate-insights
supabase functions deploy ai-assistant
supabase functions deploy send-notifications
```

### 4. Run the app

```bash
npx expo start --clear
```

Scan the QR code with Expo Go (Android) or the Camera app (iOS).

---

## 🗃 Supabase Database Schema (Overview)

| Table | Purpose |
|---|---|
| `expenses` | Individual expense records (user_id, amount in paise, category, merchant, date) |
| `recurring_expenses` | Recurring expense templates with frequency + next_due_date |
| `budgets` | Monthly budget per user (total + per-category limits in paise) |
| `insights` | AI-generated insight records (type: daily/weekly/monthly, content, generated_at) |
| `family_groups` | Group metadata (name, owner_id, invite_code) |
| `group_members` | Junction table linking users to groups |

> Row Level Security (RLS) is enabled on all tables. Group members have read access to each other's expenses via a shared group membership policy.

---

## 💡 Key Design Decisions

- **Paise everywhere** — All monetary values are stored as integer paise (1 ₹ = 100 paise) to avoid floating-point bugs.
- **Gemini for all AI** — All three AI functions (categorize, voice parse, bill scan) use the Google Gemini API, migrated from Anthropic Claude.
- **React Query caching** — Dashboard stats, expenses, budget, recurring, and group data are all cached and invalidated on mutation.
- **Theming via `useTheme()`** — Every screen and component calls `useTheme()` so the dark → light switch requires a single line change.
- **Ionicons throughout** — All category and tab-bar icons use Ionicons vector icons for crisp rendering at all sizes.
- **Background voice processing** — Voice recordings are processed asynchronously so the UI is never blocked.

---

## 🧭 Roadmap / Known Limitations

- [ ] Light mode toggle (theme is currently locked to dark mode)
- [ ] Export expenses as CSV / PDF
- [ ] Push notification scheduling for recurring expense reminders
- [ ] Google / Apple SSO login
- [ ] Multi-currency support
- [ ] Widget support (iOS / Android)
- [ ] Automated `generate-insights` cron job (currently triggered manually)

---

## 📄 License

This project is private and not currently licensed for public distribution.

---

*Built with ❤️ using Expo, Supabase, and Google Gemini.*
