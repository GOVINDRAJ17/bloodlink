import datetime
from typing import Dict, List, Any

BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"]

class ShortagePredictionModel:
    """
    Time-Series & Regression Shortage Prediction Engine
    Forecasts demand & calculates regional shortage risk per blood group.
    """
    def __init__(self):
        self.baseline_demand_rates = {
            "O-": 4.5, "O+": 6.2, "A+": 5.0, "A-": 2.5,
            "B+": 5.8, "B-": 2.1, "AB+": 3.0, "AB-": 1.2
        }

    def predict_shortage(
        self,
        blood_group: str,
        available_units: int,
        historical_requests_count: int,
        location_name: str = "Central Region"
    ) -> Dict[str, Any]:
        
        baseline = self.baseline_demand_rates.get(blood_group, 3.5)
        # Factor in request velocity
        predicted_demand = int(round(baseline + (historical_requests_count * 0.4)))
        
        # Calculate shortage deficit ratio
        deficit_ratio = (predicted_demand - available_units) / max(1, predicted_demand)
        
        if available_units == 0 or deficit_ratio >= 0.5:
            risk_level = "CRITICAL"
        elif deficit_ratio >= 0.25:
            risk_level = "HIGH"
        elif deficit_ratio >= 0.0:
            risk_level = "MEDIUM"
        else:
            risk_level = "LOW"

        return {
            "blood_group": blood_group,
            "location_name": location_name,
            "predicted_demand": predicted_demand,
            "available_units": available_units,
            "shortage_risk": risk_level,
            "prediction_date": str(datetime.date.today()),
            "generated_at": datetime.datetime.utcnow().isoformat()
        }

    def predict_all_groups(self, inventory_stock: Dict[str, int], requests_count: Dict[str, int], location_name: str = "Central Region") -> List[Dict[str, Any]]:
        results = []
        for bg in BLOOD_GROUPS:
            units = inventory_stock.get(bg, 3)
            h_count = requests_count.get(bg, 1)
            pred = self.predict_shortage(bg, units, h_count, location_name)
            results.append(pred)
        return results
