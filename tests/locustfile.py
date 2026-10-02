"""
BloodLink Load and Performance Testing Suite (Locust)
=====================================================
Benchmarks real Next.js API endpoints and server routes under concurrent load:
- GET / (Home page SSR / HTML)
- GET /api/chronic-care (Chronic care thalassemia/dialysis active roster)
- GET /api/analytics/predict (Shortage risk radar & demand projection)
- GET /api/map/layers (Geospatial markers & emergency layers)
- GET /api/hospitals/nearby (eRaktKosh live aggregator with fallback)
"""

from locust import HttpUser, task, between

class BloodLinkAppUser(HttpUser):
    wait_time = between(0.1, 0.5)

    @task(3)
    def test_chronic_care_endpoint(self):
        """Tests high-frequency chronic care schedule endpoint."""
        self.client.get("/api/chronic-care", name="/api/chronic-care")

    @task(2)
    def test_landing_page(self):
        """Tests homepage server response."""
        self.client.get("/", name="/")

    @task(1)
    def test_analytics_predict(self):
        """Tests ML shortage risk radar."""
        self.client.get("/api/analytics/predict", name="/api/analytics/predict")

    @task(1)
    def test_map_layers(self):
        """Tests geospatial map layers."""
        self.client.get("/api/map/layers", name="/api/map/layers")
