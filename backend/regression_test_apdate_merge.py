"""
BIBI Cars — POST-MERGE REGRESSION TEST (apdate merge)
======================================================
Verifies zero degradation after nnamedao-a11y/apdate merge (May 25, 2025)
Tests: Backend health, 4-role auth, Google integration, edge cases, public endpoints
"""
import requests
import sys
from typing import Dict, Any, Optional

BASE_URL = "https://code-review-env.preview.emergentagent.com"

class RegressionTester:
    def __init__(self):
        self.base_url = BASE_URL
        self.tests_run = 0
        self.tests_passed = 0
        self.tests_failed = 0
        
        # Tokens for each role
        self.admin_token = None
        self.manager_token = None
        self.teamlead_token = None
        self.customer_token = None
        
        # Results tracking
        self.failed_tests = []
        self.critical_failures = []

    def log(self, msg: str):
        print(f"  {msg}")

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
            self.failed_tests.append({"test": name, "details": details})
            if critical:
                self.critical_failures.append(name)
        return condition

    # ═══════════════════════════════════════════════════════════════
    # BACKEND HEALTH CHECKS
    # ═══════════════════════════════════════════════════════════════
    
    def test_public_endpoints(self):
        """Test all key public endpoints return 2xx"""
        print("\n🔍 BACKEND HEALTH: Public Endpoints")
        
        endpoints = [
            ("/api/public/vehicles", "Public vehicles"),
            ("/api/public/featured", "Featured vehicles"),
            ("/api/public/brands", "Brands list"),
            ("/api/public/google-reviews", "Google reviews"),
            ("/api/auth/google-client-id", "Google client ID"),
            ("/api/site-info", "Site info"),
        ]
        
        for endpoint, name in endpoints:
            try:
                resp = requests.get(f"{self.base_url}{endpoint}", timeout=10)
                success = 200 <= resp.status_code < 300
                
                if success:
                    # Additional validation for specific endpoints
                    if endpoint == "/api/public/google-reviews":
                        data = resp.json()
                        reviews_count = len(data.get("reviews", []))
                        avg_rating = data.get("average_rating", 0)
                        self.test(
                            f"{name} → {resp.status_code}",
                            True,
                            f"{reviews_count} reviews, avg rating: {avg_rating}"
                        )
                    elif endpoint == "/api/public/brands":
                        data = resp.json()
                        brands_count = len(data.get("brands", []))
                        self.test(f"{name} → {resp.status_code}", True, f"{brands_count} brands")
                    else:
                        self.test(f"{name} → {resp.status_code}", True)
                else:
                    self.test(
                        f"{name} → {resp.status_code}",
                        False,
                        f"Expected 2xx, got {resp.status_code}: {resp.text[:200]}",
                        critical=True
                    )
            except Exception as e:
                self.test(f"{name}", False, f"Exception: {str(e)}", critical=True)

    # ═══════════════════════════════════════════════════════════════
    # AUTHENTICATION TESTS
    # ═══════════════════════════════════════════════════════════════
    
    def test_staff_login(self, email: str, password: str, role_name: str, expected_role: str) -> Optional[str]:
        """Test staff login (admin/manager/teamlead) via /api/auth/login"""
        try:
            resp = requests.post(
                f"{self.base_url}/api/auth/login",
                json={"email": email, "password": password},
                timeout=10
            )
            
            if resp.status_code != 200:
                self.test(
                    f"{role_name} login",
                    False,
                    f"Expected 200, got {resp.status_code}: {resp.text[:200]}",
                    critical=True
                )
                return None
            
            data = resp.json()
            
            # Check if this is a 2FA challenge response (teamlead uses OTP)
            if "challenge" in data and data.get("challenge") == "email_otp":
                challenge_role = data.get("role")
                if challenge_role == expected_role:
                    self.test(
                        f"{role_name} login",
                        True,
                        f"2FA challenge received (email_otp), role: {challenge_role}"
                    )
                    return "2FA_REQUIRED"
                else:
                    self.test(
                        f"{role_name} login",
                        False,
                        f"Expected role '{expected_role}', got '{challenge_role}'",
                        critical=True
                    )
                    return None
            
            # Normal token response
            token = data.get("access_token")
            user = data.get("user", {})
            user_role = user.get("role")
            
            if not token:
                self.test(f"{role_name} login", False, "No access_token in response", critical=True)
                return None
            
            if user_role != expected_role:
                self.test(
                    f"{role_name} login",
                    False,
                    f"Expected role '{expected_role}', got '{user_role}'",
                    critical=True
                )
                return None
            
            self.test(f"{role_name} login", True, f"JWT received, role: {user_role}")
            return token
            
        except Exception as e:
            self.test(f"{role_name} login", False, f"Exception: {str(e)}", critical=True)
            return None

    def test_customer_login(self, email: str, password: str) -> Optional[str]:
        """Test customer login via /api/customer-auth/login"""
        try:
            resp = requests.post(
                f"{self.base_url}/api/customer-auth/login",
                json={"email": email, "password": password},
                timeout=10
            )
            
            if resp.status_code != 200:
                self.test(
                    "Customer login",
                    False,
                    f"Expected 200, got {resp.status_code}: {resp.text[:200]}",
                    critical=True
                )
                return None
            
            data = resp.json()
            # Customer endpoint returns 'accessToken' (camelCase) not 'access_token'
            token = data.get("accessToken") or data.get("access_token")
            user_role = data.get("role")
            
            if not token:
                self.test("Customer login", False, "No accessToken in response", critical=True)
                return None
            
            self.test("Customer login", True, f"Token received, role: {user_role}")
            return token
            
        except Exception as e:
            self.test("Customer login", False, f"Exception: {str(e)}", critical=True)
            return None

    def test_all_auth(self):
        """Test all 4 roles authentication"""
        print("\n🔍 AUTHENTICATION: All 4 Roles")
        
        # Admin
        self.admin_token = self.test_staff_login(
            "admin@bibi.cars",
            "Jp3FS_7ZuE2bhHp7rFkJm9B9T_TeiHxu",
            "Admin",
            "admin"
        )
        
        # Manager
        self.manager_token = self.test_staff_login(
            "manager@bibi.cars",
            "dFbYnse0L59DBE16Mn4kT6cCRaNBZFQR",
            "Manager",
            "manager"
        )
        
        # Teamlead
        self.teamlead_token = self.test_staff_login(
            "teamlead@bibi.cars",
            "txXNMkj-lS2w1nv482aLlvKWuk9Y9eKE",
            "Teamlead",
            "team_lead"
        )
        
        # Customer
        self.customer_token = self.test_customer_login(
            "user@bibi.cars",
            "User_bibi_2026!"
        )

    def test_auth_edge_cases(self):
        """Test authentication edge cases"""
        print("\n🔍 AUTH EDGE CASES: Error Handling")
        
        # Wrong password for admin
        try:
            resp = requests.post(
                f"{self.base_url}/api/auth/login",
                json={"email": "admin@bibi.cars", "password": "wrong_password"},
                timeout=10
            )
            self.test(
                "Wrong password → 401",
                resp.status_code == 401,
                f"Got {resp.status_code}" if resp.status_code != 401 else "Correct 401 response"
            )
            
            # Ensure no 500 error
            if resp.status_code == 500:
                self.test("No 500 on wrong password", False, "Got 500 error", critical=True)
            else:
                self.test("No 500 on wrong password", True)
                
        except Exception as e:
            self.test("Wrong password test", False, f"Exception: {str(e)}")
        
        # Missing token test
        try:
            resp = requests.get(
                f"{self.base_url}/api/admin/settings/auth",
                timeout=10
            )
            self.test(
                "Missing token → 401",
                resp.status_code == 401,
                f"Got {resp.status_code}" if resp.status_code != 401 else "Correct 401 response"
            )
        except Exception as e:
            self.test("Missing token test", False, f"Exception: {str(e)}")
        
        # Invalid token test
        try:
            resp = requests.get(
                f"{self.base_url}/api/admin/settings/auth",
                headers={"Authorization": "Bearer invalid_token_12345"},
                timeout=10
            )
            self.test(
                "Invalid token → 401",
                resp.status_code == 401,
                f"Got {resp.status_code}" if resp.status_code != 401 else "Correct 401 response"
            )
        except Exception as e:
            self.test("Invalid token test", False, f"Exception: {str(e)}")

    def test_google_integration(self):
        """Test Google integration endpoints"""
        print("\n🔍 GOOGLE INTEGRATION")
        
        # Public google-reviews (already tested in public endpoints, but verify details)
        try:
            resp = requests.get(f"{self.base_url}/api/public/google-reviews", timeout=10)
            if resp.status_code == 200:
                data = resp.json()
                reviews = data.get("reviews", [])
                # The API returns 'rating' not 'average_rating'
                avg_rating = data.get("rating", 0)
                # The API returns 'count' for total count
                total_count = data.get("count", len(reviews))
                
                # Verify we have ~32 reviews and ~4.9 avg rating
                reviews_ok = 30 <= total_count <= 35
                rating_ok = 4.8 <= avg_rating <= 5.0
                
                self.test(
                    "Google reviews count (~32)",
                    reviews_ok,
                    f"Got {total_count} reviews (expected ~32)"
                )
                self.test(
                    "Google reviews avg rating (~4.9)",
                    rating_ok,
                    f"Got {avg_rating} rating (expected ~4.9)"
                )
            else:
                self.test("Google reviews endpoint", False, f"Got {resp.status_code}")
        except Exception as e:
            self.test("Google reviews test", False, f"Exception: {str(e)}")
        
        # Admin moderation list (requires admin token)
        if self.admin_token:
            try:
                resp = requests.get(
                    f"{self.base_url}/api/admin/google-reviews",
                    headers={"Authorization": f"Bearer {self.admin_token}"},
                    timeout=10
                )
                self.test(
                    "Admin Google reviews moderation",
                    resp.status_code == 200,
                    f"Got {resp.status_code}"
                )
            except Exception as e:
                self.test("Admin Google reviews", False, f"Exception: {str(e)}")

    def test_admin_settings_auth(self):
        """Test admin settings/auth endpoint"""
        print("\n🔍 ADMIN ENDPOINTS")
        
        if not self.admin_token:
            self.test("Admin settings/auth", False, "No admin token available", critical=True)
            return
        
        try:
            resp = requests.get(
                f"{self.base_url}/api/admin/settings/auth",
                headers={"Authorization": f"Bearer {self.admin_token}"},
                timeout=10
            )
            self.test(
                "Admin settings/auth",
                resp.status_code == 200,
                f"Got {resp.status_code}: {resp.text[:200] if resp.status_code != 200 else 'OK'}"
            )
        except Exception as e:
            self.test("Admin settings/auth", False, f"Exception: {str(e)}")

    def test_vehicles_deduplication(self):
        """Test that vehicles endpoint doesn't return duplicates by VIN"""
        print("\n🔍 SORT/DE-DUPLICATION PROTECTION")
        
        try:
            resp = requests.get(f"{self.base_url}/api/public/vehicles?limit=100", timeout=10)
            if resp.status_code == 200:
                data = resp.json()
                vehicles = data.get("vehicles", [])
                
                # Extract VINs
                vins = [v.get("vin") for v in vehicles if v.get("vin")]
                unique_vins = set(vins)
                
                has_duplicates = len(vins) != len(unique_vins)
                
                self.test(
                    "No duplicate VINs in vehicles",
                    not has_duplicates,
                    f"Found {len(vins)} vehicles, {len(unique_vins)} unique VINs" + 
                    (f" - DUPLICATES DETECTED!" if has_duplicates else "")
                )
            else:
                self.test("Vehicles deduplication check", False, f"Got {resp.status_code}")
        except Exception as e:
            self.test("Vehicles deduplication", False, f"Exception: {str(e)}")

    def check_backend_logs_for_500s(self):
        """Check if backend logs contain 500 errors or unhandled tracebacks"""
        print("\n🔍 BACKEND LOG CHECK (500 errors)")
        
        # Note: This is a placeholder - actual log checking would require file access
        # The tester will manually check logs after running tests
        self.log("⚠️  Manual check required: tail -n 200 /var/log/supervisor/backend.err.log")
        self.log("    Look for: 500 errors, unhandled tracebacks, exceptions")

    # ═══════════════════════════════════════════════════════════════
    # MAIN TEST RUNNER
    # ═══════════════════════════════════════════════════════════════
    
    def run_all_tests(self):
        """Run complete regression test suite"""
        print("=" * 70)
        print("BIBI CARS — POST-MERGE REGRESSION TEST (apdate merge)")
        print("=" * 70)
        
        # Backend health
        self.test_public_endpoints()
        
        # Authentication
        self.test_all_auth()
        self.test_auth_edge_cases()
        
        # Google integration
        self.test_google_integration()
        
        # Admin endpoints
        self.test_admin_settings_auth()
        
        # De-duplication
        self.test_vehicles_deduplication()
        
        # Log check reminder
        self.check_backend_logs_for_500s()
        
        # Summary
        print("\n" + "=" * 70)
        print(f"📊 RESULTS: {self.tests_passed}/{self.tests_run} tests passed")
        print("=" * 70)
        
        if self.critical_failures:
            print(f"\n🚨 CRITICAL FAILURES ({len(self.critical_failures)}):")
            for failure in self.critical_failures:
                print(f"  - {failure}")
        
        if self.failed_tests:
            print(f"\n❌ FAILED TESTS ({len(self.failed_tests)}):")
            for failure in self.failed_tests:
                print(f"  - {failure['test']}")
                if failure['details']:
                    print(f"    {failure['details']}")
        
        return 0 if self.tests_failed == 0 else 1

def main():
    tester = RegressionTester()
    exit_code = tester.run_all_tests()
    sys.exit(exit_code)

if __name__ == "__main__":
    main()
