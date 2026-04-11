from fastapi import FastAPI, APIRouter, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional
import uuid
from datetime import datetime
from enum import Enum

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
