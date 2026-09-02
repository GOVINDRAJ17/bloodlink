import os
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import Optional, Dict
from model import ShortagePredictionModel

app = FastAPI(
    title="BloodLink AI ML Shortage Service",
    description="Time-series blood shortage prediction and demand forecasting API",
    version="1.0.0"
)

model = ShortagePredictionModel()

class PredictRequest(BaseModel):
    location_name: Optional[str] = "Central District"
    inventory_stock: Optional[Dict[str, int]] = {}
    historical_requests_count: Optional[Dict[str, int]] = {}

@app.get("/health")
def health_check():
    return {
        "status": "healthy",
        "service": "bloodlink-ml-shortage-prediction",
        "model_version": "1.0.0"
    }

@app.post("/predict")
def run_predictions(payload: PredictRequest):
    try:
        stock = payload.inventory_stock or {}
        counts = payload.historical_requests_count or {}
        predictions = model.predict_all_groups(stock, counts, payload.location_name or "Central District")
        
        critical_count = sum(1 for p in predictions if p["shortage_risk"] == "CRITICAL")
        high_count = sum(1 for p in predictions if p["shortage_risk"] == "HIGH")

        return {
            "success": True,
            "location_name": payload.location_name,
            "summary": {
                "total_groups_analyzed": len(predictions),
                "critical_risk_count": critical_count,
                "high_risk_count": high_count,
                "overall_status": "CRITICAL_SHORTAGE_WARNING" if critical_count > 0 else "NORMAL"
            },
            "predictions": predictions
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
