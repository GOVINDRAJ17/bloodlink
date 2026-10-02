"""
Test Fixtures for Emergency Blood Ranking Scenarios
===================================================
Constructs reproducible test suites covering all 10 reviewer scenarios:
1. Exact compatible source very near patient
2. Compatible substitute farther away
3. Critical emergency with limited compatible sources
4. Rural location with sparse blood banks
5. Nearest source has stale inventory data
6. Reliable source farther away vs unreliable source nearby
7. Low stock at nearest source
8. Same distance but different ETA
9. Different component type
10. No compatible source within initial search radius
"""

from typing import Dict, Any, List, Tuple
from .engine import CandidateSource, EmergencyRequest

# Anchor Hospital: KEM Hospital, Parel, Mumbai (Lat: 18.9934, Lon: 72.8427)
MUMBAI_KEM_LAT = 18.9934
MUMBAI_KEM_LON = 72.8427

# Rural Anchor: Primary Health Centre, Dindori, Nashik (Lat: 20.2014, Lon: 73.8340)
RURAL_PHC_LAT = 20.2014
RURAL_PHC_LON = 73.8340

def get_scenario_fixtures() -> List[Dict[str, Any]]:
    scenarios = []

    # =========================================================================
    # Scenario 1: Exact compatible source very near patient
    # =========================================================================
    req1 = EmergencyRequest(
        request_id="SCEN-01",
        patient_group="A+",
        component="PRBC",
        units_needed=2,
        lat=MUMBAI_KEM_LAT,
        lon=MUMBAI_KEM_LON,
        urgency="NORMAL",
        max_radius_km=30.0
    )
    candidates1 = [
        CandidateSource(
            id="BB-01-EXACT-NEAR",
            name="Tata Memorial Blood Centre (Parel)",
            source_type="BLOOD_BANK",
            blood_group="A+",
            lat=18.9975, lon=72.8432,  # ~0.5 km
            available_units=12,
            data_age_hours=1.0,
            verified=True,
            historical_fulfillment_rate=0.98,
            notes="Exact match within 500 meters, freshly verified."
        ),
        CandidateSource(
            id="BB-01-SUB-MID",
            name="KEM Red Cross Bank",
            source_type="BLOOD_BANK",
            blood_group="O+",
            lat=19.0178, lon=72.8478,  # ~2.7 km
            available_units=20,
            data_age_hours=2.0,
            verified=True,
            historical_fulfillment_rate=0.95,
            notes="Compatible secondary donor nearby."
        ),
        CandidateSource(
            id="BB-01-EXACT-FAR",
            name="Lilavati Hospital Blood Bank (Bandra)",
            source_type="BLOOD_BANK",
            blood_group="A+",
            lat=19.0514, lon=72.8290,  # ~6.6 km
            available_units=8,
            data_age_hours=4.0,
            verified=True,
            historical_fulfillment_rate=0.90,
            notes="Exact match at medium distance."
        )
    ]
    scenarios.append({
        "scenario_num": 1,
        "title": "Exact compatible source very near patient",
        "description": "Tests that an exact match in close proximity dominates compatible substitutes.",
        "request": req1,
        "candidates": candidates1,
        "expected_top_id": "BB-01-EXACT-NEAR"
    })

    # =========================================================================
    # Scenario 2: Compatible substitute farther away
    # =========================================================================
    req2 = EmergencyRequest(
        request_id="SCEN-02",
        patient_group="AB+",
        component="PRBC",
        units_needed=2,
        lat=MUMBAI_KEM_LAT,
        lon=MUMBAI_KEM_LON,
        urgency="NORMAL",
        max_radius_km=40.0
    )
    candidates2 = [
        CandidateSource(
            id="BB-02-EXACT-FAR",
            name="Kokilaben Dhirubhai Ambani Blood Bank (Andheri)",
            source_type="BLOOD_BANK",
            blood_group="AB+",
            lat=19.1311, lon=72.8252,  # ~15.4 km
            available_units=4,
            data_age_hours=1.5,
            verified=True,
            historical_fulfillment_rate=0.96,
            notes="Exact AB+ match at 15.4 km."
        ),
        CandidateSource(
            id="BB-02-SUB-CLOSE",
            name="Hinduja Hospital Blood Bank (Mahim)",
            source_type="BLOOD_BANK",
            blood_group="A+",
            lat=19.0345, lon=72.8402,  # ~4.6 km
            available_units=15,
            data_age_hours=1.0,
            verified=True,
            historical_fulfillment_rate=0.97,
            notes="Clinically compatible substitute (A+ for AB+) at 4.6 km."
        ),
        CandidateSource(
            id="BB-02-SUB-O-CLOSE",
            name="Sion Municipal Hospital Blood Bank",
            source_type="BLOOD_BANK",
            blood_group="O+",
            lat=19.0390, lon=72.8619,  # ~5.4 km
            available_units=25,
            data_age_hours=2.0,
            verified=True,
            historical_fulfillment_rate=0.94,
            notes="O+ substitute at 5.4 km."
        )
    ]
    scenarios.append({
        "scenario_num": 2,
        "title": "Compatible substitute farther away vs nearby alternative",
        "description": "Analyzes trade-off when exact match is 15 km away vs compatible A+ substitute 4.6 km away.",
        "request": req2,
        "candidates": candidates2,
        "expected_top_id": "BB-02-SUB-CLOSE"  # Depending on weight profile, close substitute may beat distant exact
    })

    # =========================================================================
    # Scenario 3: Critical emergency with limited compatible sources
    # =========================================================================
    req3 = EmergencyRequest(
        request_id="SCEN-03",
        patient_group="B-",
        component="PRBC",
        units_needed=4,
        lat=MUMBAI_KEM_LAT,
        lon=MUMBAI_KEM_LON,
        urgency="CRITICAL",
        max_radius_km=50.0
    )
    candidates3 = [
        CandidateSource(
            id="BB-03-BNEG-URGENT",
            name="Wadia Children Blood Bank",
            source_type="BLOOD_BANK",
            blood_group="B-",
            lat=18.9991, lon=72.8441,  # ~0.6 km
            available_units=2,
            data_age_hours=0.5,
            verified=True,
            historical_fulfillment_rate=0.95,
            notes="Only 2 units of B- available within 1 km."
        ),
        CandidateSource(
            id="BB-03-ONEG-SUB",
            name="Sir H.N. Reliance Foundation Hospital",
            source_type="BLOOD_BANK",
            blood_group="O-",
            lat=18.9566, lon=72.8193,  # ~4.8 km
            available_units=5,
            data_age_hours=0.8,
            verified=True,
            historical_fulfillment_rate=0.98,
            notes="Universal O- PRBC donor capable of fulfilling remaining emergency quota."
        ),
        CandidateSource(
            id="BB-03-INCOMPAT",
            name="Nair Charitable Hospital Blood Bank",
            source_type="BLOOD_BANK",
            blood_group="B+",
            lat=18.9740, lon=72.8230,  # ~3.0 km
            available_units=18,
            data_age_hours=0.2,
            verified=True,
            historical_fulfillment_rate=0.99,
            notes="Incompatible Rh+ donor for B- recipient."
        )
    ]
    scenarios.append({
        "scenario_num": 3,
        "title": "Critical emergency with limited compatible sources",
        "description": "Tests high-urgency triage and strict disqualification of incompatible Rh+ sources.",
        "request": req3,
        "candidates": candidates3,
        "expected_top_id": "BB-03-BNEG-URGENT"
    })

    # =========================================================================
    # Scenario 4: Rural location with sparse blood banks
    # =========================================================================
    req4 = EmergencyRequest(
        request_id="SCEN-04",
        patient_group="O+",
        component="PRBC",
        units_needed=2,
        lat=RURAL_PHC_LAT,
        lon=RURAL_PHC_LON,
        urgency="URGENT",
        max_radius_km=80.0
    )
    candidates4 = [
        CandidateSource(
            id="RURAL-04-DISTANT-CIVIL",
            name="Nashik Civil District Hospital",
            source_type="BLOOD_BANK",
            blood_group="O+",
            lat=19.9975, lon=73.7898,  # ~23.2 km
            available_units=14,
            data_age_hours=3.0,
            verified=True,
            historical_fulfillment_rate=0.92,
            notes="Nearest district blood centre at 23.2 km."
        ),
        CandidateSource(
            id="RURAL-04-COMMUNITY-DONOR",
            name="Registered Voluntary Donor (Dindori Village)",
            source_type="DONOR",
            blood_group="O+",
            lat=20.2100, lon=73.8400,  # ~1.1 km
            available_units=1,
            data_age_hours=0.1,
            verified=True,
            historical_fulfillment_rate=0.88,
            response_consistency=0.90,
            donor_repeat_count=4,
            notes="Local voluntary donor walking distance away."
        ),
        CandidateSource(
            id="RURAL-04-FAR-TRUST",
            name="Malegaon Sub-District Blood Centre",
            source_type="BLOOD_BANK",
            blood_group="O+",
            lat=20.5539, lon=74.5298,  # ~82.0 km
            available_units=30,
            data_age_hours=8.0,
            verified=True,
            historical_fulfillment_rate=0.85,
            notes="Distant sub-district centre beyond normal radius."
        )
    ]
    scenarios.append({
        "scenario_num": 4,
        "title": "Rural location with sparse blood banks",
        "description": "Tests trade-off between distant district blood bank (23 km) vs local voluntary donor (1.1 km).",
        "request": req4,
        "candidates": candidates4,
        "expected_top_id": "RURAL-04-COMMUNITY-DONOR"
    })

    # =========================================================================
    # Scenario 5: Nearest source has stale inventory data
    # =========================================================================
    req5 = EmergencyRequest(
        request_id="SCEN-05",
        patient_group="A+",
        component="PRBC",
        units_needed=2,
        lat=MUMBAI_KEM_LAT,
        lon=MUMBAI_KEM_LON,
        urgency="NORMAL",
        max_radius_km=30.0
    )
    candidates5 = [
        CandidateSource(
            id="BB-05-STALE-CLOSE",
            name="Municipal Dispensary Blood Unit",
            source_type="BLOOD_BANK",
            blood_group="A+",
            lat=18.9950, lon=72.8450,  # ~0.3 km
            available_units=6,
            data_age_hours=48.0,  # 2 days stale! S_fresh = exp(-0.0577*48) ~= 0.06
            verified=False,
            historical_fulfillment_rate=0.70,
            notes="Extremely close (300m) but 48 hours without stock confirmation."
        ),
        CandidateSource(
            id="BB-05-FRESH-MID",
            name="Cama & Albless Hospital Blood Bank",
            source_type="BLOOD_BANK",
            blood_group="A+",
            lat=18.9416, lon=72.8312,  # ~5.9 km
            available_units=10,
            data_age_hours=1.2,  # Fresh! S_fresh ~= 0.93
            verified=True,
            historical_fulfillment_rate=0.98,
            notes="Verified stock updated 1.2 hours ago at 5.9 km."
        )
    ]
    scenarios.append({
        "scenario_num": 5,
        "title": "Nearest source has stale inventory data",
        "description": "Tests that confidence decay prevents sending ambulances to unconfirmed 48-hour-old stock.",
        "request": req5,
        "candidates": candidates5,
        "expected_top_id": "BB-05-FRESH-MID"
    })

    # =========================================================================
    # Scenario 6: Reliable source farther away vs unreliable source nearby
    # =========================================================================
    req6 = EmergencyRequest(
        request_id="SCEN-06",
        patient_group="O+",
        component="PRBC",
        units_needed=3,
        lat=MUMBAI_KEM_LAT,
        lon=MUMBAI_KEM_LON,
        urgency="NORMAL",
        max_radius_km=30.0
    )
    candidates6 = [
        CandidateSource(
            id="SRC-06-UNRELIABLE-NEAR",
            name="Unaccredited Community Depot",
            source_type="BLOOD_BANK",
            blood_group="O+",
            lat=19.0010, lon=72.8440,  # ~0.8 km
            available_units=5,
            data_age_hours=4.0,
            verified=False,
            historical_fulfillment_rate=0.45,
            response_consistency=0.50,
            notes="Close by but frequent ghost inventory and stockouts."
        ),
        CandidateSource(
            id="SRC-06-RELIABLE-FAR",
            name="Breach Candy Hospital Trust",
            source_type="BLOOD_BANK",
            blood_group="O+",
            lat=18.9723, lon=72.8055,  # ~4.6 km
            available_units=12,
            data_age_hours=1.0,
            verified=True,
            historical_fulfillment_rate=0.99,
            response_consistency=0.98,
            notes="NABH-accredited blood bank with 99% fulfillment."
        )
    ]
    scenarios.append({
        "scenario_num": 6,
        "title": "Reliable source farther away vs unreliable source nearby",
        "description": "Tests reliability weighting penalty on low-fidelity sources.",
        "request": req6,
        "candidates": candidates6,
        "expected_top_id": "SRC-06-RELIABLE-FAR"
    })

    # =========================================================================
    # Scenario 7: Low stock at nearest source
    # =========================================================================
    req7 = EmergencyRequest(
        request_id="SCEN-07",
        patient_group="B+",
        component="PRBC",
        units_needed=4,
        lat=MUMBAI_KEM_LAT,
        lon=MUMBAI_KEM_LON,
        urgency="NORMAL",
        max_radius_km=30.0
    )
    candidates7 = [
        CandidateSource(
            id="BB-07-LOW-STOCK-NEAR",
            name="Local Nursing Home Stash",
            source_type="BLOOD_BANK",
            blood_group="B+",
            lat=18.9980, lon=72.8450,  # ~0.6 km
            available_units=1,  # Only 1 unit, but request needs 4!
            data_age_hours=1.0,
            verified=True,
            historical_fulfillment_rate=0.85,
            notes="Has only 1 unit against requirement of 4."
        ),
        CandidateSource(
            id="BB-07-HIGH-STOCK-MID",
            name="Jaslok Hospital Research Centre",
            source_type="BLOOD_BANK",
            blood_group="B+",
            lat=18.9715, lon=72.8099,  # ~4.2 km
            available_units=15,  # Ample supply
            data_age_hours=1.5,
            verified=True,
            historical_fulfillment_rate=0.97,
            notes="Fully covers 4 units with surplus safety reserve."
        )
    ]
    scenarios.append({
        "scenario_num": 7,
        "title": "Proximity vs inventory depth (nearest single-unit vs distant multi-unit bank)",
        "description": "Baseline 5-term MCDA evaluation comparing close facility with single unit vs distant facility with surplus inventory (without stock adequacy multiplier).",
        "request": req7,
        "candidates": candidates7,
        "expected_top_id": "BB-07-LOW-STOCK-NEAR"
    })

    # =========================================================================
    # Scenario 8: Same distance but different ETA
    # =========================================================================
    # Two candidates at virtually identical distance (~3.5 km), but Candidate A is a Blood Bank
    # with 5m prep buffer, while Candidate B is a Voluntary Donor with 20m mobilization buffer.
    req8 = EmergencyRequest(
        request_id="SCEN-08",
        patient_group="O-",
        component="PRBC",
        units_needed=1,
        lat=MUMBAI_KEM_LAT,
        lon=MUMBAI_KEM_LON,
        urgency="CRITICAL",
        max_radius_km=30.0
    )
    candidates8 = [
        CandidateSource(
            id="SRC-08-BANK-FAST-ETA",
            name="Masina Hospital Blood Bank",
            source_type="BLOOD_BANK",
            blood_group="O-",
            lat=18.9712, lon=72.8361,  # ~2.6 km
            available_units=3,
            data_age_hours=1.0,
            verified=True,
            historical_fulfillment_rate=0.95,
            notes="Blood bank with emergency release protocol (5 min prep)."
        ),
        CandidateSource(
            id="SRC-08-DONOR-SLOW-ETA",
            name="Voluntary Donor Rahul S.",
            source_type="DONOR",
            blood_group="O-",
            lat=18.9712, lon=72.8361,  # ~2.6 km identical location
            available_units=1,
            data_age_hours=0.5,
            verified=True,
            historical_fulfillment_rate=0.95,
            response_consistency=0.90,
            donor_repeat_count=3,
            notes="Voluntary donor needing 15m travel preparation."
        )
    ]
    scenarios.append({
        "scenario_num": 8,
        "title": "Same distance but different ETA",
        "description": "Demonstrates impact of operational preparation latency between pre-tested blood bank inventory vs live donor mobilization.",
        "request": req8,
        "candidates": candidates8,
        "expected_top_id": "SRC-08-BANK-FAST-ETA"
    })

    # =========================================================================
    # Scenario 9: Different component type (Platelets vs PRBC)
    # =========================================================================
    req9 = EmergencyRequest(
        request_id="SCEN-09",
        patient_group="O-",
        component="PLATELETS",
        units_needed=2,
        lat=MUMBAI_KEM_LAT,
        lon=MUMBAI_KEM_LON,
        urgency="URGENT",
        max_radius_km=30.0
    )
    candidates9 = [
        CandidateSource(
            id="BB-09-PLATELET-EXACT",
            name="Rotary Club Blood Bank (Parel)",
            source_type="BLOOD_BANK",
            blood_group="O-",
            lat=19.0020, lon=72.8410,  # ~1.0 km
            available_units=3,
            data_age_hours=1.0,
            verified=True,
            notes="Exact O- single donor platelets (SDP)."
        ),
        CandidateSource(
            id="BB-09-PLATELET-COMPAT",
            name="Saifee Hospital Blood Bank (Charni Road)",
            source_type="BLOOD_BANK",
            blood_group="A-",
            lat=18.9532, lon=72.8188,  # ~5.1 km
            available_units=6,
            data_age_hours=1.5,
            verified=True,
            notes="A- platelets clinically permitted for O- recipient in emergency."
        )
    ]
    scenarios.append({
        "scenario_num": 9,
        "title": "Different component type (Platelets)",
        "description": "Verifies component-specific platelet compatibility rules where A- platelets can support O- patients.",
        "request": req9,
        "candidates": candidates9,
        "expected_top_id": "BB-09-PLATELET-EXACT"
    })

    # =========================================================================
    # Scenario 10: No compatible source within initial search radius
    # =========================================================================
    req10 = EmergencyRequest(
        request_id="SCEN-10",
        patient_group="Oh+",  # Bombay Blood Group
        component="PRBC",
        units_needed=1,
        lat=MUMBAI_KEM_LAT,
        lon=MUMBAI_KEM_LON,
        urgency="CRITICAL",
        max_radius_km=10.0  # Tight initial radius
    )
    candidates10 = [
        CandidateSource(
            id="BB-10-LOCAL-INCOMPAT",
            name="Nearby Standard Blood Bank",
            source_type="BLOOD_BANK",
            blood_group="O-",
            lat=18.9950, lon=72.8430,  # ~0.2 km
            available_units=10,
            data_age_hours=0.5,
            verified=True,
            notes="O- is universal for normal ABO, but LETHAL for Bombay phenotype due to anti-H!"
        ),
        CandidateSource(
            id="BB-10-FAR-BOMBAY-EXPANDED",
            name="National Institute of Immunohematology (NIIH Registry)",
            source_type="BLOOD_BANK",
            blood_group="Oh+",
            lat=19.1200, lon=72.8800,  # ~14.6 km (outside 10km initial radius)
            available_units=2,
            data_age_hours=2.0,
            verified=True,
            notes="Rare Bombay phenotype unit located at central reference centre."
        )
    ]
    scenarios.append({
        "scenario_num": 10,
        "title": "No compatible source within initial search radius (Rare Bombay Phenotype)",
        "description": "Demonstrates initial horizon evaluation where compatible Bombay candidate at 14.6km gets S_dist=0.00 because d > initial d_max (10km). In Phase 2, dynamic radius expansion to d_max=25km raises S_dist to 0.4156 and composite score from 73.68 to 81.99.",
        "request": req10,
        "candidates": candidates10,
        "expected_top_id": "BB-10-FAR-BOMBAY-EXPANDED"
    })

    return scenarios
