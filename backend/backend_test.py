"""
Backend test for BIBI Cars Blog feature
Tests all blog endpoints: public list/single, admin CRUD, login flows
"""
import requests
import sys
from typing import Dict, Any, Optional

BASE_URL = "https://commit-explorer.preview.emergentagent.com"

class BlogAPITester:
    def __init__(self):
        self.base_url = BASE_URL
        self.tests_run = 0
        self.tests_passed = 0
        self.admin_token = None
        self.manager_token = None
        self.teamlead_token = None
        self.created_article_id = None

    def log(self, msg: str):
        print(f"  {msg}")

    def test(self, name: str, condition: bool, details: str = ""):
        """Record test result"""
        self.tests_run += 1
        if condition:
            self.tests_passed += 1
            print(f"✅ {name}")
            if details:
                self.log(details)
        else:
            print(f"❌ {name}")
            if details:
                self.log(f"FAILED: {details}")
        return condition

    def login(self, email: str, password: str) -> Optional[str]:
        """Login and return access_token"""
        try:
            resp = requests.post(
                f"{self.base_url}/api/auth/login",
                json={"email": email, "password": password},
                timeout=10
            )
            if resp.status_code == 200:
                data = resp.json()
                token = data.get("access_token")
                return token
            else:
                self.log(f"Login failed: {resp.status_code} - {resp.text[:200]}")
                return None
        except Exception as e:
            self.log(f"Login exception: {e}")
            return None

    def test_login_flows(self):
        """Test login for admin, manager, team_lead"""
        print("\n🔐 Testing Login Flows")
        
        # Admin login
        self.admin_token = self.login("admin@bibi.cars", "Jp3FS_7ZuE2bhHp7rFkJm9B9T_TeiHxu")
        self.test(
            "Admin login (admin@bibi.cars)",
            self.admin_token is not None,
            f"Token: {self.admin_token[:20]}..." if self.admin_token else "No token"
        )
        
        # Manager login
        self.manager_token = self.login("manager@bibi.cars", "dFbYnse0L59DBE16Mn4kT6cCRaNBZFQR")
        self.test(
            "Manager login (manager@bibi.cars)",
            self.manager_token is not None,
            f"Token: {self.manager_token[:20]}..." if self.manager_token else "No token"
        )
        
        # Team lead login
        self.teamlead_token = self.login("teamlead@bibi.cars", "txXNMkj-lS2w1nv482aLlvKWuk9Y9eKE")
        self.test(
            "Team lead login (teamlead@bibi.cars)",
            self.teamlead_token is not None,
            f"Token: {self.teamlead_token[:20]}..." if self.teamlead_token else "No token"
        )

    def test_public_blog_list(self):
        """Test GET /api/public/blog/articles"""
        print("\n📰 Testing Public Blog List")
        
        try:
            resp = requests.get(
                f"{self.base_url}/api/public/blog/articles?lang=en",
                timeout=10
            )
            
            self.test(
                "GET /api/public/blog/articles returns 200",
                resp.status_code == 200,
                f"Status: {resp.status_code}"
            )
            
            if resp.status_code == 200:
                data = resp.json()
                items = data.get("items", [])
                
                self.test(
                    "Returns >= 8 articles",
                    len(items) >= 8,
                    f"Found {len(items)} articles"
                )
                
                if items:
                    first = items[0]
                    has_tags = "tags" in first and isinstance(first.get("tags"), list)
                    has_read_time = "read_time_minutes" in first
                    has_published_at = "published_at" in first
                    
                    self.test(
                        "Articles have 'tags' as array",
                        has_tags,
                        f"tags field: {first.get('tags', 'MISSING')}"
                    )
                    
                    self.test(
                        "Articles have 'read_time_minutes'",
                        has_read_time,
                        f"read_time_minutes: {first.get('read_time_minutes', 'MISSING')}"
                    )
                    
                    self.test(
                        "Articles have 'published_at' (ISO format)",
                        has_published_at and isinstance(first.get("published_at"), str),
                        f"published_at: {first.get('published_at', 'MISSING')}"
                    )
                    
                    # Check for placeholder titles
                    placeholder_titles = ["dummy", "lorem", "test", "placeholder"]
                    real_articles = [
                        item for item in items
                        if not any(p in item.get("title", "").lower() for p in placeholder_titles)
                    ]
                    
                    self.test(
                        "No placeholder articles (Dummy, Lorem, Test)",
                        len(real_articles) == len(items),
                        f"Real articles: {len(real_articles)}/{len(items)}"
                    )
                    
        except Exception as e:
            self.test("GET /api/public/blog/articles", False, f"Exception: {e}")

    def test_tag_filtering(self):
        """Test GET /api/public/blog/articles?tag=copart"""
        print("\n🏷️  Testing Tag Filtering")
        
        try:
            resp = requests.get(
                f"{self.base_url}/api/public/blog/articles?tag=copart",
                timeout=10
            )
            
            self.test(
                "GET /api/public/blog/articles?tag=copart returns 200",
                resp.status_code == 200,
                f"Status: {resp.status_code}"
            )
            
            if resp.status_code == 200:
                data = resp.json()
                items = data.get("items", [])
                
                self.test(
                    "Returns >= 1 article with 'copart' tag",
                    len(items) >= 1,
                    f"Found {len(items)} articles with 'copart' tag"
                )
                
                if items:
                    # Verify the tag is actually present
                    first = items[0]
                    tags = first.get("tags", [])
                    has_copart = any("copart" in str(t).lower() for t in tags)
                    self.test(
                        "Article contains 'copart' in tags",
                        has_copart,
                        f"Tags: {tags}"
                    )
                    
        except Exception as e:
            self.test("Tag filtering", False, f"Exception: {e}")

    def test_bilingual_content(self):
        """Test GET /api/public/blog/articles/{slug}?lang=bg returns Bulgarian content"""
        print("\n🌐 Testing Bilingual Content")
        
        slug = "usa-salvage-car-prices-hit-3-year-low-the-best-buying-window-in-a-decade"
        
        try:
            resp = requests.get(
                f"{self.base_url}/api/public/blog/articles/{slug}?lang=bg",
                timeout=10
            )
            
            self.test(
                f"GET /api/public/blog/articles/{slug}?lang=bg returns 200",
                resp.status_code == 200,
                f"Status: {resp.status_code}"
            )
            
            if resp.status_code == 200:
                data = resp.json()
                title = data.get("title", "")
                
                # Check for Cyrillic characters (Bulgarian)
                has_cyrillic = any('\u0400' <= c <= '\u04FF' for c in title)
                
                self.test(
                    "Bulgarian article has Cyrillic title",
                    has_cyrillic,
                    f"Title: {title[:50]}..."
                )
                
        except Exception as e:
            self.test("Bilingual content", False, f"Exception: {e}")

    def test_admin_endpoints_auth(self):
        """Test admin endpoints require proper role"""
        print("\n🔒 Testing Admin Endpoint Authorization")
        
        # Test without token
        try:
            resp = requests.get(
                f"{self.base_url}/api/admin/blog/articles",
                timeout=10
            )
            self.test(
                "GET /api/admin/blog/articles without token returns 401",
                resp.status_code == 401,
                f"Status: {resp.status_code}"
            )
        except Exception as e:
            self.test("Admin endpoint without token", False, f"Exception: {e}")
        
        # Test with manager token (should get 403)
        if self.manager_token:
            try:
                resp = requests.get(
                    f"{self.base_url}/api/admin/blog/articles",
                    headers={"Authorization": f"Bearer {self.manager_token}"},
                    timeout=10
                )
                self.test(
                    "Manager gets 403 on admin blog endpoint",
                    resp.status_code == 403,
                    f"Status: {resp.status_code}"
                )
            except Exception as e:
                self.test("Manager access to admin endpoint", False, f"Exception: {e}")
        
        # Test with team_lead token (should get 403)
        if self.teamlead_token:
            try:
                resp = requests.get(
                    f"{self.base_url}/api/admin/blog/articles",
                    headers={"Authorization": f"Bearer {self.teamlead_token}"},
                    timeout=10
                )
                self.test(
                    "Team lead gets 403 on admin blog endpoint",
                    resp.status_code == 403,
                    f"Status: {resp.status_code}"
                )
            except Exception as e:
                self.test("Team lead access to admin endpoint", False, f"Exception: {e}")
        
        # Test with admin token (should get 200)
        if self.admin_token:
            try:
                resp = requests.get(
                    f"{self.base_url}/api/admin/blog/articles",
                    headers={"Authorization": f"Bearer {self.admin_token}"},
                    timeout=10
                )
                self.test(
                    "Admin gets 200 on admin blog endpoint",
                    resp.status_code == 200,
                    f"Status: {resp.status_code}"
                )
            except Exception as e:
                self.test("Admin access to admin endpoint", False, f"Exception: {e}")

    def test_admin_create_article(self):
        """Test POST /api/admin/blog/articles creates article with tags"""
        print("\n✍️  Testing Admin Create Article")
        
        if not self.admin_token:
            self.test("Admin create article", False, "No admin token available")
            return
        
        article_data = {
            "category": "tips",
            "title": {
                "en": "Test Article from Backend Test",
                "bg": "Тестова статия от Backend Test"
            },
            "excerpt": {
                "en": "This is a test article created by the backend test suite.",
                "bg": "Това е тестова статия, създадена от backend test suite."
            },
            "body": {
                "en": "<p>This is test content for the backend test.</p>",
                "bg": "<p>Това е тестово съдържание за backend теста.</p>"
            },
            "tags": ["test", "backend", "automation"],
            "published": True
        }
        
        try:
            resp = requests.post(
                f"{self.base_url}/api/admin/blog/articles",
                json=article_data,
                headers={"Authorization": f"Bearer {self.admin_token}"},
                timeout=10
            )
            
            self.test(
                "POST /api/admin/blog/articles returns 200",
                resp.status_code == 200,
                f"Status: {resp.status_code}"
            )
            
            if resp.status_code == 200:
                data = resp.json()
                self.created_article_id = data.get("id")
                
                self.test(
                    "Created article has 'id'",
                    self.created_article_id is not None,
                    f"ID: {self.created_article_id}"
                )
                
                self.test(
                    "Created article has 'tags' as array",
                    isinstance(data.get("tags"), list),
                    f"Tags: {data.get('tags')}"
                )
                
                # Verify we can GET the created article
                if self.created_article_id:
                    get_resp = requests.get(
                        f"{self.base_url}/api/admin/blog/articles/{self.created_article_id}",
                        headers={"Authorization": f"Bearer {self.admin_token}"},
                        timeout=10
                    )
                    
                    self.test(
                        "GET created article returns 200",
                        get_resp.status_code == 200,
                        f"Status: {get_resp.status_code}"
                    )
                    
        except Exception as e:
            self.test("Admin create article", False, f"Exception: {e}")

    def cleanup(self):
        """Delete test article if created"""
        if self.created_article_id and self.admin_token:
            try:
                resp = requests.delete(
                    f"{self.base_url}/api/admin/blog/articles/{self.created_article_id}",
                    headers={"Authorization": f"Bearer {self.admin_token}"},
                    timeout=10
                )
                if resp.status_code == 200:
                    print(f"\n🧹 Cleaned up test article {self.created_article_id}")
            except Exception as e:
                print(f"\n⚠️  Failed to cleanup test article: {e}")

    def run_all_tests(self):
        """Run all backend tests"""
        print("=" * 70)
        print("BIBI Cars Blog Backend API Tests")
        print("=" * 70)
        
        self.test_login_flows()
        self.test_public_blog_list()
        self.test_tag_filtering()
        self.test_bilingual_content()
        self.test_admin_endpoints_auth()
        self.test_admin_create_article()
        
        self.cleanup()
        
        print("\n" + "=" * 70)
        print(f"📊 RESULTS: {self.tests_passed}/{self.tests_run} tests passed")
        print("=" * 70)
        
        return self.tests_passed == self.tests_run


def main():
    tester = BlogAPITester()
    success = tester.run_all_tests()
    return 0 if success else 1


if __name__ == "__main__":
    sys.exit(main())
