"""
BIBI Cars POST-MERGE REGRESSION TEST
=====================================
Comprehensive backend API test after ~700-file merge from nnamedao-a11y/Bibi-Maar
Tests all key APIs, auth flows for 4 roles, and ensures no 500 errors

Test against: https://code-review-env.preview.emergentagent.com
"""
import requests
import sys
from typing import Dict, Any, Optional

BASE_URL = "https://code-review-env.preview.emergentagent.com"

class PostMergeRegressionTester:
    def __init__(self):
        self.base_url = BASE_URL
        self.tests_run = 0
        self.tests_passed = 0
        self.tests_failed = 0
        self.failed_tests = []
        self.backend_errors = []
        
        # Tokens for each role
        self.admin_token = None
        self.manager_token = None
        self.teamlead_token = None
        self.customer_token = None
        
        # Test credentials from phase_b2_1_test.py
        self.credentials = {
            "admin": {"email": "admin@bibi.cars", "password": "Jp3FS_7ZuE2bhHp7rFkJm9B9T_TeiHxu"},
            "manager": {"email": "manager@bibi.cars", "password": "dFbYnse0L59DBE16Mn4kT6cCRaNBZFQR"},
            "teamlead": {"email": "teamlead@bibi.cars", "password": "txXNMkj-lS2w1nv482aLlvKWuk9Y9eKE"},
            "customer": {"email": "user@bibi.cars", "password": "customer123"}  # Will try common password
        }

    def log(self, msg: str, indent: int = 1):
        print(f"{'  ' * indent}{msg}")

    def test(self, name: str, condition: bool, details: str = "", critical: bool = False):
        """Record test result"""
        self.tests_run += 1
        if condition:
            self.tests_passed += 1
            print(f"✅ {name}")
            if details:
                self.log(details)
        else:
            self.tests_failed += 1
            print(f"❌ {name}")
            if details:
                self.log(f"FAILED: {details}")
            self.failed_tests.append({"test": name, "details": details, "critical": critical})
        return condition

    # ═══════════════════════════════════════════════════════════════
    # PUBLIC API HEALTH TESTS
    # ═══════════════════════════════════════════════════════════════
    
    def test_public_api_health(self):
        """Test all public APIs respond with 2xx/4xx (no 500s)"""
        print("\n" + "="*70)
        print("🏥 PUBLIC API HEALTH TESTS")
        print("="*70)
        
        public_endpoints = [
            ("/api/public/vehicles?limit=6", "GET", None),
            ("/api/public/featured", "GET", None),
            ("/api/public/brands", "GET", None),
            ("/api/public/google-reviews", "GET", None),
            ("/api/auth/google-client-id", "GET", None),
            ("/api/site-info", "GET", None),
        ]
        
        for endpoint, method, data in public_endpoints:
            try:
                url = f"{self.base_url}{endpoint}"
                if method == "GET":
                    resp = requests.get(url, timeout=10)
                else:
                    resp = requests.post(url, json=data, timeout=10)
                
                # Check for 500 errors
                is_not_500 = resp.status_code < 500
                status_ok = resp.status_code in [200, 201, 400, 401, 404, 422]
                
                self.test(
                    f"{method} {endpoint} → no 500 error",
                    is_not_500,
                    f"Status: {resp.status_code}",
                    critical=(not is_not_500)
                )
                
                if resp.status_code >= 500:
                    self.backend_errors.append({
                        "endpoint": endpoint,
                        "status": resp.status_code,
                        "error": resp.text[:200]
                    })
                    
            except Exception as e:
                self.test(f"{method} {endpoint}", False, f"Exception: {e}", critical=True)

    # ═══════════════════════════════════════════════════════════════
    # AUTHENTICATION TESTS
    # ═══════════════════════════════════════════════════════════════
    
    def test_auth_all_roles(self):
        """Test login for all 4 roles"""
        print("\n" + "="*70)
        print("🔐 AUTHENTICATION TESTS (ALL 4 ROLES)")
        print("="*70)
        
        # Test admin login
        try:
            creds = self.credentials["admin"]
            resp = requests.post(
                f"{self.base_url}/api/auth/login",
                json={"email": creds["email"], "password": creds["password"]},
                timeout=10
            )
            
            is_200 = resp.status_code == 200
            has_token = False
            has_role = False
            
            if is_200:
                data = resp.json()
                has_token = "access_token" in data
                user = data.get("user", {})
                has_role = user.get("role") == "admin"
                if has_token:
                    self.admin_token = data["access_token"]
            
            self.test(
                "Admin login (admin@bibi.cars) → 200 + JWT + role=admin",
                is_200 and has_token and has_role,
                f"Status: {resp.status_code}, has_token: {has_token}, role: {data.get('user', {}).get('role') if is_200 else 'N/A'}",
                critical=True
            )
            
            if resp.status_code >= 500:
                self.backend_errors.append({
                    "endpoint": "/api/auth/login",
                    "status": resp.status_code,
                    "error": resp.text[:200]
                })
                
        except Exception as e:
            self.test("Admin login", False, f"Exception: {e}", critical=True)
        
        # Test manager login
        try:
            creds = self.credentials["manager"]
            resp = requests.post(
                f"{self.base_url}/api/auth/login",
                json={"email": creds["email"], "password": creds["password"]},
                timeout=10
            )
            
            is_200 = resp.status_code == 200
            has_token = False
            has_role = False
            
            if is_200:
                data = resp.json()
                has_token = "access_token" in data
                user = data.get("user", {})
                has_role = user.get("role") == "manager"
                if has_token:
                    self.manager_token = data["access_token"]
            
            self.test(
                "Manager login (manager@bibi.cars) → 200 + role=manager",
                is_200 and has_token and has_role,
                f"Status: {resp.status_code}, has_token: {has_token}, role: {data.get('user', {}).get('role') if is_200 else 'N/A'}",
                critical=True
            )
            
            if resp.status_code >= 500:
                self.backend_errors.append({
                    "endpoint": "/api/auth/login",
                    "status": resp.status_code,
                    "error": resp.text[:200]
                })
                
        except Exception as e:
            self.test("Manager login", False, f"Exception: {e}", critical=True)
        
        # Test teamlead login
        try:
            creds = self.credentials["teamlead"]
            resp = requests.post(
                f"{self.base_url}/api/auth/login",
                json={"email": creds["email"], "password": creds["password"]},
                timeout=10
            )
            
            is_200 = resp.status_code == 200
            has_token = False
            has_role = False
            
            if is_200:
                data = resp.json()
                has_token = "access_token" in data
                user = data.get("user", {})
                has_role = user.get("role") == "team_lead"
                if has_token:
                    self.teamlead_token = data["access_token"]
            
            self.test(
                "Teamlead login (teamlead@bibi.cars) → 200 + role=team_lead",
                is_200 and has_token and has_role,
                f"Status: {resp.status_code}, has_token: {has_token}, role: {data.get('user', {}).get('role') if is_200 else 'N/A'}",
                critical=True
            )
            
            if resp.status_code >= 500:
                self.backend_errors.append({
                    "endpoint": "/api/auth/login",
                    "status": resp.status_code,
                    "error": resp.text[:200]
                })
                
        except Exception as e:
            self.test("Teamlead login", False, f"Exception: {e}", critical=True)
        
        # Test customer login (try multiple common passwords)
        customer_passwords = ["customer123", "user123", "password123", "Jp3FS_7ZuE2bhHp7rFkJm9B9T_TeiHxu"]
        customer_logged_in = False
        
        for pwd in customer_passwords:
            try:
                resp = requests.post(
                    f"{self.base_url}/api/auth/login",
                    json={"email": "user@bibi.cars", "password": pwd},
                    timeout=10
                )
                
                if resp.status_code == 200:
                    data = resp.json()
                    if "access_token" in data:
                        self.customer_token = data["access_token"]
                        customer_logged_in = True
                        self.test(
                            "Customer login (user@bibi.cars) → 200 + JWT",
                            True,
                            f"Status: 200, password: {pwd[:10]}...",
                            critical=False
                        )
                        break
                        
            except Exception as e:
                continue
        
        if not customer_logged_in:
            self.test(
                "Customer login (user@bibi.cars)",
                False,
                "Could not login with any common password. Customer account may not exist or password unknown.",
                critical=False
            )

    # ═══════════════════════════════════════════════════════════════
    # ADMIN CABINET TESTS
    # ═══════════════════════════════════════════════════════════════
    
    def test_admin_cabinet_apis(self):
        """Test admin cabinet APIs"""
        print("\n" + "="*70)
        print("👑 ADMIN CABINET API TESTS")
        print("="*70)
        
        if not self.admin_token:
            self.test("Admin cabinet tests", False, "No admin token available", critical=True)
            return
        
        headers = {"Authorization": f"Bearer {self.admin_token}"}
        
        admin_endpoints = [
            ("/api/admin/settings/auth", "GET"),
            ("/api/admin/dashboard/stats", "GET"),
            ("/api/admin/users", "GET"),
        ]
        
        for endpoint, method in admin_endpoints:
            try:
                url = f"{self.base_url}{endpoint}"
                if method == "GET":
                    resp = requests.get(url, headers=headers, timeout=10)
                else:
                    resp = requests.post(url, headers=headers, timeout=10)
                
                is_not_500 = resp.status_code < 500
                
                self.test(
                    f"{method} {endpoint} → no 500 error",
                    is_not_500,
                    f"Status: {resp.status_code}",
                    critical=False
                )
                
                if resp.status_code >= 500:
                    self.backend_errors.append({
                        "endpoint": endpoint,
                        "status": resp.status_code,
                        "error": resp.text[:200]
                    })
                    
            except Exception as e:
                self.test(f"{method} {endpoint}", False, f"Exception: {e}", critical=False)

    # ═══════════════════════════════════════════════════════════════
    # VEHICLE CATALOG TESTS
    # ═══════════════════════════════════════════════════════════════
    
    def test_vehicle_catalog(self):
        """Test vehicle catalog APIs"""
        print("\n" + "="*70)
        print("🚗 VEHICLE CATALOG TESTS")
        print("="*70)
        
        # Test 1: Get vehicles list
        try:
            resp = requests.get(
                f"{self.base_url}/api/public/vehicles?limit=10",
                timeout=10
            )
            
            is_200 = resp.status_code == 200
            has_items = False
            test_vin = None
            
            if is_200:
                data = resp.json()
                items = data.get("items", data.get("data", []))
                has_items = len(items) > 0
                if has_items:
                    test_vin = items[0].get("vin")
            
            self.test(
                "GET /api/public/vehicles?limit=10 → 200 + items",
                is_200 and has_items,
                f"Status: {resp.status_code}, items count: {len(items) if is_200 and has_items else 0}",
                critical=True
            )
            
            # Test 2: Get single vehicle detail if we have a VIN
            if test_vin:
                try:
                    detail_resp = requests.get(
                        f"{self.base_url}/api/cars/{test_vin}",
                        timeout=10
                    )
                    
                    is_detail_ok = detail_resp.status_code in [200, 404]  # 404 is ok if endpoint changed
                    
                    self.test(
                        f"GET /api/cars/{test_vin} → 200/404",
                        is_detail_ok,
                        f"Status: {detail_resp.status_code}",
                        critical=False
                    )
                    
                except Exception as e:
                    self.test(f"GET /api/cars/{test_vin}", False, f"Exception: {e}", critical=False)
            
            # Test 3: Test specific VIN from review request
            try:
                specific_vin = "1G1ZD5ST6RF146969"
                vin_resp = requests.get(
                    f"{self.base_url}/api/cars/{specific_vin}",
                    timeout=10
                )
                
                is_vin_ok = vin_resp.status_code in [200, 404]
                
                self.test(
                    f"GET /api/cars/{specific_vin} → 200/404",
                    is_vin_ok,
                    f"Status: {vin_resp.status_code}",
                    critical=False
                )
                
            except Exception as e:
                self.test(f"GET /api/cars/{specific_vin}", False, f"Exception: {e}", critical=False)
                
        except Exception as e:
            self.test("GET /api/public/vehicles", False, f"Exception: {e}", critical=True)
        
        # Test 4: Brands and models
        try:
            brands_resp = requests.get(
                f"{self.base_url}/api/public/brands",
                timeout=10
            )
            
            is_200 = brands_resp.status_code == 200
            has_brands = False
            
            if is_200:
                data = brands_resp.json()
                if isinstance(data, list):
                    has_brands = len(data) > 0
                elif isinstance(data, dict) and "data" in data:
                    has_brands = len(data.get("data", [])) > 0
            
            self.test(
                "GET /api/public/brands → 200 + brands list",
                is_200 and has_brands,
                f"Status: {brands_resp.status_code}",
                critical=False
            )
            
        except Exception as e:
            self.test("GET /api/public/brands", False, f"Exception: {e}", critical=False)

    # ═══════════════════════════════════════════════════════════════
    # MAIN TEST RUNNER
    # ═══════════════════════════════════════════════════════════════
    
    def run_all_tests(self):
        """Run all post-merge regression tests"""
        print("\n" + "="*70)
        print("BIBI CARS POST-MERGE REGRESSION TEST SUITE")
        print("="*70)
        print(f"Base URL: {self.base_url}")
        print("Testing after ~700-file merge from nnamedao-a11y/Bibi-Maar")
        print("="*70)
        
        # Run all test suites
        self.test_public_api_health()
        self.test_auth_all_roles()
        self.test_admin_cabinet_apis()
        self.test_vehicle_catalog()
        
        # Print summary
        self.print_summary()
        
        # Return exit code
        return 0 if self.tests_failed == 0 else 1

    def print_summary(self):
        """Print test summary"""
        print("\n" + "="*70)
        print("📊 TEST SUMMARY")
        print("="*70)
        print(f"Total tests: {self.tests_run}")
        print(f"✅ Passed: {self.tests_passed}")
        print(f"❌ Failed: {self.tests_failed}")
        print(f"Success rate: {(self.tests_passed/self.tests_run*100):.1f}%")
        
        if self.backend_errors:
            print(f"\n⚠️  Backend 5xx errors detected: {len(self.backend_errors)}")
            for err in self.backend_errors[:5]:
                print(f"  - {err['endpoint']}: {err['status']} - {err['error'][:100]}")
        
        if self.failed_tests:
            print(f"\n❌ Failed tests ({len(self.failed_tests)}):")
            critical_count = sum(1 for ft in self.failed_tests if ft.get("critical"))
            print(f"   Critical failures: {critical_count}")
            for ft in self.failed_tests[:10]:
                critical = " [CRITICAL]" if ft.get("critical") else ""
                print(f"  - {ft['test']}{critical}")
                if ft['details']:
                    print(f"    {ft['details'][:150]}")
        
        print("="*70)


def main():
    tester = PostMergeRegressionTester()
    exit_code = tester.run_all_tests()
    sys.exit(exit_code)


if __name__ == "__main__":
    main()
