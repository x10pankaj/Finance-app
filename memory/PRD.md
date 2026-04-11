# Multi-Year Budget Tracker - Product Requirements Document

## Overview
A mobile application for managing and tracking multi-year budgets with comprehensive expense tracking, income management, and investment portfolio features.

## Core Features

### 1. Expense Management
- **Expense Categories**: Pre-configured categories (Rent/Mortgage, Utilities, Groceries, Transportation, Insurance, Healthcare, Entertainment, Dining Out, Education, Shopping, Subscriptions, Other)
- **Transaction Types**: Support for both Credit (refunds/cashback) and Debit (expenses)
- **Yearly Appreciation**: Define appreciation rate per expense for multi-year projections
- **Recurring Expenses**: Mark expenses as recurring for automatic projection

### 2. Income Source Management
- **Income Tracking**: Add multiple income sources (salary, freelance, rental, etc.)
- **Increment Types**:
  - Percentage-based (e.g., 8% yearly raise)
  - Fixed amount (e.g., $5,000 yearly increase)
- **Active/Inactive Status**: Track current and past income sources

### 3. Investment/Savings Tracking
- **Investment Types**: Pre-configured types (Fixed Deposit, Mutual Funds, Stocks, PPF, Savings Account, Bonds, Real Estate, Gold, Cryptocurrency, Other)
- **Interest Rates**: Define annual interest rate for compound growth calculations
- **Portfolio Overview**: Track principal, current value, and growth

### 4. Multi-Year Projections
- **Custom Projection Period**: User-defined projection years (1-30 years)
- **Financial Calculations**:
  - Expense appreciation over time
  - Income increment calculations
  - Investment compound interest growth
- **Visual Charts**:
  - Income vs Expenses bar chart
  - Savings & Investment growth line chart

### 5. Multi-Currency Support
- USD ($) and INR (₹) support
- Currency toggle across all screens
- Separate data tracking per currency

## Technical Architecture

### Backend (FastAPI + MongoDB)
- RESTful API endpoints
- MongoDB collections for expenses, income_sources, investments, categories, types, settings
- Projection calculation engine

### Frontend (Expo React Native)
- Tab-based navigation (Dashboard, Expenses, Income, Investments, Projections)
- react-native-gifted-charts for visualizations
- Zustand for state management
- Pull-to-refresh support

## API Endpoints

### Data Management
- `POST /api/init` - Initialize default categories and types
- `GET/POST/DELETE /api/expense-categories`
- `GET/POST/PUT/DELETE /api/expenses`
- `GET/POST/PUT/DELETE /api/income-sources`
- `GET/POST/DELETE /api/investment-types`
- `GET/POST/PUT/DELETE /api/investments`

### Analytics
- `GET /api/dashboard` - Current year summary
- `GET /api/projections` - Multi-year forecast

## Default Data

### Expense Categories
1. Rent/Mortgage
2. Utilities
3. Groceries
4. Transportation
5. Insurance
6. Healthcare
7. Entertainment
8. Dining Out
9. Education
10. Shopping
11. Subscriptions
12. Other

### Investment Types
1. Fixed Deposit
2. Mutual Funds
3. Stocks
4. PPF
5. Savings Account
6. Bonds
7. Real Estate
8. Gold
9. Cryptocurrency
10. Other

## User Flow
1. User opens app → Dashboard shows overview
2. Navigate to Expenses/Income/Investments tabs
3. Add items with amounts, rates, and start year
4. View multi-year projections in Projections tab
5. Switch currency to see data in different currencies
