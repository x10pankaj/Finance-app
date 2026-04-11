from fastapi import FastAPI, APIRouter, HTTPException, UploadFile, File
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
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

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app without a prefix
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Enums
class TransactionType(str, Enum):
    CREDIT = "credit"
    DEBIT = "debit"

class Currency(str, Enum):
    USD = "USD"
    INR = "INR"

class IncrementType(str, Enum):
    PERCENTAGE = "percentage"
    FIXED = "fixed"

# Models
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
    appreciation_rate: float = 0.0  # Yearly appreciation percentage
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
    interest_rate: float = 0.0  # Annual interest rate percentage
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

# Transaction Import Models
class ParsedTransaction(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    date: str
    description: str
    amount: float
    transaction_type: TransactionType
    suggested_category_id: str
    suggested_category_name: str
    confidence: float = 0.0  # Categorization confidence
    selected: bool = True  # Whether to import this transaction

class TransactionImportRequest(BaseModel):
    transactions: List[Dict[str, Any]]
    currency: Currency = Currency.USD
    start_year: int = Field(default_factory=lambda: datetime.now().year)
    is_recurring: bool = False
    appreciation_rate: float = 0.0

# Category keyword mappings for auto-categorization
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
    "Other": []
}

# Default categories and types
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

# Routes
@api_router.get("/")
async def root():
    return {"message": "Budget Tracker API", "version": "1.0"}

# Initialize default data
@api_router.post("/init")
async def initialize_data():
    """Initialize default categories and investment types"""
    # Check if already initialized
    existing_categories = await db.expense_categories.count_documents({})
    existing_types = await db.investment_types.count_documents({})
    
    if existing_categories == 0:
        for cat in DEFAULT_EXPENSE_CATEGORIES:
            category = ExpenseCategory(name=cat["name"], icon=cat["icon"], is_default=True)
            await db.expense_categories.insert_one(category.dict())
    
    if existing_types == 0:
        for inv_type in DEFAULT_INVESTMENT_TYPES:
            investment_type = InvestmentType(name=inv_type["name"], icon=inv_type["icon"], is_default=True)
            await db.investment_types.insert_one(investment_type.dict())
    
    # Initialize default settings
    existing_settings = await db.settings.find_one({"id": "app_settings"})
    if not existing_settings:
        settings = Settings()
        await db.settings.insert_one(settings.dict())
    
    return {"message": "Data initialized successfully"}

# Expense Categories
@api_router.get("/expense-categories", response_model=List[ExpenseCategory])
async def get_expense_categories():
    categories = await db.expense_categories.find().to_list(100)
    return [ExpenseCategory(**cat) for cat in categories]

@api_router.post("/expense-categories", response_model=ExpenseCategory)
async def create_expense_category(input: ExpenseCategoryCreate):
    category = ExpenseCategory(**input.dict(), is_default=False)
    await db.expense_categories.insert_one(category.dict())
    return category

@api_router.delete("/expense-categories/{category_id}")
async def delete_expense_category(category_id: str):
    result = await db.expense_categories.delete_one({"id": category_id, "is_default": False})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Category not found or cannot delete default category")
    return {"message": "Category deleted"}

# Expenses
@api_router.get("/expenses", response_model=List[Expense])
async def get_expenses():
    expenses = await db.expenses.find().to_list(1000)
    return [Expense(**expense) for expense in expenses]

@api_router.post("/expenses", response_model=Expense)
async def create_expense(input: ExpenseCreate):
    expense = Expense(**input.dict())
    await db.expenses.insert_one(expense.dict())
    return expense

@api_router.get("/expenses/{expense_id}", response_model=Expense)
async def get_expense(expense_id: str):
    expense = await db.expenses.find_one({"id": expense_id})
    if not expense:
        raise HTTPException(status_code=404, detail="Expense not found")
    return Expense(**expense)

@api_router.put("/expenses/{expense_id}", response_model=Expense)
async def update_expense(expense_id: str, input: ExpenseUpdate):
    update_data = {k: v for k, v in input.dict().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")
    
    result = await db.expenses.update_one({"id": expense_id}, {"$set": update_data})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Expense not found")
    
    expense = await db.expenses.find_one({"id": expense_id})
    return Expense(**expense)

@api_router.delete("/expenses/{expense_id}")
async def delete_expense(expense_id: str):
    result = await db.expenses.delete_one({"id": expense_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Expense not found")
    return {"message": "Expense deleted"}

# Income Sources
@api_router.get("/income-sources", response_model=List[IncomeSource])
async def get_income_sources():
    sources = await db.income_sources.find().to_list(1000)
    return [IncomeSource(**source) for source in sources]

@api_router.post("/income-sources", response_model=IncomeSource)
async def create_income_source(input: IncomeSourceCreate):
    source = IncomeSource(**input.dict())
    await db.income_sources.insert_one(source.dict())
    return source

@api_router.get("/income-sources/{source_id}", response_model=IncomeSource)
async def get_income_source(source_id: str):
    source = await db.income_sources.find_one({"id": source_id})
    if not source:
        raise HTTPException(status_code=404, detail="Income source not found")
    return IncomeSource(**source)

@api_router.put("/income-sources/{source_id}", response_model=IncomeSource)
async def update_income_source(source_id: str, input: IncomeSourceUpdate):
    update_data = {k: v for k, v in input.dict().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")
    
    result = await db.income_sources.update_one({"id": source_id}, {"$set": update_data})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Income source not found")
    
    source = await db.income_sources.find_one({"id": source_id})
    return IncomeSource(**source)

@api_router.delete("/income-sources/{source_id}")
async def delete_income_source(source_id: str):
    result = await db.income_sources.delete_one({"id": source_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Income source not found")
    return {"message": "Income source deleted"}

# Investment Types
@api_router.get("/investment-types", response_model=List[InvestmentType])
async def get_investment_types():
    types = await db.investment_types.find().to_list(100)
    return [InvestmentType(**t) for t in types]

@api_router.post("/investment-types", response_model=InvestmentType)
async def create_investment_type(input: InvestmentTypeCreate):
    inv_type = InvestmentType(**input.dict(), is_default=False)
    await db.investment_types.insert_one(inv_type.dict())
    return inv_type

@api_router.delete("/investment-types/{type_id}")
async def delete_investment_type(type_id: str):
    result = await db.investment_types.delete_one({"id": type_id, "is_default": False})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Investment type not found or cannot delete default type")
    return {"message": "Investment type deleted"}

# Investments
@api_router.get("/investments", response_model=List[Investment])
async def get_investments():
    investments = await db.investments.find().to_list(1000)
    return [Investment(**inv) for inv in investments]

@api_router.post("/investments", response_model=Investment)
async def create_investment(input: InvestmentCreate):
    investment = Investment(**input.dict())
    await db.investments.insert_one(investment.dict())
    return investment

@api_router.get("/investments/{investment_id}", response_model=Investment)
async def get_investment(investment_id: str):
    investment = await db.investments.find_one({"id": investment_id})
    if not investment:
        raise HTTPException(status_code=404, detail="Investment not found")
    return Investment(**investment)

@api_router.put("/investments/{investment_id}", response_model=Investment)
async def update_investment(investment_id: str, input: InvestmentUpdate):
    update_data = {k: v for k, v in input.dict().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")
    
    result = await db.investments.update_one({"id": investment_id}, {"$set": update_data})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Investment not found")
    
    investment = await db.investments.find_one({"id": investment_id})
    return Investment(**investment)

@api_router.delete("/investments/{investment_id}")
async def delete_investment(investment_id: str):
    result = await db.investments.delete_one({"id": investment_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Investment not found")
    return {"message": "Investment deleted"}

# Settings
@api_router.get("/settings", response_model=Settings)
async def get_settings():
    settings = await db.settings.find_one({"id": "app_settings"})
    if not settings:
        # Create default settings
        default_settings = Settings()
        await db.settings.insert_one(default_settings.dict())
        return default_settings
    return Settings(**settings)

@api_router.put("/settings", response_model=Settings)
async def update_settings(input: SettingsUpdate):
    update_data = {k: v for k, v in input.dict().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")
    
    await db.settings.update_one({"id": "app_settings"}, {"$set": update_data}, upsert=True)
    settings = await db.settings.find_one({"id": "app_settings"})
    return Settings(**settings)

# Projections
@api_router.get("/projections")
async def get_projections(years: int = 5, currency: Currency = Currency.USD):
    """Calculate multi-year budget projections"""
    current_year = datetime.now().year
    
    # Get all data
    expenses = await db.expenses.find({"currency": currency}).to_list(1000)
    income_sources = await db.income_sources.find({"currency": currency, "is_active": True}).to_list(1000)
    investments = await db.investments.find({"currency": currency, "is_active": True}).to_list(1000)
    
    projections = []
    
    for year_offset in range(years):
        year = current_year + year_offset
        
        # Calculate expenses for this year
        total_expenses_credit = 0.0
        total_expenses_debit = 0.0
        expense_breakdown = []
        
        for exp in expenses:
            exp_obj = Expense(**exp)
            if exp_obj.start_year <= year:
                years_since_start = year - exp_obj.start_year
                # Apply appreciation
                if exp_obj.is_recurring:
                    amount = exp_obj.amount * ((1 + exp_obj.appreciation_rate / 100) ** years_since_start)
                    if exp_obj.transaction_type == TransactionType.CREDIT:
                        total_expenses_credit += amount
                    else:
                        total_expenses_debit += amount
                    expense_breakdown.append({
                        "name": exp_obj.name,
                        "category": exp_obj.category_name,
                        "amount": round(amount, 2),
                        "type": exp_obj.transaction_type
                    })
        
        # Calculate income for this year
        total_income = 0.0
        income_breakdown = []
        
        for source in income_sources:
            source_obj = IncomeSource(**source)
            if source_obj.start_year <= year:
                years_since_start = year - source_obj.start_year
                # Apply increment
                if source_obj.increment_type == IncrementType.PERCENTAGE:
                    amount = source_obj.amount * ((1 + source_obj.increment_rate / 100) ** years_since_start)
                else:
                    amount = source_obj.amount + (source_obj.increment_rate * years_since_start)
                total_income += amount
                income_breakdown.append({
                    "name": source_obj.name,
                    "amount": round(amount, 2)
                })
        
        # Calculate investments for this year
        total_investments = 0.0
        investment_breakdown = []
        
        for inv in investments:
            inv_obj = Investment(**inv)
            if inv_obj.start_year <= year:
                years_since_start = year - inv_obj.start_year
                # Calculate compound interest
                amount = inv_obj.principal * ((1 + inv_obj.interest_rate / 100) ** years_since_start)
                total_investments += amount
                investment_breakdown.append({
                    "name": inv_obj.name,
                    "type": inv_obj.type_name,
                    "principal": inv_obj.principal,
                    "current_value": round(amount, 2),
                    "growth": round(amount - inv_obj.principal, 2)
                })
        
        net_expenses = total_expenses_debit - total_expenses_credit
        net_savings = total_income - net_expenses
        
        projections.append({
            "year": year,
            "total_income": round(total_income, 2),
            "total_expenses_credit": round(total_expenses_credit, 2),
            "total_expenses_debit": round(total_expenses_debit, 2),
            "net_expenses": round(net_expenses, 2),
            "total_investments": round(total_investments, 2),
            "net_savings": round(net_savings, 2),
            "expense_breakdown": expense_breakdown,
            "income_breakdown": income_breakdown,
            "investment_breakdown": investment_breakdown
        })
    
    return {
        "currency": currency,
        "years": years,
        "projections": projections
    }

# Dashboard summary
@api_router.get("/dashboard")
async def get_dashboard(currency: Currency = Currency.USD):
    """Get dashboard summary for current year"""
    current_year = datetime.now().year
    
    # Get counts
    expense_count = await db.expenses.count_documents({"currency": currency})
    income_count = await db.income_sources.count_documents({"currency": currency, "is_active": True})
    investment_count = await db.investments.count_documents({"currency": currency, "is_active": True})
    
    # Get current year totals
    expenses = await db.expenses.find({"currency": currency}).to_list(1000)
    income_sources = await db.income_sources.find({"currency": currency, "is_active": True}).to_list(1000)
    investments = await db.investments.find({"currency": currency, "is_active": True}).to_list(1000)
    
    total_expenses_debit = 0.0
    total_expenses_credit = 0.0
    expenses_by_category = {}
    
    for exp in expenses:
        exp_obj = Expense(**exp)
        if exp_obj.start_year <= current_year:
            years_since_start = current_year - exp_obj.start_year
            amount = exp_obj.amount * ((1 + exp_obj.appreciation_rate / 100) ** years_since_start)
            
            if exp_obj.transaction_type == TransactionType.DEBIT:
                total_expenses_debit += amount
            else:
                total_expenses_credit += amount
            
            if exp_obj.category_name not in expenses_by_category:
                expenses_by_category[exp_obj.category_name] = 0
            expenses_by_category[exp_obj.category_name] += amount
    
    total_income = 0.0
    for source in income_sources:
        source_obj = IncomeSource(**source)
        if source_obj.start_year <= current_year:
            years_since_start = current_year - source_obj.start_year
            if source_obj.increment_type == IncrementType.PERCENTAGE:
                amount = source_obj.amount * ((1 + source_obj.increment_rate / 100) ** years_since_start)
            else:
                amount = source_obj.amount + (source_obj.increment_rate * years_since_start)
            total_income += amount
    
    total_investments = 0.0
    for inv in investments:
        inv_obj = Investment(**inv)
        if inv_obj.start_year <= current_year:
            years_since_start = current_year - inv_obj.start_year
            amount = inv_obj.principal * ((1 + inv_obj.interest_rate / 100) ** years_since_start)
            total_investments += amount
    
    net_expenses = total_expenses_debit - total_expenses_credit
    net_savings = total_income - net_expenses
    
    return {
        "current_year": current_year,
        "currency": currency,
        "counts": {
            "expenses": expense_count,
            "income_sources": income_count,
            "investments": investment_count
        },
        "totals": {
            "income": round(total_income, 2),
            "expenses_debit": round(total_expenses_debit, 2),
            "expenses_credit": round(total_expenses_credit, 2),
            "net_expenses": round(net_expenses, 2),
            "investments": round(total_investments, 2),
            "net_savings": round(net_savings, 2)
        },
        "expenses_by_category": {k: round(v, 2) for k, v in expenses_by_category.items()}
    }

# Helper function for auto-categorization
async def categorize_transaction(description: str) -> tuple:
    """Auto-categorize a transaction based on description keywords"""
    description_lower = description.lower()
    
    # Get categories from database
    categories = await db.expense_categories.find().to_list(100)
    category_map = {cat["name"]: cat for cat in categories}
    
    best_match = None
    best_confidence = 0.0
    
    for category_name, keywords in CATEGORY_KEYWORDS.items():
        if category_name not in category_map:
            continue
            
        for keyword in keywords:
            if keyword.lower() in description_lower:
                # Calculate confidence based on keyword match
                confidence = len(keyword) / len(description_lower) * 100
                confidence = min(confidence * 2, 95)  # Cap at 95%
                
                if confidence > best_confidence:
                    best_confidence = confidence
                    best_match = category_map[category_name]
    
    # Default to "Other" if no match found
    if not best_match:
        best_match = category_map.get("Other", categories[0] if categories else None)
        best_confidence = 10.0
    
    return best_match, best_confidence

# Transaction Upload Endpoints
@api_router.post("/transactions/upload")
async def upload_bank_statement(file: UploadFile = File(...)):
    """Upload and parse a bank statement (CSV or Excel)"""
    
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file provided")
    
    # Check file extension
    file_ext = file.filename.lower().split('.')[-1]
    if file_ext not in ['csv', 'xlsx', 'xls']:
        raise HTTPException(status_code=400, detail="Only CSV and Excel files are supported")
    
    try:
        contents = await file.read()
        
        # Parse file based on extension
        if file_ext == 'csv':
            df = pd.read_csv(io.BytesIO(contents))
        else:
            df = pd.read_excel(io.BytesIO(contents))
        
        # Normalize column names (lowercase and strip whitespace)
        df.columns = df.columns.str.lower().str.strip()
        
        # Try to identify columns
        date_col = None
        desc_col = None
        amount_col = None
        type_col = None
        
        # Common column name variations
        date_variations = ['date', 'transaction date', 'trans date', 'posting date', 'value date']
        desc_variations = ['description', 'desc', 'narrative', 'particulars', 'details', 'memo', 'transaction description']
        amount_variations = ['amount', 'value', 'sum', 'transaction amount', 'debit/credit']
        type_variations = ['type', 'transaction type', 'trans type', 'dr/cr', 'debit/credit']
        
        for col in df.columns:
            col_lower = col.lower()
            if not date_col and any(v in col_lower for v in date_variations):
                date_col = col
            if not desc_col and any(v in col_lower for v in desc_variations):
                desc_col = col
            if not amount_col and any(v in col_lower for v in amount_variations):
                amount_col = col
            if not type_col and any(v in col_lower for v in type_variations):
                type_col = col
        
        # Check if we have required columns
        if not date_col:
            # Try first column as date
            date_col = df.columns[0] if len(df.columns) > 0 else None
        if not desc_col:
            # Try second column as description
            desc_col = df.columns[1] if len(df.columns) > 1 else None
        if not amount_col:
            # Try third column as amount
            amount_col = df.columns[2] if len(df.columns) > 2 else None
        
        if not all([date_col, desc_col, amount_col]):
            raise HTTPException(
                status_code=400, 
                detail=f"Could not identify required columns. Found: {list(df.columns)}. Expected: date, description, amount"
            )
        
        # Parse transactions
        parsed_transactions = []
        
        for idx, row in df.iterrows():
            try:
                # Get date
                date_val = str(row[date_col])
                
                # Get description
                description = str(row[desc_col]) if pd.notna(row[desc_col]) else "Unknown"
                
                # Get amount and determine transaction type
                amount_raw = row[amount_col]
                if pd.isna(amount_raw):
                    continue
                    
                # Clean amount string
                amount_str = str(amount_raw).replace(',', '').replace('$', '').replace('₹', '').strip()
                
                # Handle parentheses as negative
                if '(' in amount_str and ')' in amount_str:
                    amount_str = amount_str.replace('(', '-').replace(')', '')
                
                try:
                    amount = float(amount_str)
                except ValueError:
                    continue
                
                # Determine transaction type
                if type_col and pd.notna(row.get(type_col)):
                    type_val = str(row[type_col]).lower()
                    if any(t in type_val for t in ['credit', 'cr', 'deposit', 'income']):
                        trans_type = TransactionType.CREDIT
                    else:
                        trans_type = TransactionType.DEBIT
                else:
                    # Infer from amount sign
                    trans_type = TransactionType.CREDIT if amount > 0 else TransactionType.DEBIT
                
                amount = abs(amount)
                
                # Auto-categorize
                category, confidence = await categorize_transaction(description)
                
                parsed_transactions.append({
                    "id": str(uuid.uuid4()),
                    "date": date_val,
                    "description": description,
                    "amount": round(amount, 2),
                    "transaction_type": trans_type,
                    "suggested_category_id": category["id"] if category else "",
                    "suggested_category_name": category["name"] if category else "Other",
                    "confidence": round(confidence, 1),
                    "selected": True
                })
                
            except Exception as e:
                logger.warning(f"Error parsing row {idx}: {e}")
                continue
        
        if not parsed_transactions:
            raise HTTPException(status_code=400, detail="No valid transactions found in file")
        
        return {
            "message": f"Successfully parsed {len(parsed_transactions)} transactions",
            "transactions": parsed_transactions,
            "columns_detected": {
                "date": date_col,
                "description": desc_col,
                "amount": amount_col,
                "type": type_col
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error processing file: {e}")
        raise HTTPException(status_code=500, detail=f"Error processing file: {str(e)}")

@api_router.post("/transactions/import")
async def import_transactions(request: TransactionImportRequest):
    """Import parsed transactions as expenses or income"""
    
    imported_expenses = []
    imported_income = []
    
    for trans in request.transactions:
        if not trans.get("selected", True):
            continue
        
        trans_type = trans.get("transaction_type", "debit")
        if isinstance(trans_type, str):
            trans_type = TransactionType.CREDIT if trans_type.lower() == "credit" else TransactionType.DEBIT
        
        if trans_type == TransactionType.CREDIT and trans.get("amount", 0) > 1000:
            # Large credits might be income - create as income source
            income = IncomeSource(
                name=trans.get("description", "Imported Income")[:100],
                amount=trans.get("amount", 0),
                increment_rate=0,
                increment_type=IncrementType.PERCENTAGE,
                start_year=request.start_year,
                currency=request.currency,
                is_active=True
            )
            await db.income_sources.insert_one(income.dict())
            imported_income.append(income.dict())
        else:
            # Create as expense
            expense = Expense(
                name=trans.get("description", "Imported Transaction")[:100],
                category_id=trans.get("category_id", trans.get("suggested_category_id", "")),
                category_name=trans.get("category_name", trans.get("suggested_category_name", "Other")),
                amount=trans.get("amount", 0),
                transaction_type=trans_type,
                appreciation_rate=request.appreciation_rate,
                start_year=request.start_year,
                currency=request.currency,
                is_recurring=request.is_recurring
            )
            await db.expenses.insert_one(expense.dict())
            imported_expenses.append(expense.dict())
    
    return {
        "message": f"Successfully imported {len(imported_expenses)} expenses and {len(imported_income)} income sources",
        "expenses_count": len(imported_expenses),
        "income_count": len(imported_income),
        "expenses": imported_expenses,
        "income": imported_income
    }

@api_router.post("/transactions/import-direct")
async def import_transactions_direct(
    file: UploadFile = File(...),
    currency: Currency = Currency.USD,
    start_year: int = None,
    is_recurring: bool = False,
    appreciation_rate: float = 0.0
):
    """Upload and directly import transactions without preview"""
    
    if start_year is None:
        start_year = datetime.now().year
    
    # First parse the file
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file provided")
    
    file_ext = file.filename.lower().split('.')[-1]
    if file_ext not in ['csv', 'xlsx', 'xls']:
        raise HTTPException(status_code=400, detail="Only CSV and Excel files are supported")
    
    try:
        contents = await file.read()
        
        if file_ext == 'csv':
            df = pd.read_csv(io.BytesIO(contents))
        else:
            df = pd.read_excel(io.BytesIO(contents))
        
        df.columns = df.columns.str.lower().str.strip()
        
        # Find columns (simplified)
        date_col = next((c for c in df.columns if 'date' in c.lower()), df.columns[0] if len(df.columns) > 0 else None)
        desc_col = next((c for c in df.columns if any(d in c.lower() for d in ['desc', 'narr', 'part', 'memo'])), df.columns[1] if len(df.columns) > 1 else None)
        amount_col = next((c for c in df.columns if 'amount' in c.lower()), df.columns[2] if len(df.columns) > 2 else None)
        type_col = next((c for c in df.columns if 'type' in c.lower()), None)
        
        if not all([date_col, desc_col, amount_col]):
            raise HTTPException(status_code=400, detail="Could not identify required columns")
        
        imported_count = 0
        
        for idx, row in df.iterrows():
            try:
                description = str(row[desc_col]) if pd.notna(row[desc_col]) else "Unknown"
                amount_raw = row[amount_col]
                
                if pd.isna(amount_raw):
                    continue
                
                amount_str = str(amount_raw).replace(',', '').replace('$', '').replace('₹', '').strip()
                if '(' in amount_str:
                    amount_str = amount_str.replace('(', '-').replace(')', '')
                
                amount = float(amount_str)
                
                # Determine type
                if type_col and pd.notna(row.get(type_col)):
                    type_val = str(row[type_col]).lower()
                    trans_type = TransactionType.CREDIT if any(t in type_val for t in ['credit', 'cr', 'deposit']) else TransactionType.DEBIT
                else:
                    trans_type = TransactionType.CREDIT if amount > 0 else TransactionType.DEBIT
                
                amount = abs(amount)
                
                # Categorize
                category, _ = await categorize_transaction(description)
                
                # Create expense
                expense = Expense(
                    name=description[:100],
                    category_id=category["id"] if category else "",
                    category_name=category["name"] if category else "Other",
                    amount=amount,
                    transaction_type=trans_type,
                    appreciation_rate=appreciation_rate,
                    start_year=start_year,
                    currency=currency,
                    is_recurring=is_recurring
                )
                await db.expenses.insert_one(expense.dict())
                imported_count += 1
                
            except Exception as e:
                logger.warning(f"Error importing row {idx}: {e}")
                continue
        
        return {
            "message": f"Successfully imported {imported_count} transactions",
            "count": imported_count
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error processing file: {str(e)}")

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
