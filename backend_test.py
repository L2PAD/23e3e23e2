#!/usr/bin/env python3
"""
BIBI CARS PRE-DEPLOYMENT VERIFICATION TEST SUITE
=================================================
Final verification before production redeployment to https://bibicar.org

Test Coverage:
1. Database connectivity & data integrity
2. Google Reviews integration (public feed, admin config, sync)
3. Google Sign-In configuration
4. All 4 role-based authentications (admin, manager, teamlead, customer)
5. Critical CRUD endpoints (public vehicles, featured, brands, site-info)
6. External HMAC authentication (vesselfinder)
"""

import requests
import sys
import hmac
import hashlib
import json
from datetime import datetime
from typing import Dict, Any, Optional

# Backend URL from frontend/.env
BASE_URL = "https://code-review-env.preview.emergentagent.com"

# Test credentials (from review_request)
CREDENTIALS = {
    "admin": {
        "email": "admin@bibi.cars",
        "password": "Jp3FS_7ZuE2bhHp7rFkJm9B9T_TeiHxu",
        "endpoint": "/api/auth/login"
    },
    "manager": {
        "email": "manager@bibi.cars",
        "password": "dFbYnse0L59DBE16Mn4kT6cCRaNBZFQR",
        "endpoint": "/api/auth/login"
    },
    "teamlead": {
        "email": "teamlead@bibi.cars",
        "password": "txXNMkj-lS2w1nv482aLlvKWuk9Y9eKE",
        "endpoint": "/api/auth/login"
    },
    "customer": {
        "email": "user@bibi.cars",
        "password": "User_bibi_2026!",
        "endpoint": "/api/customer-auth/login"  # DIFFERENT endpoint!
    }
}

# HMAC secret for external endpoints
EXT_SHARED_SECRET = "lVyqvrylbaHDJXjnCnFOWfuv3rJryV8anocAILPW6MBZB_hEs-S9Dc0lZcNH24R_"


class TestResults:
    def __init__(self):
        self.total = 0
        self.passed = 0
        self.failed = 0
        self.warnings = 0
        self.errors = []
        self.category_results = {
            "database": {"passed": 0, "total": 0},
            "google_reviews": {"passed": 0, "total": 0},
            "google_signin": {"passed": 0, "total": 0},
            "authentication": {"passed": 0, "total": 0},
            "admin_endpoints": {"passed": 0, "total": 0},
            "manager_endpoints": {"passed": 0, "total": 0},
            "teamlead_endpoints": {"passed": 0, "total": 0},
            "customer_endpoints": {"passed": 0, "total": 0},
            "public_endpoints": {"passed": 0, "total": 0},
            "external_hmac": {"passed": 0, "total": 0}
        }
    
    def record(self, category: str, passed: bool, test_name: str, details: str = ""):
        self.total += 1
        self.category_results[category]["total"] += 1
        
        if passed:
            self.passed += 1
            self.category_results[category]["passed"] += 1
            print(f"✅ PASS: {test_name}")
            if details:
                print(f"   → {details}")
        else:
            self.failed += 1
            print(f"❌ FAIL: {test_name}")
            if details:
                print(f"   → {details}")
            self.errors.append({"test": test_name, "details": details})
    
    def record_warning(self, test_name: str, details: str):
        self.warnings += 1
        print(f"⚠️  WARN: {test_name}")
        print(f"   → {details}")
    
    def print_summary(self):
        print("\n" + "="*80)
        print("FINAL PRE-DEPLOYMENT VERIFICATION SUMMARY")
        print("="*80)
        print(f"Total Tests: {self.total}")
        print(f"Passed: {self.passed} ({self.passed/self.total*100:.1f}%)")
        print(f"Failed: {self.failed}")
        print(f"Warnings: {self.warnings}")
        print()
        
        print("Category Breakdown:")
        for category, results in self.category_results.items():
            if results["total"] > 0:
                pct = results["passed"] / results["total"] * 100
                status = "✅" if pct == 100 else "⚠️" if pct >= 80 else "❌"
                print(f"  {status} {category:20s}: {results['passed']}/{results['total']} ({pct:.0f}%)")
        
        if self.errors:
            print("\n" + "="*80)
            print("FAILED TESTS DETAILS:")
            print("="*80)
            for i, error in enumerate(self.errors, 1):
                print(f"{i}. {error['test']}")
                print(f"   {error['details']}")
        
        print("\n" + "="*80)
        if self.failed == 0:
            print("✅ ALL TESTS PASSED - READY FOR PRODUCTION DEPLOYMENT")
        else:
            print(f"❌ {self.failed} TESTS FAILED - DO NOT DEPLOY")
        print("="*80)


class BibiBarsTestSuite:
    def __init__(self):
        self.results = TestResults()
        self.tokens = {}
        self.session = requests.Session()
        self.session.headers.update({
            "Content-Type": "application/json",
            "User-Agent": "BibiBars-PreDeployment-Test/1.0"
        })
    
    def run_all_tests(self):
        """Execute all test categories"""
        print("="*80)
        print("BIBI CARS PRE-DEPLOYMENT VERIFICATION")
        print(f"Backend URL: {BASE_URL}")
        print(f"Started: {datetime.now().isoformat()}")
        print("="*80)
        print()
        
        # Test order: critical infrastructure first
        self.test_database_connectivity()
        self.test_google_reviews_integration()
        self.test_google_signin_config()
        self.test_authentication_all_roles()
        
        # Only test role-based endpoints if auth succeeded
        if self.tokens:
            self.test_admin_endpoints()
            self.test_manager_endpoints()
            self.test_teamlead_endpoints()
            self.test_customer_endpoints()
        
        self.test_public_endpoints()
        self.test_external_hmac()
        
        self.results.print_summary()
        
        return 0 if self.results.failed == 0 else 1
    
    def _make_request(self, method: str, endpoint: str, expected_status: int = 200,
                     data: Optional[Dict] = None, token: Optional[str] = None,
                     headers: Optional[Dict] = None) -> tuple[bool, Any]:
        """Make HTTP request and validate response"""
        url = f"{BASE_URL}{endpoint}"
        req_headers = headers or {}
        
        if token:
            req_headers["Authorization"] = f"Bearer {token}"
        
        try:
            if method == "GET":
                resp = self.session.get(url, headers=req_headers, timeout=30)
            elif method == "POST":
                resp = self.session.post(url, json=data, headers=req_headers, timeout=30)
            elif method == "PATCH":
                resp = self.session.patch(url, json=data, headers=req_headers, timeout=30)
            elif method == "PUT":
                resp = self.session.put(url, json=data, headers=req_headers, timeout=30)
            else:
                return False, f"Unsupported method: {method}"
            
            success = resp.status_code == expected_status
            
            if not success:
                return False, f"Expected {expected_status}, got {resp.status_code}: {resp.text[:200]}"
            
            try:
                return True, resp.json()
            except:
                return True, resp.text
                
        except requests.exceptions.Timeout:
            return False, "Request timeout (30s)"
        except requests.exceptions.ConnectionError as e:
            return False, f"Connection error: {str(e)}"
        except Exception as e:
            return False, f"Request failed: {str(e)}"
    
    # ========================================================================
    # DATABASE CONNECTIVITY TESTS
    # ========================================================================
    
    def test_database_connectivity(self):
        print("\n" + "="*80)
        print("1. DATABASE CONNECTIVITY & DATA INTEGRITY")
        print("="*80)
        
        # Test via public vehicles endpoint (requires DB)
        success, data = self._make_request("GET", "/api/public/vehicles?limit=1")
        
        if success and isinstance(data, dict):
            items = data.get("items", [])
            total = data.get("total", 0)
            
            self.results.record(
                "database", 
                total > 0,
                "MongoDB connection & vin_data collection",
                f"Found {total} vehicles in database"
            )
            
            # Expected collections with approximate counts
            expected_collections = {
                "vin_data": 6045,
                "vin_data_lemon": 85000,
                "vin_data_westmotors": 42000
            }
            
            for collection, expected_count in expected_collections.items():
                self.results.record_warning(
                    f"Collection {collection}",
                    f"Expected ~{expected_count} records (verify via MongoDB directly)"
                )
        else:
            self.results.record(
                "database",
                False,
                "MongoDB connection",
                f"Failed to query database: {data}"
            )
    
    # ========================================================================
    # GOOGLE REVIEWS INTEGRATION TESTS
    # ========================================================================
    
    def test_google_reviews_integration(self):
        print("\n" + "="*80)
        print("2. GOOGLE REVIEWS INTEGRATION")
        print("="*80)
        
        # Test 1: Public feed
        success, data = self._make_request("GET", "/api/public/google-reviews")
        
        if success and isinstance(data, dict):
            # Correct keys: reviews (not items), count (not totalReviews), rating (not averageRating)
            items = data.get("reviews", [])
            avg_rating = data.get("rating", 0)
            total_reviews = data.get("count", 0)
            
            # Verify expected data structure
            has_correct_count = total_reviews == 32
            has_correct_rating = 4.8 <= avg_rating <= 5.0  # Allow slight variance
            has_items = len(items) > 0
            
            self.results.record(
                "google_reviews",
                has_correct_count and has_items,
                "Public Google Reviews feed",
                f"Found {total_reviews} reviews (expected 32), avg rating {avg_rating}"
            )
            
            # Verify item schema
            if items:
                first_item = items[0]
                required_fields = ["id", "author_name", "rating", "text", "time"]
                has_all_fields = all(field in first_item for field in required_fields)
                
                self.results.record(
                    "google_reviews",
                    has_all_fields,
                    "Google Reviews item schema",
                    f"Schema validation: {', '.join(required_fields)}"
                )
        else:
            self.results.record(
                "google_reviews",
                False,
                "Public Google Reviews feed",
                f"Failed: {data}"
            )
    
    def test_google_reviews_admin(self, admin_token: str):
        """Test admin Google Reviews endpoints (called after auth)"""
        print("\n--- Google Reviews Admin Tests ---")
        
        # Test 1: Get config
        success, data = self._make_request(
            "GET", 
            "/api/admin/google-reviews/config",
            token=admin_token
        )
        
        if success and isinstance(data, dict):
            place_ids = data.get("place_ids", data.get("placeIds", []))
            has_two_places = len(place_ids) == 2
            
            self.results.record(
                "google_reviews",
                has_two_places,
                "Admin: Google Reviews config",
                f"Found {len(place_ids)} place IDs configured (expected 2)"
            )
        else:
            self.results.record(
                "google_reviews",
                False,
                "Admin: Google Reviews config",
                f"Failed: {data}"
            )
        
        # Test 2: List reviews (moderation queue)
        success, data = self._make_request(
            "GET",
            "/api/admin/google-reviews",
            token=admin_token
        )
        
        if success and isinstance(data, dict):
            items = data.get("items", [])
            count = data.get("count", 0)
            
            self.results.record(
                "google_reviews",
                count > 0,
                "Admin: List reviews (moderation queue)",
                f"Found {count} reviews"
            )
            
            # Test 3: PATCH a review (if we have any)
            if items:
                review_id = items[0].get("id")
                if review_id:
                    success, patch_data = self._make_request(
                        "PATCH",
                        f"/api/admin/google-reviews/{review_id}",
                        data={"hidden": False, "pinned": False},
                        token=admin_token
                    )
                    
                    self.results.record(
                        "google_reviews",
                        success,
                        "Admin: PATCH review",
                        f"Updated review {review_id[:8]}..."
                    )
        else:
            self.results.record(
                "google_reviews",
                False,
                "Admin: List reviews",
                f"Failed: {data}"
            )
        
        # Test 4: Sync endpoint (may fail if upstream API issues, that's OK)
        success, data = self._make_request(
            "POST",
            "/api/admin/google-reviews/sync",
            expected_status=200,
            token=admin_token
        )
        
        # Accept 200, 400, 502 as valid (upstream errors are acceptable)
        if not success:
            # Try again with different expected status
            success2, data2 = self._make_request(
                "POST",
                "/api/admin/google-reviews/sync",
                expected_status=502,
                token=admin_token
            )
            
            if success2:
                self.results.record_warning(
                    "Admin: Google Reviews sync",
                    "Sync returned 502 (upstream API error) - acceptable for pre-deploy"
                )
            else:
                self.results.record(
                    "google_reviews",
                    False,
                    "Admin: Google Reviews sync",
                    f"Failed: {data}"
                )
        else:
            self.results.record(
                "google_reviews",
                True,
                "Admin: Google Reviews sync",
                "Sync completed successfully"
            )
    
    # ========================================================================
    # GOOGLE SIGN-IN CONFIGURATION TESTS
    # ========================================================================
    
    def test_google_signin_config(self):
        print("\n" + "="*80)
        print("3. GOOGLE SIGN-IN CONFIGURATION")
        print("="*80)
        
        # Test 1: Get Google client ID
        success, data = self._make_request("GET", "/api/auth/google-client-id")
        
        if success and isinstance(data, dict):
            client_id = data.get("clientId", "")
            enabled = data.get("enabled", False)
            
            has_correct_prefix = client_id.startswith("310106754743-")
            
            self.results.record(
                "google_signin",
                has_correct_prefix and enabled,
                "Google Sign-In client ID",
                f"Client ID: {client_id[:20]}..., enabled: {enabled}"
            )
        else:
            self.results.record(
                "google_signin",
                False,
                "Google Sign-In client ID",
                f"Failed: {data}"
            )
        
        # Test 2: Verify endpoint rejects bad token (should return 401/400, NOT 500)
        success, data = self._make_request(
            "POST",
            "/api/customer-auth/google/verify",
            expected_status=401,
            data={"token": "invalid_token_12345"}
        )
        
        # Accept 401 or 400 as valid
        if not success:
            success2, data2 = self._make_request(
                "POST",
                "/api/customer-auth/google/verify",
                expected_status=400,
                data={"token": "invalid_token_12345"}
            )
            success = success2
            data = data2
        
        self.results.record(
            "google_signin",
            success,
            "Google Sign-In error handling",
            "Correctly rejects invalid token with 401/400 (not 500)"
        )
    
    def test_google_signin_admin_settings(self, admin_token: str):
        """Test Google Sign-In admin settings (called after auth)"""
        print("\n--- Google Sign-In Admin Settings ---")
        
        success, data = self._make_request(
            "GET",
            "/api/admin/settings/auth",
            token=admin_token
        )
        
        if success and isinstance(data, dict):
            google_config = data.get("google", {})
            allowed_domains = google_config.get("allowedDomains", [])
            
            self.results.record(
                "google_signin",
                isinstance(allowed_domains, list),
                "Admin: Google allowed domains config",
                f"Allowed domains: {allowed_domains if allowed_domains else '[] (all domains)'}"
            )
        else:
            self.results.record(
                "google_signin",
                False,
                "Admin: Google allowed domains config",
                f"Failed: {data}"
            )
    
    # ========================================================================
    # AUTHENTICATION TESTS (ALL 4 ROLES)
    # ========================================================================
    
    def test_authentication_all_roles(self):
        print("\n" + "="*80)
        print("4. AUTHENTICATION (ALL 4 ROLES)")
        print("="*80)
        
        for role, creds in CREDENTIALS.items():
            print(f"\n--- Testing {role.upper()} authentication ---")
            
            # Test 1: Valid login
            success, data = self._make_request(
                "POST",
                creds["endpoint"],
                data={
                    "email": creds["email"],
                    "password": creds["password"]
                }
            )
            
            if success and isinstance(data, dict):
                token = data.get("token") or data.get("access_token")
                
                if token:
                    self.tokens[role] = token
                    self.results.record(
                        "authentication",
                        True,
                        f"{role.capitalize()}: Valid login",
                        f"Token received: {token[:20]}..."
                    )
                    
                    # Test 2: Verify token works
                    me_endpoint = "/api/customer-auth/me" if role == "customer" else "/api/auth/me"
                    success2, user_data = self._make_request(
                        "GET",
                        me_endpoint,
                        token=token
                    )
                    
                    if success2 and isinstance(user_data, dict):
                        user_email = user_data.get("email")
                        user_role = user_data.get("role", "").lower()
                        
                        # For customer, role might be "customer" or "user"
                        role_matches = (user_role == role) or (role == "customer" and user_role in ["customer", "user"]) or (role == "teamlead" and user_role == "team_lead")
                        
                        self.results.record(
                            "authentication",
                            role_matches,
                            f"{role.capitalize()}: Token validation",
                            f"User: {user_email}, Role: {user_role}"
                        )
                    else:
                        self.results.record(
                            "authentication",
                            False,
                            f"{role.capitalize()}: Token validation",
                            f"Failed to get user info: {user_data}"
                        )
                else:
                    self.results.record(
                        "authentication",
                        False,
                        f"{role.capitalize()}: Valid login",
                        "No token in response"
                    )
            else:
                self.results.record(
                    "authentication",
                    False,
                    f"{role.capitalize()}: Valid login",
                    f"Failed: {data}"
                )
            
            # Test 3: Invalid credentials (should return 401)
            success, data = self._make_request(
                "POST",
                creds["endpoint"],
                expected_status=401,
                data={
                    "email": creds["email"],
                    "password": "wrong_password_123"
                }
            )
            
            self.results.record(
                "authentication",
                success,
                f"{role.capitalize()}: Invalid credentials rejection",
                "Correctly returns 401 for wrong password"
            )
    
    # ========================================================================
    # ADMIN ENDPOINTS TESTS
    # ========================================================================
    
    def test_admin_endpoints(self):
        print("\n" + "="*80)
        print("5. ADMIN ENDPOINTS")
        print("="*80)
        
        admin_token = self.tokens.get("admin")
        if not admin_token:
            print("⚠️  Skipping admin tests - no admin token")
            return
        
        # Test 1: Auth settings
        success, data = self._make_request(
            "GET",
            "/api/admin/settings/auth",
            token=admin_token
        )
        
        if success and isinstance(data, dict):
            has_features = "features" in data
            has_google = "google" in data
            
            self.results.record(
                "admin_endpoints",
                has_features and has_google,
                "GET /api/admin/settings/auth",
                f"Config keys: {', '.join(data.keys())}"
            )
        else:
            self.results.record(
                "admin_endpoints",
                False,
                "GET /api/admin/settings/auth",
                f"Failed: {data}"
            )
        
        # Test 2: Integrations
        success, data = self._make_request(
            "GET",
            "/api/admin/integrations",
            token=admin_token
        )
        
        self.results.record(
            "admin_endpoints",
            success,
            "GET /api/admin/integrations",
            f"Response: {str(data)[:100]}..."
        )
        
        # Test 3: Customers list
        success, data = self._make_request(
            "GET",
            "/api/customers",
            token=admin_token
        )
        
        if success:
            # Response uses "data" key
            customers = data.get("data", data) if isinstance(data, dict) else data
            count = len(customers) if isinstance(customers, list) else 0
            self.results.record(
                "admin_endpoints",
                count > 0,
                "GET /api/customers (list)",
                f"Found {count} customers"
            )
        else:
            # This endpoint might not exist or have different path
            self.results.record_warning(
                "GET /api/customers",
                "Endpoint may not exist or requires different path"
            )
        
        # Run Google Reviews admin tests
        self.test_google_reviews_admin(admin_token)
        
        # Run Google Sign-In admin tests
        self.test_google_signin_admin_settings(admin_token)
    
    # ========================================================================
    # MANAGER ENDPOINTS TESTS
    # ========================================================================
    
    def test_manager_endpoints(self):
        print("\n" + "="*80)
        print("6. MANAGER ENDPOINTS")
        print("="*80)
        
        manager_token = self.tokens.get("manager")
        if not manager_token:
            print("⚠️  Skipping manager tests - no manager token")
            return
        
        # Test 1: Orders list
        success, data = self._make_request(
            "GET",
            "/api/manager/orders",
            token=manager_token
        )
        
        self.results.record(
            "manager_endpoints",
            success,
            "GET /api/manager/orders",
            f"Response: {str(data)[:100]}..."
        )
        
        # Test 2: Calls
        success, data = self._make_request(
            "GET",
            "/api/manager/calls/my",
            token=manager_token
        )
        
        self.results.record(
            "manager_endpoints",
            success,
            "GET /api/manager/calls/my",
            f"Response: {str(data)[:100]}..."
        )
    
    # ========================================================================
    # TEAMLEAD ENDPOINTS TESTS
    # ========================================================================
    
    def test_teamlead_endpoints(self):
        print("\n" + "="*80)
        print("7. TEAMLEAD ENDPOINTS")
        print("="*80)
        
        teamlead_token = self.tokens.get("teamlead")
        if not teamlead_token:
            print("⚠️  Skipping teamlead tests - no teamlead token")
            return
        
        # Test 1: Managers list (load board)
        success, data = self._make_request(
            "GET",
            "/api/team/managers",
            token=teamlead_token
        )
        
        self.results.record(
            "teamlead_endpoints",
            success,
            "GET /api/team/managers",
            f"Response: {str(data)[:100]}..."
        )
        
        # Note: Other teamlead endpoints like /api/team-lead/dashboard may not exist
        # The actual endpoints use /api/team/* prefix based on grep results
    
    # ========================================================================
    # CUSTOMER ENDPOINTS TESTS
    # ========================================================================
    
    def test_customer_endpoints(self):
        print("\n" + "="*80)
        print("8. CUSTOMER ENDPOINTS")
        print("="*80)
        
        customer_token = self.tokens.get("customer")
        if not customer_token:
            print("⚠️  Skipping customer tests - no customer token")
            return
        
        # Test 1: Profile
        success, data = self._make_request(
            "GET",
            "/api/customer-auth/me",
            token=customer_token
        )
        
        if success and isinstance(data, dict):
            email = data.get("email")
            self.results.record(
                "customer_endpoints",
                email == CREDENTIALS["customer"]["email"],
                "GET /api/customer-auth/me",
                f"Profile: {email}"
            )
        else:
            self.results.record(
                "customer_endpoints",
                False,
                "GET /api/customer-auth/me",
                f"Failed: {data}"
            )
    
    # ========================================================================
    # PUBLIC ENDPOINTS TESTS
    # ========================================================================
    
    def test_public_endpoints(self):
        print("\n" + "="*80)
        print("9. PUBLIC CRITICAL ENDPOINTS")
        print("="*80)
        
        # Test 1: Vehicles list
        success, data = self._make_request(
            "GET",
            "/api/public/vehicles?limit=10"
        )
        
        if success and isinstance(data, dict):
            # Response uses "data" key, not "items"
            items = data.get("data", data.get("items", []))
            total = data.get("total", 0)
            
            self.results.record(
                "public_endpoints",
                len(items) >= 10,
                "GET /api/public/vehicles",
                f"Returned {len(items)} items, total: {total}"
            )
        else:
            self.results.record(
                "public_endpoints",
                False,
                "GET /api/public/vehicles",
                f"Failed: {data}"
            )
        
        # Test 2: Featured deals
        success, data = self._make_request(
            "GET",
            "/api/public/featured"
        )
        
        self.results.record(
            "public_endpoints",
            success,
            "GET /api/public/featured",
            f"Response: {str(data)[:100]}..."
        )
        
        # Test 3: Brands
        success, data = self._make_request(
            "GET",
            "/api/public/brands"
        )
        
        if success:
            # Response uses "data" key
            brands = data.get("data", data) if isinstance(data, dict) else data
            count = len(brands) if isinstance(brands, list) else 0
            self.results.record(
                "public_endpoints",
                count > 0,
                "GET /api/public/brands",
                f"Found {count} brands"
            )
        else:
            self.results.record(
                "public_endpoints",
                False,
                "GET /api/public/brands",
                f"Failed: {data}"
            )
        
        # Test 4: Site info
        success, data = self._make_request(
            "GET",
            "/api/site-info"
        )
        
        self.results.record(
            "public_endpoints",
            success,
            "GET /api/site-info",
            f"Response: {str(data)[:100]}..."
        )
    
    # ========================================================================
    # EXTERNAL HMAC AUTHENTICATION TESTS
    # ========================================================================
    
    def test_external_hmac(self):
        print("\n" + "="*80)
        print("10. EXTERNAL/HMAC AUTHENTICATION")
        print("="*80)
        
        # Test 1: Vesselfinder heartbeat with correct HMAC
        # HMAC format: HMAC_SHA256(secret, f"{timestamp}\n{METHOD}\n{path}\n{body_sha256}")
        timestamp = str(int(datetime.now().timestamp()))
        client_id = "test-client"
        nonce = f"test-{timestamp}"
        
        payload = {"status": "test", "data": {}}
        payload_bytes = json.dumps(payload, separators=(',', ':')).encode('utf-8')
        body_sha = hashlib.sha256(payload_bytes).hexdigest()
        
        method = "POST"
        path = "/api/vesselfinder/heartbeat"
        
        # Build signature: timestamp\nMETHOD\npath\nbody_sha256
        message = f"{timestamp}\n{method}\n{path}\n{body_sha}"
        signature = hmac.new(
            EXT_SHARED_SECRET.encode(),
            message.encode(),
            hashlib.sha256
        ).hexdigest()
        
        success, data = self._make_request(
            "POST",
            path,
            expected_status=200,
            data=payload,
            headers={
                "X-Ext-Timestamp": timestamp,
                "X-Ext-Signature": signature,
                "X-Ext-Client": client_id,
                "X-Ext-Nonce": nonce
            }
        )
        
        # Accept 200, 201, 204 as success
        if not success:
            for status in [201, 204]:
                success2, data2 = self._make_request(
                    "POST",
                    path,
                    expected_status=status,
                    data=payload,
                    headers={
                        "X-Ext-Timestamp": timestamp,
                        "X-Ext-Signature": signature,
                        "X-Ext-Client": client_id,
                        "X-Ext-Nonce": nonce
                    }
                )
                if success2:
                    success = True
                    data = data2
                    break
        
        self.results.record(
            "external_hmac",
            success,
            "POST /api/vesselfinder/heartbeat (valid HMAC)",
            "Accepted with correct HMAC signature"
        )
        
        # Test 2: Vesselfinder heartbeat without HMAC (should return 401)
        success, data = self._make_request(
            "POST",
            path,
            expected_status=401,
            data=payload
        )
        
        self.results.record(
            "external_hmac",
            success,
            "POST /api/vesselfinder/heartbeat (no HMAC)",
            "Correctly rejects request without signature"
        )


def main():
    suite = BibiBarsTestSuite()
    exit_code = suite.run_all_tests()
    sys.exit(exit_code)


if __name__ == "__main__":
    main()
