from fastapi import FastAPI, APIRouter, HTTPException, UploadFile, File
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime
from enum import Enum
import pandas as pd
import io
import re

from storage import (
    EncryptedDB,
    is_password_set,
    setup_password,
    verify_password,
    change_password,
)

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# ── App & Router ─────────────────────────────────────────────
app = FastAPI()
api_router = APIRouter(prefix="/api")

# Global encrypted-db handle; initialised after user authenticates.
db: EncryptedDB | None = None


def get_db() -> EncryptedDB:
    if db is None:
        raise HTTPException(status_code=401, detail="Not authenticated. Please log in first.")
    return db


# ── Enums ────────────────────────────────────────────────────
class TransactionType(str, Enum):
    CREDIT = "credit"
    DEBIT = "debit"

class Currency(str, Enum):
    USD = "USD"
    INR = "INR"

class IncrementType(str, Enum):
    PERCENTAGE = "percentage"
    FIXED = "fixed"


# ── Pydantic models (unchanged) ─────────────────────────────
class ExpenseCategory(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    icon: str = "cash-outline"
    is_default: bool = False

class ExpenseCategoryCreate(BaseModel):
    name: str
    icon: str = "cash-outline"

class Expense(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    category_id: str
    category_name: str
    amount: float
    transaction_type: TransactionType
    appreciation_rate: float = 0.0
    start_year: int
    currency: Currency = Currency.USD
    is_recurring: bool = True
    created_at: datetime = Field(default_factory=datetime.utcnow)

class ExpenseCreate(BaseModel):
    name: str
    category_id: str
    category_name: str
    amount: float
    transaction_type: TransactionType
    appreciation_rate: float = 0.0
    start_year: int
    currency: Currency = Currency.USD
    is_recurring: bool = True

class ExpenseUpdate(BaseModel):
    name: Optional[str] = None
    category_id: Optional[str] = None
    category_name: Optional[str] = None
    amount: Optional[float] = None
    transaction_type: Optional[TransactionType] = None
    appreciation_rate: Optional[float] = None
    start_year: Optional[int] = None
    currency: Optional[Currency] = None
    is_recurring: Optional[bool] = None

class IncomeSource(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    amount: float
    increment_rate: float = 0.0
    increment_type: IncrementType = IncrementType.PERCENTAGE
    start_year: int
    currency: Currency = Currency.USD
    is_active: bool = True
    created_at: datetime = Field(default_factory=datetime.utcnow)

class IncomeSourceCreate(BaseModel):
    name: str
    amount: float
    increment_rate: float = 0.0
    increment_type: IncrementType = IncrementType.PERCENTAGE
    start_year: int
    currency: Currency = Currency.USD
    is_active: bool = True

class IncomeSourceUpdate(BaseModel):
    name: Optional[str] = None
    amount: Optional[float] = None
    increment_rate: Optional[float] = None
    increment_type: Optional[IncrementType] = None
    start_year: Optional[int] = None
    currency: Optional[Currency] = None
    is_active: Optional[bool] = None

class InvestmentType(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    icon: str = "trending-up"
    is_default: bool = False

class InvestmentTypeCreate(BaseModel):
    name: str
    icon: str = "trending-up"

class Investment(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    type_id: str
    type_name: str
    principal: float
    interest_rate: float = 0.0
    start_year: int
    currency: Currency = Currency.USD
    is_active: bool = True
    created_at: datetime = Field(default_factory=datetime.utcnow)

class InvestmentCreate(BaseModel):
    name: str
    type_id: str
    type_name: str
    principal: float
    interest_rate: float = 0.0
    start_year: int
    currency: Currency = Currency.USD
    is_active: bool = True

class InvestmentUpdate(BaseModel):
    name: Optional[str] = None
    type_id: Optional[str] = None
    type_name: Optional[str] = None
    principal: Optional[float] = None
    interest_rate: Optional[float] = None
    start_year: Optional[int] = None
    currency: Optional[Currency] = None
    is_active: Optional[bool] = None

class Settings(BaseModel):
    id: str = "app_settings"
    projection_years: int = 5
    default_currency: Currency = Currency.USD

class SettingsUpdate(BaseModel):
    projection_years: Optional[int] = None
    default_currency: Optional[Currency] = None

# Auth models
class PasswordSetup(BaseModel):
    password: str

class PasswordVerify(BaseModel):
    password: str

class PasswordChange(BaseModel):
    old_password: str
    new_password: str

# Transaction import models
class TransactionImportRequest(BaseModel):
    transactions: List[Dict[str, Any]]
    currency: Currency = Currency.USD
    start_year: int = Field(default_factory=lambda: datetime.now().year)
    is_recurring: bool = False
    appreciation_rate: float = 0.0


# ── Default seed data ────────────────────────────────────────
DEFAULT_EXPENSE_CATEGORIES = [
    {"name": "Rent/Mortgage", "icon": "home-outline"},
    {"name": "Utilities", "icon": "flash-outline"},
    {"name": "Groceries", "icon": "cart-outline"},
    {"name": "Transportation", "icon": "car-outline"},
    {"name": "Insurance", "icon": "shield-checkmark-outline"},
    {"name": "Healthcare", "icon": "medkit-outline"},
    {"name": "Entertainment", "icon": "film-outline"},
    {"name": "Dining Out", "icon": "restaurant-outline"},
    {"name": "Education", "icon": "school-outline"},
    {"name": "Shopping", "icon": "bag-outline"},
    {"name": "Subscriptions", "icon": "repeat-outline"},
    {"name": "Other", "icon": "ellipsis-horizontal-outline"},
]

DEFAULT_INVESTMENT_TYPES = [
    {"name": "Fixed Deposit", "icon": "lock-closed-outline"},
    {"name": "Mutual Funds", "icon": "trending-up-outline"},
    {"name": "Stocks", "icon": "stats-chart-outline"},
    {"name": "PPF", "icon": "shield-outline"},
    {"name": "Savings Account", "icon": "wallet-outline"},
    {"name": "Bonds", "icon": "document-text-outline"},
    {"name": "Real Estate", "icon": "business-outline"},
    {"name": "Gold", "icon": "diamond-outline"},
    {"name": "Cryptocurrency", "icon": "logo-bitcoin"},
    {"name": "Other", "icon": "ellipsis-horizontal-outline"},
]

CATEGORY_KEYWORDS = {
    "Rent/Mortgage": ["rent", "mortgage", "lease", "housing", "apartment", "property"],
    "Utilities": ["electric", "electricity", "gas", "water", "utility", "utilities", "power", "energy", "sewage"],
    "Groceries": ["grocery", "groceries", "supermarket", "walmart", "target", "costco", "whole foods", "trader joe", "kroger", "safeway", "publix", "aldi", "food", "market"],
    "Transportation": ["uber", "lyft", "taxi", "cab", "gas station", "fuel", "petrol", "parking", "toll", "transit", "metro", "bus", "train", "subway", "automotive", "car wash"],
    "Insurance": ["insurance", "geico", "state farm", "allstate", "progressive", "liberty mutual", "coverage", "premium"],
    "Healthcare": ["pharmacy", "cvs", "walgreens", "hospital", "clinic", "doctor", "medical", "health", "dental", "vision", "prescription", "medicine"],
    "Entertainment": ["netflix", "hulu", "disney", "spotify", "apple music", "youtube", "movie", "cinema", "theater", "concert", "game", "gaming", "playstation", "xbox", "steam"],
    "Dining Out": ["restaurant", "cafe", "coffee", "starbucks", "mcdonald", "burger", "pizza", "doordash", "grubhub", "uber eats", "postmates", "chipotle", "subway", "wendy", "taco bell", "kfc", "dining"],
    "Education": ["tuition", "school", "university", "college", "course", "udemy", "coursera", "book", "education", "learning", "training"],
    "Shopping": ["amazon", "ebay", "etsy", "shop", "store", "mall", "clothing", "apparel", "fashion", "nike", "adidas", "zara", "h&m", "best buy", "apple store"],
    "Subscriptions": ["subscription", "membership", "monthly", "annual", "recurring", "prime", "gym", "fitness", "magazine"],
    "Other": [],
}


# ── Auth endpoints ───────────────────────────────────────────

@api_router.get("/auth/status")
async def auth_status():
    return {"password_set": is_password_set(), "authenticated": db is not None}

@api_router.post("/auth/setup")
async def auth_setup(body: PasswordSetup):
    if len(body.password) < 4:
        raise HTTPException(status_code=400, detail="Password must be at least 4 characters")
    if is_password_set():
        raise HTTPException(status_code=400, detail="Password already set")
    setup_password(body.password)
    global db
    db = EncryptedDB(body.password)
    return {"message": "Password created successfully"}

@api_router.post("/auth/login")
async def auth_login(body: PasswordVerify):
    if not is_password_set():
        raise HTTPException(status_code=400, detail="Password not set yet")
    if not verify_password(body.password):
        raise HTTPException(status_code=401, detail="Incorrect password")
    global db
    db = EncryptedDB(body.password)
    return {"message": "Login successful"}

@api_router.post("/auth/change-password")
async def auth_change_password(body: PasswordChange):
    if not change_password(body.old_password, body.new_password):
        raise HTTPException(status_code=401, detail="Incorrect current password")
    global db
    db = EncryptedDB(body.new_password)
    return {"message": "Password changed successfully"}


# ── Root ─────────────────────────────────────────────────────
@api_router.get("/")
async def root():
    return {"message": "Budget Tracker API", "version": "2.0", "storage": "encrypted_local"}

# ── Init ─────────────────────────────────────────────────────
@api_router.post("/init")
async def initialize_data():
    _db = get_db()
    existing_categories = await _db.expense_categories.count_documents({})
    existing_types = await _db.investment_types.count_documents({})

    if existing_categories == 0:
        for cat in DEFAULT_EXPENSE_CATEGORIES:
            c = ExpenseCategory(name=cat["name"], icon=cat["icon"], is_default=True)
            await _db.expense_categories.insert_one(c.dict())

    if existing_types == 0:
        for t in DEFAULT_INVESTMENT_TYPES:
            inv = InvestmentType(name=t["name"], icon=t["icon"], is_default=True)
            await _db.investment_types.insert_one(inv.dict())

    existing_settings = await _db.settings.find_one({"id": "app_settings"})
    if not existing_settings:
        await _db.settings.insert_one(Settings().dict())

    return {"message": "Data initialized successfully"}


# ── Expense Categories ───────────────────────────────────────
@api_router.get("/expense-categories", response_model=List[ExpenseCategory])
async def get_expense_categories():
    _db = get_db()
    cats = await _db.expense_categories.find()
    return [ExpenseCategory(**c) for c in cats]

@api_router.post("/expense-categories", response_model=ExpenseCategory)
async def create_expense_category(body: ExpenseCategoryCreate):
    _db = get_db()
    cat = ExpenseCategory(**body.dict(), is_default=False)
    await _db.expense_categories.insert_one(cat.dict())
    return cat

@api_router.delete("/expense-categories/{category_id}")
async def delete_expense_category(category_id: str):
    _db = get_db()
    result = await _db.expense_categories.delete_one({"id": category_id, "is_default": False})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Category not found or cannot delete default")
    return {"message": "Deleted"}


# ── Expenses ─────────────────────────────────────────────────
@api_router.get("/expenses", response_model=List[Expense])
async def get_expenses():
    _db = get_db()
    return [Expense(**e) for e in await _db.expenses.find()]

@api_router.post("/expenses", response_model=Expense)
async def create_expense(body: ExpenseCreate):
    _db = get_db()
    exp = Expense(**body.dict())
    await _db.expenses.insert_one(exp.dict())
    return exp

@api_router.get("/expenses/{eid}", response_model=Expense)
async def get_expense(eid: str):
    _db = get_db()
    e = await _db.expenses.find_one({"id": eid})
    if not e:
        raise HTTPException(status_code=404, detail="Expense not found")
    return Expense(**e)

@api_router.put("/expenses/{eid}", response_model=Expense)
async def update_expense(eid: str, body: ExpenseUpdate):
    _db = get_db()
    data = {k: v for k, v in body.dict().items() if v is not None}
    if not data:
        raise HTTPException(status_code=400, detail="No fields to update")
    result = await _db.expenses.update_one({"id": eid}, {"$set": data})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Expense not found")
    return Expense(**(await _db.expenses.find_one({"id": eid})))

@api_router.delete("/expenses/{eid}")
async def delete_expense(eid: str):
    _db = get_db()
    result = await _db.expenses.delete_one({"id": eid})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Expense not found")
    return {"message": "Deleted"}


# ── Income Sources ───────────────────────────────────────────
@api_router.get("/income-sources", response_model=List[IncomeSource])
async def get_income_sources():
    _db = get_db()
    return [IncomeSource(**s) for s in await _db.income_sources.find()]

@api_router.post("/income-sources", response_model=IncomeSource)
async def create_income_source(body: IncomeSourceCreate):
    _db = get_db()
    src = IncomeSource(**body.dict())
    await _db.income_sources.insert_one(src.dict())
    return src

@api_router.get("/income-sources/{sid}", response_model=IncomeSource)
async def get_income_source(sid: str):
    _db = get_db()
    s = await _db.income_sources.find_one({"id": sid})
    if not s:
        raise HTTPException(status_code=404, detail="Income source not found")
    return IncomeSource(**s)

@api_router.put("/income-sources/{sid}", response_model=IncomeSource)
async def update_income_source(sid: str, body: IncomeSourceUpdate):
    _db = get_db()
    data = {k: v for k, v in body.dict().items() if v is not None}
    if not data:
        raise HTTPException(status_code=400, detail="No fields to update")
    result = await _db.income_sources.update_one({"id": sid}, {"$set": data})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Income source not found")
    return IncomeSource(**(await _db.income_sources.find_one({"id": sid})))

@api_router.delete("/income-sources/{sid}")
async def delete_income_source(sid: str):
    _db = get_db()
    result = await _db.income_sources.delete_one({"id": sid})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Income source not found")
    return {"message": "Deleted"}


# ── Investment Types ─────────────────────────────────────────
@api_router.get("/investment-types", response_model=List[InvestmentType])
async def get_investment_types():
    _db = get_db()
    return [InvestmentType(**t) for t in await _db.investment_types.find()]

@api_router.post("/investment-types", response_model=InvestmentType)
async def create_investment_type(body: InvestmentTypeCreate):
    _db = get_db()
    inv = InvestmentType(**body.dict(), is_default=False)
    await _db.investment_types.insert_one(inv.dict())
    return inv

@api_router.delete("/investment-types/{tid}")
async def delete_investment_type(tid: str):
    _db = get_db()
    result = await _db.investment_types.delete_one({"id": tid, "is_default": False})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Type not found or cannot delete default")
    return {"message": "Deleted"}


# ── Investments ──────────────────────────────────────────────
@api_router.get("/investments", response_model=List[Investment])
async def get_investments():
    _db = get_db()
    return [Investment(**i) for i in await _db.investments.find()]

@api_router.post("/investments", response_model=Investment)
async def create_investment(body: InvestmentCreate):
    _db = get_db()
    inv = Investment(**body.dict())
    await _db.investments.insert_one(inv.dict())
    return inv

@api_router.get("/investments/{iid}", response_model=Investment)
async def get_investment(iid: str):
    _db = get_db()
    i = await _db.investments.find_one({"id": iid})
    if not i:
        raise HTTPException(status_code=404, detail="Investment not found")
    return Investment(**i)

@api_router.put("/investments/{iid}", response_model=Investment)
async def update_investment(iid: str, body: InvestmentUpdate):
    _db = get_db()
    data = {k: v for k, v in body.dict().items() if v is not None}
    if not data:
        raise HTTPException(status_code=400, detail="No fields to update")
    result = await _db.investments.update_one({"id": iid}, {"$set": data})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Investment not found")
    return Investment(**(await _db.investments.find_one({"id": iid})))

@api_router.delete("/investments/{iid}")
async def delete_investment(iid: str):
    _db = get_db()
    result = await _db.investments.delete_one({"id": iid})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Investment not found")
    return {"message": "Deleted"}


# ── Settings ─────────────────────────────────────────────────
@api_router.get("/settings", response_model=Settings)
async def get_settings():
    _db = get_db()
    s = await _db.settings.find_one({"id": "app_settings"})
    if not s:
        default = Settings()
        await _db.settings.insert_one(default.dict())
        return default
    return Settings(**s)

@api_router.put("/settings", response_model=Settings)
async def update_settings(body: SettingsUpdate):
    _db = get_db()
    data = {k: v for k, v in body.dict().items() if v is not None}
    if not data:
        raise HTTPException(status_code=400, detail="No fields to update")
    await _db.settings.update_one({"id": "app_settings"}, {"$set": data}, upsert=True)
    return Settings(**(await _db.settings.find_one({"id": "app_settings"})))


# ── Projections ──────────────────────────────────────────────
@api_router.get("/projections")
async def get_projections(years: int = 5, currency: Currency = Currency.USD):
    _db = get_db()
    current_year = datetime.now().year
    expenses = await _db.expenses.find({"currency": currency})
    income_sources = await _db.income_sources.find({"currency": currency, "is_active": True})
    investments = await _db.investments.find({"currency": currency, "is_active": True})

    projections = []
    for offset in range(years):
        year = current_year + offset
        total_credit = total_debit = total_income = total_inv = 0.0
        e_breakdown, i_breakdown, inv_breakdown = [], [], []

        for exp in expenses:
            e = Expense(**exp)
            if e.start_year <= year and e.is_recurring:
                yrs = year - e.start_year
                amt = e.amount * ((1 + e.appreciation_rate / 100) ** yrs)
                (total_credit if e.transaction_type == TransactionType.CREDIT else total_debit).__iadd__(0)  # dummy
                if e.transaction_type == TransactionType.CREDIT:
                    total_credit += amt
                else:
                    total_debit += amt
                e_breakdown.append({"name": e.name, "category": e.category_name, "amount": round(amt, 2), "type": e.transaction_type})

        for src in income_sources:
            s = IncomeSource(**src)
            if s.start_year <= year:
                yrs = year - s.start_year
                amt = s.amount * ((1 + s.increment_rate / 100) ** yrs) if s.increment_type == IncrementType.PERCENTAGE else s.amount + s.increment_rate * yrs
                total_income += amt
                i_breakdown.append({"name": s.name, "amount": round(amt, 2)})

        for inv in investments:
            v = Investment(**inv)
            if v.start_year <= year:
                yrs = year - v.start_year
                amt = v.principal * ((1 + v.interest_rate / 100) ** yrs)
                total_inv += amt
                inv_breakdown.append({"name": v.name, "type": v.type_name, "principal": v.principal, "current_value": round(amt, 2), "growth": round(amt - v.principal, 2)})

        net_exp = total_debit - total_credit
        projections.append({
            "year": year,
            "total_income": round(total_income, 2),
            "total_expenses_credit": round(total_credit, 2),
            "total_expenses_debit": round(total_debit, 2),
            "net_expenses": round(net_exp, 2),
            "total_investments": round(total_inv, 2),
            "net_savings": round(total_income - net_exp, 2),
            "expense_breakdown": e_breakdown,
            "income_breakdown": i_breakdown,
            "investment_breakdown": inv_breakdown,
        })

    return {"currency": currency, "years": years, "projections": projections}


# ── Dashboard ────────────────────────────────────────────────
@api_router.get("/dashboard")
async def get_dashboard(currency: Currency = Currency.USD):
    _db = get_db()
    current_year = datetime.now().year

    expenses = await _db.expenses.find({"currency": currency})
    income_sources = await _db.income_sources.find({"currency": currency, "is_active": True})
    investments = await _db.investments.find({"currency": currency, "is_active": True})

    total_debit = total_credit = total_income = total_inv = 0.0
    by_cat: dict[str, float] = {}

    for exp in expenses:
        e = Expense(**exp)
        if e.start_year <= current_year:
            yrs = current_year - e.start_year
            amt = e.amount * ((1 + e.appreciation_rate / 100) ** yrs)
            if e.transaction_type == TransactionType.DEBIT:
                total_debit += amt
            else:
                total_credit += amt
            by_cat[e.category_name] = by_cat.get(e.category_name, 0) + amt

    for src in income_sources:
        s = IncomeSource(**src)
        if s.start_year <= current_year:
            yrs = current_year - s.start_year
            amt = s.amount * ((1 + s.increment_rate / 100) ** yrs) if s.increment_type == IncrementType.PERCENTAGE else s.amount + s.increment_rate * yrs
            total_income += amt

    for inv in investments:
        v = Investment(**inv)
        if v.start_year <= current_year:
            yrs = current_year - v.start_year
            total_inv += v.principal * ((1 + v.interest_rate / 100) ** yrs)

    net_exp = total_debit - total_credit
    return {
        "current_year": current_year,
        "currency": currency,
        "counts": {
            "expenses": len(await _db.expenses.find({"currency": currency})),
            "income_sources": len(income_sources),
            "investments": len(investments),
        },
        "totals": {
            "income": round(total_income, 2),
            "expenses_debit": round(total_debit, 2),
            "expenses_credit": round(total_credit, 2),
            "net_expenses": round(net_exp, 2),
            "investments": round(total_inv, 2),
            "net_savings": round(total_income - net_exp, 2),
        },
        "expenses_by_category": {k: round(v, 2) for k, v in by_cat.items()},
    }


# ── Transaction upload ───────────────────────────────────────
async def categorize_transaction(description: str):
    _db = get_db()
    categories = await _db.expense_categories.find()
    cat_map = {c["name"]: c for c in categories}
    best, best_conf = None, 0.0
    desc_lower = description.lower()
    for cat_name, keywords in CATEGORY_KEYWORDS.items():
        if cat_name not in cat_map:
            continue
        for kw in keywords:
            if kw in desc_lower:
                conf = min(len(kw) / len(desc_lower) * 200, 95)
                if conf > best_conf:
                    best_conf = conf
                    best = cat_map[cat_name]
    if not best:
        best = cat_map.get("Other", (categories[0] if categories else None))
        best_conf = 10.0
    return best, best_conf


@api_router.post("/transactions/upload")
async def upload_bank_statement(file: UploadFile = File(...)):
    _ = get_db()
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file provided")
    ext = file.filename.lower().split('.')[-1]
    if ext not in ('csv', 'xlsx', 'xls'):
        raise HTTPException(status_code=400, detail="Only CSV and Excel files are supported")
    try:
        contents = await file.read()
        df = pd.read_csv(io.BytesIO(contents)) if ext == 'csv' else pd.read_excel(io.BytesIO(contents))
        df.columns = df.columns.str.lower().str.strip()

        date_vars = ['date', 'transaction date', 'trans date', 'posting date', 'value date']
        desc_vars = ['description', 'desc', 'narrative', 'particulars', 'details', 'memo']
        amt_vars = ['amount', 'value', 'sum', 'transaction amount']
        type_vars = ['type', 'transaction type', 'trans type', 'dr/cr']

        date_col = desc_col = amount_col = type_col = None
        for col in df.columns:
            cl = col.lower()
            if not date_col and any(v in cl for v in date_vars): date_col = col
            if not desc_col and any(v in cl for v in desc_vars): desc_col = col
            if not amount_col and any(v in cl for v in amt_vars): amount_col = col
            if not type_col and any(v in cl for v in type_vars): type_col = col
        if not date_col: date_col = df.columns[0] if len(df.columns) > 0 else None
        if not desc_col: desc_col = df.columns[1] if len(df.columns) > 1 else None
        if not amount_col: amount_col = df.columns[2] if len(df.columns) > 2 else None
        if not all([date_col, desc_col, amount_col]):
            raise HTTPException(status_code=400, detail=f"Could not identify required columns. Found: {list(df.columns)}")

        parsed = []
        for _, row in df.iterrows():
            try:
                desc = str(row[desc_col]) if pd.notna(row[desc_col]) else "Unknown"
                raw = row[amount_col]
                if pd.isna(raw): continue
                s = str(raw).replace(',', '').replace('$', '').replace('₹', '').strip()
                if '(' in s: s = s.replace('(', '-').replace(')', '')
                try: amount = float(s)
                except ValueError: continue
                if type_col and pd.notna(row.get(type_col)):
                    tv = str(row[type_col]).lower()
                    tt = TransactionType.CREDIT if any(t in tv for t in ['credit', 'cr', 'deposit', 'income']) else TransactionType.DEBIT
                else:
                    tt = TransactionType.CREDIT if amount > 0 else TransactionType.DEBIT
                amount = abs(amount)
                cat, conf = await categorize_transaction(desc)
                parsed.append({"id": str(uuid.uuid4()), "date": str(row[date_col]), "description": desc, "amount": round(amount, 2), "transaction_type": tt, "suggested_category_id": cat["id"] if cat else "", "suggested_category_name": cat["name"] if cat else "Other", "confidence": round(conf, 1), "selected": True})
            except Exception:
                continue
        if not parsed:
            raise HTTPException(status_code=400, detail="No valid transactions found")
        return {"message": f"Parsed {len(parsed)} transactions", "transactions": parsed, "columns_detected": {"date": date_col, "description": desc_col, "amount": amount_col, "type": type_col}}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error processing file: {str(e)}")


@api_router.post("/transactions/import")
async def import_transactions(request: TransactionImportRequest):
    _db = get_db()
    imported_exp, imported_inc = [], []
    for t in request.transactions:
        if not t.get("selected", True): continue
        tt = t.get("transaction_type", "debit")
        if isinstance(tt, str):
            tt = TransactionType.CREDIT if tt.lower() == "credit" else TransactionType.DEBIT
        if tt == TransactionType.CREDIT and t.get("amount", 0) > 1000:
            inc = IncomeSource(name=t.get("description", "Imported")[:100], amount=t.get("amount", 0), start_year=request.start_year, currency=request.currency, is_active=True)
            await _db.income_sources.insert_one(inc.dict())
            imported_inc.append(inc.dict())
        else:
            exp = Expense(name=t.get("description", "Imported")[:100], category_id=t.get("category_id", t.get("suggested_category_id", "")), category_name=t.get("category_name", t.get("suggested_category_name", "Other")), amount=t.get("amount", 0), transaction_type=tt, appreciation_rate=request.appreciation_rate, start_year=request.start_year, currency=request.currency, is_recurring=request.is_recurring)
            await _db.expenses.insert_one(exp.dict())
            imported_exp.append(exp.dict())
    return {"message": f"Imported {len(imported_exp)} expenses and {len(imported_inc)} income", "expenses_count": len(imported_exp), "income_count": len(imported_inc), "expenses": imported_exp, "income": imported_inc}


# ── Wire up ──────────────────────────────────────────────────
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)
