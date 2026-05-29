# Multi-Year Budget Tracker

A fully offline, privacy-first mobile app for managing and projecting multi-year budgets. Built with Expo React Native — runs on iOS, Android, and Web with **zero server dependency**.

All financial data is AES-256 encrypted on-device using a user-set password. No cloud, no backend, no data leaves your phone.

---

## Table of Contents

- [Features](#features)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Feature Iteration Log](#feature-iteration-log)
- [Data Model](#data-model)
- [Security & Encryption](#security--encryption)
- [Screens](#screens)
- [Building for Production](#building-for-production)

---

## Features

### Core Budget Management
- **Expenses** — Track recurring expenses with credit/debit types and yearly appreciation rates
- **Income Sources** — Manage salaries, freelance, rentals with percentage or fixed annual increments
- **Investments** — Portfolio tracking across 10 investment types with compound interest calculations
- **Multi-Year Projections** — Visual charts forecasting income, expenses, and investment growth over custom year ranges (1–30 years)
- **Multi-Currency** — USD ($) and INR (₹) support with per-currency data isolation

### Data Import
- **Bank Statement Upload** — CSV and Excel (.xlsx) file parsing with auto-categorization
- **Smart Categorization** — Keyword-based matching (AMAZON → Shopping, UBER → Transportation, STARBUCKS → Dining Out, etc.)
- **Preview & Review** — Edit categories before importing; select/deselect individual transactions

### Security & Privacy
- **Password-Protected Profiles** — Each profile has independent AES-encrypted data
- **Multi-Profile Support** — Create, switch, and delete budget profiles
- **Biometric Unlock** — Face ID / Fingerprint support on native devices
- **Auto-Lock** — Configurable inactivity timeout (1/5/15/30 min or off)
- **100% Offline** — All data stays on-device, no network calls ever

### UI/UX
- **Dark & Light Mode** — Ink Wash light theme (Figma Combination 8) + dark theme
- **Icon-Only Tab Bar** — Clean 6-tab navigation without text overlap
- **Settings Screen** — Centralized appearance, currency, security, and profile management
- **Pull-to-Refresh** — On all data screens
- **Responsive** — Works on phones, tablets, and web browsers

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                    Expo React Native App            │
│                                                     │
│  ┌──────────┐  ┌──────────┐  ┌──────────────────┐  │
│  │  Screens │→ │ API Layer│→ │  Local Services   │  │
│  │ (tabs)   │  │ (same    │  │                   │  │
│  │          │  │ interface)│  │  ┌─────────────┐  │  │
│  │ Dashboard │  │          │  │  │  Encrypted  │  │  │
│  │ Expenses  │  │ No HTTP  │  │  │  Collection │  │  │
│  │ Income    │  │ calls —  │  │  │             │  │  │
│  │ Invest    │  │ all local│  │  │ AsyncStorage│  │  │
│  │ Project   │  │          │  │  │ + AES-256   │  │  │
│  │ Settings  │  │          │  │  └─────────────┘  │  │
│  └──────────┘  └──────────┘  └──────────────────┘  │
│                                                     │
│  ┌──────────────────────────────────────────────┐   │
│  │              Zustand State Store              │   │
│  │  theme, currency, dataVersion, autoLock...    │   │
│  └──────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
```

**Key Design Decision:** The API layer (`src/api/index.ts`) maintains the same function signatures that screens import. Under the hood, it calls local encrypted storage services instead of HTTP endpoints. This means all screen components are completely decoupled from storage implementation.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Expo SDK 54 + React Native |
| Navigation | Expo Router (file-based) |
| State | Zustand + AsyncStorage |
| Encryption | crypto-js (AES-256 + PBKDF2) |
| Charts | react-native-gifted-charts |
| CSV Parsing | papaparse |
| Biometrics | expo-local-authentication |
| Icons | @expo/vector-icons (Ionicons) |

---

## Project Structure

```
frontend/
├── app/                        # Expo Router screens
│   ├── _layout.tsx             # Root layout (auth gate + auto-lock)
│   └── (tabs)/                 # Tab navigation group
│       ├── _layout.tsx         # Tab bar configuration
│       ├── index.tsx           # Dashboard (Budget Overview)
│       ├── expenses.tsx        # Expense CRUD
│       ├── income.tsx          # Income source CRUD
│       ├── investments.tsx     # Investment CRUD
│       ├── projections.tsx     # Multi-year charts & breakdown
│       ├── settings.tsx        # App settings & profile management
│       └── import.tsx          # Bank statement upload (hidden tab)
│
├── src/
│   ├── api/
│   │   └── index.ts           # API layer (local service calls)
│   ├── services/
│   │   └── storage.ts         # Encrypted storage engine
│   ├── store/
│   │   └── index.ts           # Zustand state (theme, currency, etc.)
│   ├── theme/
│   │   └── index.ts           # Dark + Light (Ink Wash) theme tokens
│   ├── types/
│   │   └── index.ts           # TypeScript interfaces
│   └── components/
│       ├── LockScreen.tsx      # Auth: profile select, create, login
│       ├── Card.tsx            # Card + StatCard components
│       ├── Button.tsx          # Themed button
│       ├── FormModal.tsx       # Bottom sheet modal
│       ├── FormInput.tsx       # Themed text input
│       ├── FormSelect.tsx      # Dropdown select
│       ├── EmptyState.tsx      # Empty list placeholder
│       ├── CurrencyToggle.tsx  # USD/INR toggle
│       └── ThemeToggle.tsx     # Dark/light mode toggle
│
├── app.json                    # Expo config (permissions, icons)
├── package.json
└── tsconfig.json
```

---

## Getting Started

### Prerequisites
- Node.js 18+
- Expo CLI (`npm install -g expo-cli`)
- Expo Go app on your phone (for testing)

### Install & Run

```bash
# Clone the repository
git clone https://github.com/x10pankaj/Finance-app.git
cd Finance-app/frontend

# Install dependencies
yarn install

# Start the development server
npx expo start

# Scan QR code with Expo Go (iOS/Android)
# Or press 'w' for web browser
```

### No Backend Required
The app runs entirely on-device. No server setup, no database, no environment variables needed for the core app.

---

## Feature Iteration Log

### Iteration 1 — MVP (Multi-Year Budget Tracker)
**Goal:** Core budget management with multi-year projections

- Built FastAPI backend with MongoDB for data persistence
- Created 5-tab Expo app: Dashboard, Expenses, Income, Investments, Projections
- Expense management with credit/debit types and yearly appreciation rates
- Income sources with percentage or fixed annual increments
- Investment tracking with compound interest across 10 pre-configured types
- Multi-year projection engine with bar charts (income vs expenses) and line charts (savings & investment growth)
- Multi-currency support (USD/INR) with toggle on all screens
- Pre-seeded 12 expense categories and 10 investment types
- Pull-to-refresh and empty state handling on all screens

### Iteration 2 — Bank Statement Import
**Goal:** Upload CSV/Excel bank statements with auto-categorization

- Added CSV and Excel (.xlsx, .xls) file upload endpoint
- Built keyword-based auto-categorization engine (71% accuracy)
- Transaction preview screen with select/deselect and category editing
- Import settings: start year, appreciation rate, recurring flag
- Smart import logic: large credits (>$1000) auto-imported as income sources
- New Import tab in navigation

### Iteration 3 — Dark/Light Mode
**Goal:** Theme toggle with Figma Ink Wash Combination 8 light palette

- Created centralized theme system (`src/theme/index.ts`) with two complete themes
- Dark theme: #0c0c0c background, #4CAF50 accent
- Light theme (Ink Wash): #F5F0EB background, #252525/#7D7D7D/#CFCFCF/#545454 palette
- ThemeToggle component on Dashboard header
- All 6 screens + tab bar + modals + form components respond to theme changes
- Theme preference persisted via AsyncStorage

### Iteration 4 — Encrypted Local Storage (No MongoDB)
**Goal:** Remove database dependency, store all data in password-encrypted local files

- Created `storage.py` encrypted file storage module using Fernet AES + PBKDF2
- Password setup on first launch, login on subsequent launches
- All CRUD endpoints unchanged — just swapped storage backend
- Lock screen with password input and "AES-encrypted on disk" badge
- Data stored as `.enc` files in `/backend/data/` directory

### Iteration 5 — Biometric Unlock & Auto-Lock
**Goal:** Face ID/Fingerprint support and inactivity timeout

- Integrated `expo-local-authentication` for native biometric auth
- Auto-detects hardware: Face ID on iPhone, Fingerprint on Android
- Password cached securely for biometric re-authentication
- Auto-lock timer: checks on background return + periodic 30-second foreground check
- Configurable timeout: 1/5/15/30 min or disabled
- `app.json` updated with iOS `NSFaceIDUsageDescription` and Android `USE_BIOMETRIC` permission

### Iteration 6 — Multi-Profile Support & Dashboard Auto-Refresh
**Goal:** Multiple independent budget profiles + reactive data updates

- Profile selector screen on launch (list profiles, create new, or login)
- Each profile has independent encrypted data directory
- Profile CRUD API endpoints: create, list, login, delete
- Added `dataVersion` counter in Zustand store
- All CRUD screens call `bumpDataVersion()` after create/update/delete
- Dashboard `useEffect` depends on `dataVersion` — auto-refreshes on data changes

### Iteration 7 — Settings Screen & UI Cleanup
**Goal:** Centralize all app controls in a dedicated Settings screen

- New Settings tab with sections: Appearance, Currency, Security, Profiles, Data
- Dark Mode toggle moved from Dashboard header to Settings
- Currency selector moved from all screen headers to Settings
- Auto-Lock Timer configuration with visual pill selector
- Profile management (view, delete) with avatar initials
- Import Transactions accessible via Settings → Data section
- Icon-only tab bar (no text labels) — eliminated overlap issue
- Removed duplicate screen titles (expo-router header vs in-screen title)

### Iteration 8 — Fully Offline (No Server Required)
**Goal:** Run entirely on-device — no FastAPI, no MongoDB, no network calls

- Rewrote storage engine to use AsyncStorage + crypto-js AES (works on iOS, Android, Web)
- Rewrote entire API layer to call local services instead of HTTP endpoints
- Same function signatures — all screen components unchanged
- Dashboard calculations, projections, auto-categorization all run in-app
- CSV parsing via papaparse (no server needed)
- Profile management via encrypted AsyncStorage keys
- App can be distributed as a standalone binary — zero infrastructure

---

## Data Model

### Expense
| Field | Type | Description |
|-------|------|-------------|
| id | string | UUID |
| name | string | Expense name |
| category_id | string | Reference to category |
| category_name | string | Denormalized category name |
| amount | number | Annual amount |
| transaction_type | 'credit' \| 'debit' | Credit = refund/cashback |
| appreciation_rate | number | Yearly % increase |
| start_year | number | Year expense begins |
| currency | 'USD' \| 'INR' | Currency |
| is_recurring | boolean | Included in projections |

### Income Source
| Field | Type | Description |
|-------|------|-------------|
| id | string | UUID |
| name | string | Source name |
| amount | number | Annual amount |
| increment_rate | number | Yearly raise |
| increment_type | 'percentage' \| 'fixed' | Raise type |
| start_year | number | Year income begins |
| currency | 'USD' \| 'INR' | Currency |
| is_active | boolean | Currently active |

### Investment
| Field | Type | Description |
|-------|------|-------------|
| id | string | UUID |
| name | string | Investment name |
| type_id | string | Reference to type |
| type_name | string | Denormalized type name |
| principal | number | Initial investment |
| interest_rate | number | Annual interest % |
| start_year | number | Year of investment |
| currency | 'USD' \| 'INR' | Currency |
| is_active | boolean | Currently active |

---

## Security & Encryption

```
User Password
     │
     ▼
PBKDF2 (50K iterations) ──→ Password Hash (verification)
     │
PBKDF2 (10K iterations) ──→ AES Encryption Key
     │
     ▼
AES-256 Encrypt/Decrypt ──→ AsyncStorage
     │
     ▼
Each collection stored as: budget_{profileId}_{collection} = AES(JSON)
```

- **Password never stored** — only PBKDF2 hash for verification
- **Unique salt per profile** — generated with `CryptoJS.lib.WordArray.random(16)`
- **Data isolation** — each profile's collections are prefixed with profile ID
- **No plaintext on disk** — all budget data is encrypted at rest

---

## Screens

| Screen | Tab Icon | Description |
|--------|----------|-------------|
| Budget Overview | Grid | Dashboard with summary cards, pie chart, budget item counts |
| Expenses | Wallet | CRUD for expenses with category, type, appreciation rate |
| Income | Cash | CRUD for income sources with increment configuration |
| Investments | Trending Up | CRUD for investments with interest rate and growth tracking |
| Projections | Analytics | Multi-year forecast with bar/line charts and year-by-year breakdown |
| Settings | Gear | Appearance, currency, security, profiles, data import |

---

## Building for Production

### Using EAS Build (Recommended)

```bash
# Install EAS CLI
npm install -g eas-cli

# Configure build
eas build:configure

# Build for iOS
eas build --platform ios

# Build for Android
eas build --platform android

# Submit to stores
eas submit --platform ios
eas submit --platform android
```

### Local Build

```bash
# iOS (requires macOS + Xcode)
npx expo run:ios

# Android (requires Android Studio)
npx expo run:android
```

---

## License

Private — All rights reserved.
