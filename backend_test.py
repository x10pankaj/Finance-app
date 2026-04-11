#!/usr/bin/env python3
"""
Backend API Testing for Multi-Year Budget Tracker
Focus: Transaction Upload and Import Endpoints
"""

import requests
import json
import os
import tempfile
import csv
from datetime import datetime

# Backend URL from frontend .env
BACKEND_URL = "https://finance-dashboard-651.preview.emergentagent.com/api"

class BudgetTrackerTester:
    def __init__(self):
        self.backend_url = BACKEND_URL
        self.test_results = []
        
    def log_test(self, test_name, success, details=""):
        """Log test results"""
        status = "✅ PASS" if success else "❌ FAIL"
        self.test_results.append({
            "test": test_name,
            "status": status,
            "details": details
        })
        print(f"{status}: {test_name}")
        if details:
            print(f"   Details: {details}")
    
    def create_test_csv(self):
        """Create test CSV file with various transaction types"""
        test_data = [
            ["Date", "Description", "Amount", "Type"],
            ["2025-01-15", "AMAZON MARKETPLACE", "125.99", "Debit"],
            ["2025-01-16", "UBER TRIP", "35.50", "Debit"],
            ["2025-01-17", "SALARY DEPOSIT", "5000.00", "Credit"],
            ["2025-01-18", "NETFLIX SUBSCRIPTION", "15.99", "Debit"],
            ["2025-01-19", "STARBUCKS COFFEE", "8.75", "Debit"],
            ["2025-01-20", "WALMART GROCERIES", "89.45", "Debit"],
            ["2025-01-21", "SHELL GAS STATION", "45.20", "Debit"],
            ["2025-01-22", "CVS PHARMACY", "25.30", "Debit"],
            ["2025-01-23", "FREELANCE PAYMENT", "1500.00", "Credit"],
            ["2025-01-24", "SPOTIFY PREMIUM", "9.99", "Debit"]
        ]
        
        # Create temporary CSV file
        temp_file = tempfile.NamedTemporaryFile(mode='w', suffix='.csv', delete=False)
        writer = csv.writer(temp_file)
        writer.writerows(test_data)
        temp_file.close()
        return temp_file.name
    
    def test_transaction_upload(self):
        """Test POST /api/transactions/upload endpoint"""
        print("\n=== Testing Transaction Upload Endpoint ===")
        
        # Create test CSV file
        csv_file_path = self.create_test_csv()
        
        try:
            # Test CSV upload
            with open(csv_file_path, 'rb') as f:
                files = {'file': ('test_transactions.csv', f, 'text/csv')}
                response = requests.post(f"{self.backend_url}/transactions/upload", files=files)
            
            if response.status_code == 200:
                data = response.json()
                transactions = data.get('transactions', [])
                
                # Verify response structure
                if 'message' in data and 'transactions' in data:
                    self.log_test("Transaction upload - Response structure", True, 
                                f"Parsed {len(transactions)} transactions")
                    
                    # Test auto-categorization
                    categorization_tests = [
                        ("AMAZON MARKETPLACE", "Shopping"),
                        ("UBER TRIP", "Transportation"),
                        ("STARBUCKS COFFEE", "Dining Out"),
                        ("NETFLIX SUBSCRIPTION", "Entertainment"),
                        ("WALMART GROCERIES", "Groceries"),
                        ("SHELL GAS STATION", "Transportation"),
                        ("CVS PHARMACY", "Healthcare")
                    ]
                    
                    correct_categorizations = 0
                    for description, expected_category in categorization_tests:
                        for trans in transactions:
                            if description in trans.get('description', ''):
                                suggested_category = trans.get('suggested_category_name', '')
                                if expected_category.lower() in suggested_category.lower():
                                    correct_categorizations += 1
                                break
                    
                    accuracy = (correct_categorizations / len(categorization_tests)) * 100
                    self.log_test("Auto-categorization accuracy", accuracy >= 70, 
                                f"{correct_categorizations}/{len(categorization_tests)} correct ({accuracy:.1f}%)")
                    
                    # Test transaction types
                    credit_count = sum(1 for t in transactions if t.get('transaction_type') == 'credit')
                    debit_count = sum(1 for t in transactions if t.get('transaction_type') == 'debit')
                    
                    self.log_test("Transaction type detection", credit_count >= 2 and debit_count >= 7,
                                f"Credits: {credit_count}, Debits: {debit_count}")
                    
                    # Test amount parsing
                    amounts_valid = all(isinstance(t.get('amount'), (int, float)) and t.get('amount') > 0 
                                      for t in transactions)
                    self.log_test("Amount parsing", amounts_valid, "All amounts are valid numbers")
                    
                else:
                    self.log_test("Transaction upload - Response structure", False, 
                                "Missing required fields in response")
            else:
                self.log_test("Transaction upload", False, 
                            f"HTTP {response.status_code}: {response.text}")
                
        except Exception as e:
            self.log_test("Transaction upload", False, f"Exception: {str(e)}")
        finally:
            # Clean up temp file
            try:
                os.unlink(csv_file_path)
            except:
                pass
    
    def test_transaction_import(self):
        """Test POST /api/transactions/import endpoint"""
        print("\n=== Testing Transaction Import Endpoint ===")
        
        # First, get some parsed transactions by uploading a file
        csv_file_path = self.create_test_csv()
        parsed_transactions = []
        
        try:
            with open(csv_file_path, 'rb') as f:
                files = {'file': ('test_transactions.csv', f, 'text/csv')}
                upload_response = requests.post(f"{self.backend_url}/transactions/upload", files=files)
            
            if upload_response.status_code == 200:
                parsed_transactions = upload_response.json().get('transactions', [])
            
            if not parsed_transactions:
                self.log_test("Transaction import - Prerequisites", False, 
                            "Could not get parsed transactions for import test")
                return
            
            # Test import with USD currency
            import_request = {
                "transactions": parsed_transactions,
                "currency": "USD",
                "start_year": 2025,
                "is_recurring": False,
                "appreciation_rate": 0
            }
            
            response = requests.post(f"{self.backend_url}/transactions/import", 
                                   json=import_request,
                                   headers={'Content-Type': 'application/json'})
            
            if response.status_code == 200:
                data = response.json()
                
                # Verify response structure
                required_fields = ['message', 'expenses_count', 'income_count', 'expenses', 'income']
                has_all_fields = all(field in data for field in required_fields)
                
                self.log_test("Transaction import - Response structure", has_all_fields,
                            f"Response contains all required fields")
                
                if has_all_fields:
                    expenses_count = data['expenses_count']
                    income_count = data['income_count']
                    
                    # Test that large credits (>$1000) are imported as income
                    large_credits = [t for t in parsed_transactions 
                                   if t.get('transaction_type') == 'credit' and t.get('amount', 0) > 1000]
                    
                    expected_income = len(large_credits)
                    self.log_test("Large credits as income sources", income_count >= expected_income,
                                f"Expected >= {expected_income} income sources, got {income_count}")
                    
                    # Test that other transactions are imported as expenses
                    other_transactions = [t for t in parsed_transactions 
                                        if not (t.get('transaction_type') == 'credit' and t.get('amount', 0) > 1000)]
                    
                    expected_expenses = len(other_transactions)
                    self.log_test("Other transactions as expenses", expenses_count >= expected_expenses - 1,
                                f"Expected ~{expected_expenses} expenses, got {expenses_count}")
                    
                    # Test total import count
                    total_imported = expenses_count + income_count
                    total_selected = sum(1 for t in parsed_transactions if t.get('selected', True))
                    
                    self.log_test("Total import count", total_imported == total_selected,
                                f"Imported {total_imported}/{total_selected} transactions")
            else:
                self.log_test("Transaction import", False, 
                            f"HTTP {response.status_code}: {response.text}")
            
            # Test import with INR currency
            import_request_inr = {
                "transactions": parsed_transactions[:3],  # Test with fewer transactions
                "currency": "INR",
                "start_year": 2025,
                "is_recurring": True,
                "appreciation_rate": 2.5
            }
            
            response_inr = requests.post(f"{self.backend_url}/transactions/import", 
                                       json=import_request_inr,
                                       headers={'Content-Type': 'application/json'})
            
            if response_inr.status_code == 200:
                self.log_test("Transaction import - INR currency", True, 
                            "Successfully imported transactions with INR currency")
            else:
                self.log_test("Transaction import - INR currency", False, 
                            f"HTTP {response_inr.status_code}: {response_inr.text}")
                
        except Exception as e:
            self.log_test("Transaction import", False, f"Exception: {str(e)}")
        finally:
            # Clean up temp file
            try:
                os.unlink(csv_file_path)
            except:
                pass
    
    def test_file_format_support(self):
        """Test different file formats and error handling"""
        print("\n=== Testing File Format Support ===")
        
        # Test invalid file format
        try:
            temp_file = tempfile.NamedTemporaryFile(mode='w', suffix='.txt', delete=False)
            temp_file.write("This is not a CSV file")
            temp_file.close()
            
            with open(temp_file.name, 'rb') as f:
                files = {'file': ('test.txt', f, 'text/plain')}
                response = requests.post(f"{self.backend_url}/transactions/upload", files=files)
            
            if response.status_code == 400:
                self.log_test("Invalid file format rejection", True, 
                            "Correctly rejected non-CSV/Excel file")
            else:
                self.log_test("Invalid file format rejection", False, 
                            f"Expected 400, got {response.status_code}")
            
            os.unlink(temp_file.name)
            
        except Exception as e:
            self.log_test("Invalid file format rejection", False, f"Exception: {str(e)}")
        
        # Test empty file
        try:
            temp_file = tempfile.NamedTemporaryFile(mode='w', suffix='.csv', delete=False)
            temp_file.close()
            
            with open(temp_file.name, 'rb') as f:
                files = {'file': ('empty.csv', f, 'text/csv')}
                response = requests.post(f"{self.backend_url}/transactions/upload", files=files)
            
            # Should handle empty file gracefully
            self.log_test("Empty file handling", response.status_code in [400, 500], 
                        f"Handled empty file with status {response.status_code}")
            
            os.unlink(temp_file.name)
            
        except Exception as e:
            self.log_test("Empty file handling", False, f"Exception: {str(e)}")
    
    def test_column_detection(self):
        """Test column detection with different CSV formats"""
        print("\n=== Testing Column Detection ===")
        
        # Test with different column names
        test_formats = [
            {
                "name": "Standard format",
                "headers": ["Date", "Description", "Amount", "Type"],
                "data": [["2025-01-15", "Test Transaction", "100.00", "Debit"]]
            },
            {
                "name": "Alternative format",
                "headers": ["Transaction Date", "Particulars", "Value", "Dr/Cr"],
                "data": [["2025-01-15", "Test Transaction", "100.00", "Dr"]]
            },
            {
                "name": "Bank format",
                "headers": ["Posting Date", "Transaction Description", "Transaction Amount", "Transaction Type"],
                "data": [["2025-01-15", "Test Transaction", "100.00", "Debit"]]
            }
        ]
        
        for test_format in test_formats:
            try:
                # Create CSV with this format
                temp_file = tempfile.NamedTemporaryFile(mode='w', suffix='.csv', delete=False)
                writer = csv.writer(temp_file)
                writer.writerow(test_format["headers"])
                writer.writerows(test_format["data"])
                temp_file.close()
                
                with open(temp_file.name, 'rb') as f:
                    files = {'file': (f'{test_format["name"]}.csv', f, 'text/csv')}
                    response = requests.post(f"{self.backend_url}/transactions/upload", files=files)
                
                if response.status_code == 200:
                    data = response.json()
                    columns_detected = data.get('columns_detected', {})
                    
                    # Check if columns were detected
                    has_required_columns = all(columns_detected.get(col) for col in ['date', 'description', 'amount'])
                    
                    self.log_test(f"Column detection - {test_format['name']}", has_required_columns,
                                f"Detected columns: {columns_detected}")
                else:
                    self.log_test(f"Column detection - {test_format['name']}", False,
                                f"HTTP {response.status_code}: {response.text}")
                
                os.unlink(temp_file.name)
                
            except Exception as e:
                self.log_test(f"Column detection - {test_format['name']}", False, f"Exception: {str(e)}")
    
    def run_all_tests(self):
        """Run all transaction upload and import tests"""
        print("🧪 Starting Backend API Tests for Transaction Upload and Import")
        print(f"Backend URL: {self.backend_url}")
        print("=" * 60)
        
        # Test transaction upload endpoint
        self.test_transaction_upload()
        
        # Test transaction import endpoint
        self.test_transaction_import()
        
        # Test file format support
        self.test_file_format_support()
        
        # Test column detection
        self.test_column_detection()
        
        # Print summary
        print("\n" + "=" * 60)
        print("📊 TEST SUMMARY")
        print("=" * 60)
        
        total_tests = len(self.test_results)
        passed_tests = sum(1 for result in self.test_results if "✅" in result["status"])
        failed_tests = total_tests - passed_tests
        
        print(f"Total Tests: {total_tests}")
        print(f"Passed: {passed_tests}")
        print(f"Failed: {failed_tests}")
        print(f"Success Rate: {(passed_tests/total_tests)*100:.1f}%")
        
        if failed_tests > 0:
            print("\n❌ FAILED TESTS:")
            for result in self.test_results:
                if "❌" in result["status"]:
                    print(f"  - {result['test']}: {result['details']}")
        
        return passed_tests, failed_tests

if __name__ == "__main__":
    tester = BudgetTrackerTester()
    passed, failed = tester.run_all_tests()
    
    # Exit with appropriate code
    exit(0 if failed == 0 else 1)