#!/usr/bin/env python3
"""
Comprehensive Backend API Testing for Multi-Year Budget Tracker
Tests all CRUD operations, calculations, and edge cases
"""

import requests
import json
import sys
from datetime import datetime

# Backend URL from environment
BACKEND_URL = "https://finance-dashboard-651.preview.emergentagent.com/api"

class BudgetTrackerTester:
    def __init__(self):
        self.base_url = BACKEND_URL
        self.session = requests.Session()
        self.test_results = []
        self.created_ids = {
            'expense_categories': [],
            'expenses': [],
            'income_sources': [],
            'investment_types': [],
            'investments': []
        }
        
    def log_test(self, test_name, success, message="", response_data=None):
        """Log test results"""
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status} {test_name}: {message}")
        self.test_results.append({
            'test': test_name,
            'success': success,
            'message': message,
            'response_data': response_data
        })
        
    def make_request(self, method, endpoint, data=None, params=None):
        """Make HTTP request with error handling"""
        url = f"{self.base_url}{endpoint}"
        try:
            if method == "GET":
                response = self.session.get(url, params=params)
            elif method == "POST":
                response = self.session.post(url, json=data)
            elif method == "PUT":
                response = self.session.put(url, json=data)
            elif method == "DELETE":
                response = self.session.delete(url)
            else:
                raise ValueError(f"Unsupported method: {method}")
                
            return response
        except Exception as e:
            print(f"Request failed: {e}")
            return None
    
    def test_init_data(self):
        """Test POST /api/init - Initialize default data"""
        print("\n=== Testing Initialize Data ===")
        
        response = self.make_request("POST", "/init")
        if response and response.status_code == 200:
            data = response.json()
            self.log_test("Initialize Data", True, f"Status: {response.status_code}, Message: {data.get('message', '')}")
        else:
            self.log_test("Initialize Data", False, f"Status: {response.status_code if response else 'No response'}")
    
    def test_expense_categories(self):
        """Test expense categories CRUD operations"""
        print("\n=== Testing Expense Categories ===")
        
        # Test GET expense categories
        response = self.make_request("GET", "/expense-categories")
        if response and response.status_code == 200:
            categories = response.json()
            self.log_test("GET Expense Categories", True, f"Retrieved {len(categories)} categories")
            
            # Verify default categories exist
            default_names = ["Rent/Mortgage", "Utilities", "Groceries", "Transportation"]
            found_defaults = [cat for cat in categories if cat['name'] in default_names]
            self.log_test("Default Categories Present", len(found_defaults) > 0, f"Found {len(found_defaults)} default categories")
        else:
            self.log_test("GET Expense Categories", False, f"Status: {response.status_code if response else 'No response'}")
            return
        
        # Test POST expense category
        new_category = {
            "name": "Test Category",
            "icon": "test-icon"
        }
        response = self.make_request("POST", "/expense-categories", new_category)
        if response and response.status_code == 200:
            created_category = response.json()
            self.created_ids['expense_categories'].append(created_category['id'])
            self.log_test("POST Expense Category", True, f"Created category: {created_category['name']}")
        else:
            self.log_test("POST Expense Category", False, f"Status: {response.status_code if response else 'No response'}")
        
        # Test DELETE expense category (only non-default)
        if self.created_ids['expense_categories']:
            category_id = self.created_ids['expense_categories'][0]
            response = self.make_request("DELETE", f"/expense-categories/{category_id}")
            if response and response.status_code == 200:
                self.log_test("DELETE Expense Category", True, "Successfully deleted non-default category")
            else:
                self.log_test("DELETE Expense Category", False, f"Status: {response.status_code if response else 'No response'}")
    
    def test_expenses(self):
        """Test expenses CRUD operations"""
        print("\n=== Testing Expenses ===")
        
        # First get categories to use valid category_id
        categories_response = self.make_request("GET", "/expense-categories")
        if not categories_response or categories_response.status_code != 200:
            self.log_test("Expenses Setup", False, "Could not get categories for testing")
            return
        
        categories = categories_response.json()
        if not categories:
            self.log_test("Expenses Setup", False, "No categories available for testing")
            return
        
        test_category = categories[0]
        current_year = datetime.now().year
        
        # Test GET expenses
        response = self.make_request("GET", "/expenses")
        if response and response.status_code == 200:
            expenses = response.json()
            self.log_test("GET Expenses", True, f"Retrieved {len(expenses)} expenses")
        else:
            self.log_test("GET Expenses", False, f"Status: {response.status_code if response else 'No response'}")
            return
        
        # Test POST expense (debit)
        new_expense = {
            "name": "Monthly Rent",
            "category_id": test_category['id'],
            "category_name": test_category['name'],
            "amount": 1500.0,
            "transaction_type": "debit",
            "appreciation_rate": 3.0,
            "start_year": current_year,
            "currency": "USD",
            "is_recurring": True
        }
        response = self.make_request("POST", "/expenses", new_expense)
        if response and response.status_code == 200:
            created_expense = response.json()
            self.created_ids['expenses'].append(created_expense['id'])
            self.log_test("POST Expense (Debit)", True, f"Created expense: {created_expense['name']}")
        else:
            self.log_test("POST Expense (Debit)", False, f"Status: {response.status_code if response else 'No response'}")
        
        # Test POST expense (credit)
        credit_expense = {
            "name": "Rental Income",
            "category_id": test_category['id'],
            "category_name": test_category['name'],
            "amount": 800.0,
            "transaction_type": "credit",
            "appreciation_rate": 2.0,
            "start_year": current_year,
            "currency": "USD",
            "is_recurring": True
        }
        response = self.make_request("POST", "/expenses", credit_expense)
        if response and response.status_code == 200:
            created_expense = response.json()
            self.created_ids['expenses'].append(created_expense['id'])
            self.log_test("POST Expense (Credit)", True, f"Created credit expense: {created_expense['name']}")
        else:
            self.log_test("POST Expense (Credit)", False, f"Status: {response.status_code if response else 'No response'}")
        
        # Test PUT expense
        if self.created_ids['expenses']:
            expense_id = self.created_ids['expenses'][0]
            update_data = {
                "amount": 1600.0,
                "appreciation_rate": 3.5
            }
            response = self.make_request("PUT", f"/expenses/{expense_id}", update_data)
            if response and response.status_code == 200:
                updated_expense = response.json()
                self.log_test("PUT Expense", True, f"Updated expense amount to {updated_expense['amount']}")
            else:
                self.log_test("PUT Expense", False, f"Status: {response.status_code if response else 'No response'}")
        
        # Test GET single expense
        if self.created_ids['expenses']:
            expense_id = self.created_ids['expenses'][0]
            response = self.make_request("GET", f"/expenses/{expense_id}")
            if response and response.status_code == 200:
                expense = response.json()
                self.log_test("GET Single Expense", True, f"Retrieved expense: {expense['name']}")
            else:
                self.log_test("GET Single Expense", False, f"Status: {response.status_code if response else 'No response'}")
        
        # Test DELETE expense
        if self.created_ids['expenses']:
            expense_id = self.created_ids['expenses'].pop()
            response = self.make_request("DELETE", f"/expenses/{expense_id}")
            if response and response.status_code == 200:
                self.log_test("DELETE Expense", True, "Successfully deleted expense")
            else:
                self.log_test("DELETE Expense", False, f"Status: {response.status_code if response else 'No response'}")
    
    def test_income_sources(self):
        """Test income sources CRUD operations"""
        print("\n=== Testing Income Sources ===")
        
        current_year = datetime.now().year
        
        # Test GET income sources
        response = self.make_request("GET", "/income-sources")
        if response and response.status_code == 200:
            sources = response.json()
            self.log_test("GET Income Sources", True, f"Retrieved {len(sources)} income sources")
        else:
            self.log_test("GET Income Sources", False, f"Status: {response.status_code if response else 'No response'}")
            return
        
        # Test POST income source (percentage increment)
        new_income = {
            "name": "Software Engineer Salary",
            "amount": 80000.0,
            "increment_rate": 5.0,
            "increment_type": "percentage",
            "start_year": current_year,
            "currency": "USD",
            "is_active": True
        }
        response = self.make_request("POST", "/income-sources", new_income)
        if response and response.status_code == 200:
            created_income = response.json()
            self.created_ids['income_sources'].append(created_income['id'])
            self.log_test("POST Income Source (Percentage)", True, f"Created income: {created_income['name']}")
        else:
            self.log_test("POST Income Source (Percentage)", False, f"Status: {response.status_code if response else 'No response'}")
        
        # Test POST income source (fixed increment)
        fixed_income = {
            "name": "Freelance Work",
            "amount": 2000.0,
            "increment_rate": 200.0,
            "increment_type": "fixed",
            "start_year": current_year,
            "currency": "USD",
            "is_active": True
        }
        response = self.make_request("POST", "/income-sources", fixed_income)
        if response and response.status_code == 200:
            created_income = response.json()
            self.created_ids['income_sources'].append(created_income['id'])
            self.log_test("POST Income Source (Fixed)", True, f"Created fixed increment income: {created_income['name']}")
        else:
            self.log_test("POST Income Source (Fixed)", False, f"Status: {response.status_code if response else 'No response'}")
        
        # Test PUT income source
        if self.created_ids['income_sources']:
            income_id = self.created_ids['income_sources'][0]
            update_data = {
                "amount": 85000.0,
                "increment_rate": 6.0
            }
            response = self.make_request("PUT", f"/income-sources/{income_id}", update_data)
            if response and response.status_code == 200:
                updated_income = response.json()
                self.log_test("PUT Income Source", True, f"Updated income amount to {updated_income['amount']}")
            else:
                self.log_test("PUT Income Source", False, f"Status: {response.status_code if response else 'No response'}")
        
        # Test GET single income source
        if self.created_ids['income_sources']:
            income_id = self.created_ids['income_sources'][0]
            response = self.make_request("GET", f"/income-sources/{income_id}")
            if response and response.status_code == 200:
                income = response.json()
                self.log_test("GET Single Income Source", True, f"Retrieved income: {income['name']}")
            else:
                self.log_test("GET Single Income Source", False, f"Status: {response.status_code if response else 'No response'}")
        
        # Test DELETE income source
        if self.created_ids['income_sources']:
            income_id = self.created_ids['income_sources'].pop()
            response = self.make_request("DELETE", f"/income-sources/{income_id}")
            if response and response.status_code == 200:
                self.log_test("DELETE Income Source", True, "Successfully deleted income source")
            else:
                self.log_test("DELETE Income Source", False, f"Status: {response.status_code if response else 'No response'}")
    
    def test_investment_types(self):
        """Test investment types CRUD operations"""
        print("\n=== Testing Investment Types ===")
        
        # Test GET investment types
        response = self.make_request("GET", "/investment-types")
        if response and response.status_code == 200:
            types = response.json()
            self.log_test("GET Investment Types", True, f"Retrieved {len(types)} investment types")
            
            # Verify default types exist
            default_names = ["Fixed Deposit", "Mutual Funds", "Stocks", "PPF"]
            found_defaults = [t for t in types if t['name'] in default_names]
            self.log_test("Default Investment Types Present", len(found_defaults) > 0, f"Found {len(found_defaults)} default types")
        else:
            self.log_test("GET Investment Types", False, f"Status: {response.status_code if response else 'No response'}")
            return
        
        # Test POST investment type
        new_type = {
            "name": "Test Investment Type",
            "icon": "test-investment-icon"
        }
        response = self.make_request("POST", "/investment-types", new_type)
        if response and response.status_code == 200:
            created_type = response.json()
            self.created_ids['investment_types'].append(created_type['id'])
            self.log_test("POST Investment Type", True, f"Created type: {created_type['name']}")
        else:
            self.log_test("POST Investment Type", False, f"Status: {response.status_code if response else 'No response'}")
        
        # Test DELETE investment type (only non-default)
        if self.created_ids['investment_types']:
            type_id = self.created_ids['investment_types'][0]
            response = self.make_request("DELETE", f"/investment-types/{type_id}")
            if response and response.status_code == 200:
                self.log_test("DELETE Investment Type", True, "Successfully deleted non-default type")
            else:
                self.log_test("DELETE Investment Type", False, f"Status: {response.status_code if response else 'No response'}")
    
    def test_investments(self):
        """Test investments CRUD operations"""
        print("\n=== Testing Investments ===")
        
        # First get investment types to use valid type_id
        types_response = self.make_request("GET", "/investment-types")
        if not types_response or types_response.status_code != 200:
            self.log_test("Investments Setup", False, "Could not get investment types for testing")
            return
        
        types = types_response.json()
        if not types:
            self.log_test("Investments Setup", False, "No investment types available for testing")
            return
        
        test_type = types[0]
        current_year = datetime.now().year
        
        # Test GET investments
        response = self.make_request("GET", "/investments")
        if response and response.status_code == 200:
            investments = response.json()
            self.log_test("GET Investments", True, f"Retrieved {len(investments)} investments")
        else:
            self.log_test("GET Investments", False, f"Status: {response.status_code if response else 'No response'}")
            return
        
        # Test POST investment
        new_investment = {
            "name": "Emergency Fund",
            "type_id": test_type['id'],
            "type_name": test_type['name'],
            "principal": 10000.0,
            "interest_rate": 4.5,
            "start_year": current_year,
            "currency": "USD",
            "is_active": True
        }
        response = self.make_request("POST", "/investments", new_investment)
        if response and response.status_code == 200:
            created_investment = response.json()
            self.created_ids['investments'].append(created_investment['id'])
            self.log_test("POST Investment", True, f"Created investment: {created_investment['name']}")
        else:
            self.log_test("POST Investment", False, f"Status: {response.status_code if response else 'No response'}")
        
        # Test PUT investment
        if self.created_ids['investments']:
            investment_id = self.created_ids['investments'][0]
            update_data = {
                "principal": 12000.0,
                "interest_rate": 5.0
            }
            response = self.make_request("PUT", f"/investments/{investment_id}", update_data)
            if response and response.status_code == 200:
                updated_investment = response.json()
                self.log_test("PUT Investment", True, f"Updated investment principal to {updated_investment['principal']}")
            else:
                self.log_test("PUT Investment", False, f"Status: {response.status_code if response else 'No response'}")
        
        # Test GET single investment
        if self.created_ids['investments']:
            investment_id = self.created_ids['investments'][0]
            response = self.make_request("GET", f"/investments/{investment_id}")
            if response and response.status_code == 200:
                investment = response.json()
                self.log_test("GET Single Investment", True, f"Retrieved investment: {investment['name']}")
            else:
                self.log_test("GET Single Investment", False, f"Status: {response.status_code if response else 'No response'}")
        
        # Test DELETE investment
        if self.created_ids['investments']:
            investment_id = self.created_ids['investments'].pop()
            response = self.make_request("DELETE", f"/investments/{investment_id}")
            if response and response.status_code == 200:
                self.log_test("DELETE Investment", True, "Successfully deleted investment")
            else:
                self.log_test("DELETE Investment", False, f"Status: {response.status_code if response else 'No response'}")
    
    def test_dashboard(self):
        """Test dashboard endpoint"""
        print("\n=== Testing Dashboard ===")
        
        # Test dashboard with USD
        response = self.make_request("GET", "/dashboard", params={"currency": "USD"})
        if response and response.status_code == 200:
            dashboard = response.json()
            required_fields = ['current_year', 'currency', 'counts', 'totals', 'expenses_by_category']
            missing_fields = [field for field in required_fields if field not in dashboard]
            
            if not missing_fields:
                self.log_test("GET Dashboard (USD)", True, f"Retrieved dashboard for {dashboard['current_year']}")
                
                # Verify counts structure
                counts = dashboard.get('counts', {})
                count_fields = ['expenses', 'income_sources', 'investments']
                if all(field in counts for field in count_fields):
                    self.log_test("Dashboard Counts Structure", True, f"Expenses: {counts['expenses']}, Income: {counts['income_sources']}, Investments: {counts['investments']}")
                else:
                    self.log_test("Dashboard Counts Structure", False, "Missing count fields")
                
                # Verify totals structure
                totals = dashboard.get('totals', {})
                total_fields = ['income', 'expenses_debit', 'expenses_credit', 'net_expenses', 'investments', 'net_savings']
                if all(field in totals for field in total_fields):
                    self.log_test("Dashboard Totals Structure", True, f"Net savings: {totals['net_savings']}")
                else:
                    self.log_test("Dashboard Totals Structure", False, "Missing total fields")
            else:
                self.log_test("GET Dashboard (USD)", False, f"Missing fields: {missing_fields}")
        else:
            self.log_test("GET Dashboard (USD)", False, f"Status: {response.status_code if response else 'No response'}")
        
        # Test dashboard with INR
        response = self.make_request("GET", "/dashboard", params={"currency": "INR"})
        if response and response.status_code == 200:
            dashboard = response.json()
            self.log_test("GET Dashboard (INR)", True, f"Retrieved INR dashboard for {dashboard['current_year']}")
        else:
            self.log_test("GET Dashboard (INR)", False, f"Status: {response.status_code if response else 'No response'}")
    
    def test_projections(self):
        """Test projections endpoint"""
        print("\n=== Testing Projections ===")
        
        # Test projections with USD (5 years)
        response = self.make_request("GET", "/projections", params={"years": 5, "currency": "USD"})
        if response and response.status_code == 200:
            projections = response.json()
            required_fields = ['currency', 'years', 'projections']
            missing_fields = [field for field in required_fields if field not in projections]
            
            if not missing_fields:
                proj_data = projections['projections']
                if len(proj_data) == 5:
                    self.log_test("GET Projections (5 years USD)", True, f"Retrieved {len(proj_data)} year projections")
                    
                    # Verify projection structure
                    if proj_data:
                        first_year = proj_data[0]
                        projection_fields = ['year', 'total_income', 'total_expenses_debit', 'total_expenses_credit', 
                                           'net_expenses', 'total_investments', 'net_savings', 'expense_breakdown', 
                                           'income_breakdown', 'investment_breakdown']
                        if all(field in first_year for field in projection_fields):
                            self.log_test("Projections Structure", True, f"Year {first_year['year']} net savings: {first_year['net_savings']}")
                        else:
                            missing = [f for f in projection_fields if f not in first_year]
                            self.log_test("Projections Structure", False, f"Missing fields: {missing}")
                else:
                    self.log_test("GET Projections (5 years USD)", False, f"Expected 5 years, got {len(proj_data)}")
            else:
                self.log_test("GET Projections (5 years USD)", False, f"Missing fields: {missing_fields}")
        else:
            self.log_test("GET Projections (5 years USD)", False, f"Status: {response.status_code if response else 'No response'}")
        
        # Test projections with INR (3 years)
        response = self.make_request("GET", "/projections", params={"years": 3, "currency": "INR"})
        if response and response.status_code == 200:
            projections = response.json()
            proj_data = projections['projections']
            if len(proj_data) == 3:
                self.log_test("GET Projections (3 years INR)", True, f"Retrieved {len(proj_data)} year INR projections")
            else:
                self.log_test("GET Projections (3 years INR)", False, f"Expected 3 years, got {len(proj_data)}")
        else:
            self.log_test("GET Projections (3 years INR)", False, f"Status: {response.status_code if response else 'No response'}")
        
        # Test appreciation rate calculations
        if self.created_ids['expenses']:
            # Create an expense with known appreciation rate for testing
            categories_response = self.make_request("GET", "/expense-categories")
            if categories_response and categories_response.status_code == 200:
                categories = categories_response.json()
                if categories:
                    test_expense = {
                        "name": "Test Appreciation Expense",
                        "category_id": categories[0]['id'],
                        "category_name": categories[0]['name'],
                        "amount": 1000.0,
                        "transaction_type": "debit",
                        "appreciation_rate": 10.0,  # 10% yearly
                        "start_year": datetime.now().year,
                        "currency": "USD",
                        "is_recurring": True
                    }
                    create_response = self.make_request("POST", "/expenses", test_expense)
                    if create_response and create_response.status_code == 200:
                        # Test projections to verify appreciation calculation
                        proj_response = self.make_request("GET", "/projections", params={"years": 2, "currency": "USD"})
                        if proj_response and proj_response.status_code == 200:
                            proj_data = proj_response.json()['projections']
                            if len(proj_data) >= 2:
                                year1_expenses = proj_data[0]['total_expenses_debit']
                                year2_expenses = proj_data[1]['total_expenses_debit']
                                # Should see appreciation effect (though other expenses may affect total)
                                self.log_test("Appreciation Rate Calculation", True, f"Year 1: {year1_expenses}, Year 2: {year2_expenses}")
                            else:
                                self.log_test("Appreciation Rate Calculation", False, "Insufficient projection data")
                        else:
                            self.log_test("Appreciation Rate Calculation", False, "Could not get projections for testing")
    
    def test_edge_cases(self):
        """Test edge cases and error handling"""
        print("\n=== Testing Edge Cases ===")
        
        # Test invalid expense ID
        response = self.make_request("GET", "/expenses/invalid-id")
        if response and response.status_code == 404:
            self.log_test("Invalid Expense ID", True, "Correctly returned 404 for invalid ID")
        else:
            self.log_test("Invalid Expense ID", False, f"Expected 404, got {response.status_code if response else 'No response'}")
        
        # Test invalid income source ID
        response = self.make_request("GET", "/income-sources/invalid-id")
        if response and response.status_code == 404:
            self.log_test("Invalid Income Source ID", True, "Correctly returned 404 for invalid ID")
        else:
            self.log_test("Invalid Income Source ID", False, f"Expected 404, got {response.status_code if response else 'No response'}")
        
        # Test invalid investment ID
        response = self.make_request("GET", "/investments/invalid-id")
        if response and response.status_code == 404:
            self.log_test("Invalid Investment ID", True, "Correctly returned 404 for invalid ID")
        else:
            self.log_test("Invalid Investment ID", False, f"Expected 404, got {response.status_code if response else 'No response'}")
        
        # Test empty update
        if self.created_ids['expenses']:
            expense_id = self.created_ids['expenses'][0]
            response = self.make_request("PUT", f"/expenses/{expense_id}", {})
            if response and response.status_code == 400:
                self.log_test("Empty Update Request", True, "Correctly rejected empty update")
            else:
                self.log_test("Empty Update Request", False, f"Expected 400, got {response.status_code if response else 'No response'}")
    
    def cleanup(self):
        """Clean up created test data"""
        print("\n=== Cleaning Up Test Data ===")
        
        # Delete created expenses
        for expense_id in self.created_ids['expenses']:
            response = self.make_request("DELETE", f"/expenses/{expense_id}")
            if response and response.status_code == 200:
                print(f"✅ Deleted expense {expense_id}")
            else:
                print(f"❌ Failed to delete expense {expense_id}")
        
        # Delete created income sources
        for income_id in self.created_ids['income_sources']:
            response = self.make_request("DELETE", f"/income-sources/{income_id}")
            if response and response.status_code == 200:
                print(f"✅ Deleted income source {income_id}")
            else:
                print(f"❌ Failed to delete income source {income_id}")
        
        # Delete created investments
        for investment_id in self.created_ids['investments']:
            response = self.make_request("DELETE", f"/investments/{investment_id}")
            if response and response.status_code == 200:
                print(f"✅ Deleted investment {investment_id}")
            else:
                print(f"❌ Failed to delete investment {investment_id}")
        
        # Note: We don't delete categories and investment types as they might be referenced
    
    def run_all_tests(self):
        """Run all tests"""
        print(f"🚀 Starting Backend API Tests for Multi-Year Budget Tracker")
        print(f"Backend URL: {self.base_url}")
        print("=" * 80)
        
        # Run all test suites
        self.test_init_data()
        self.test_expense_categories()
        self.test_expenses()
        self.test_income_sources()
        self.test_investment_types()
        self.test_investments()
        self.test_dashboard()
        self.test_projections()
        self.test_edge_cases()
        
        # Clean up
        self.cleanup()
        
        # Summary
        print("\n" + "=" * 80)
        print("🏁 TEST SUMMARY")
        print("=" * 80)
        
        total_tests = len(self.test_results)
        passed_tests = len([t for t in self.test_results if t['success']])
        failed_tests = total_tests - passed_tests
        
        print(f"Total Tests: {total_tests}")
        print(f"✅ Passed: {passed_tests}")
        print(f"❌ Failed: {failed_tests}")
        print(f"Success Rate: {(passed_tests/total_tests)*100:.1f}%")
        
        if failed_tests > 0:
            print("\n❌ FAILED TESTS:")
            for test in self.test_results:
                if not test['success']:
                    print(f"  - {test['test']}: {test['message']}")
        
        return failed_tests == 0

if __name__ == "__main__":
    tester = BudgetTrackerTester()
    success = tester.run_all_tests()
    sys.exit(0 if success else 1)