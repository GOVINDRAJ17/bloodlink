"""
Catalog and Integration Feasibility Analysis of Indian Public Health Datasets
============================================================================
Documents verified public datasets for augmenting BloodLink's facility registry,
contact coordinates, and demographic blood requirement forecasting.

Includes:
- Official Source & Publisher
- Real URL & Licensure Constraints
- Geographical Coverage & Update Cadence (Flagged with [VERIFY BEFORE CITING])
- Overlapping / Duplicate Fields
- Architectural Merging Strategy & Value Proposition
"""

from typing import List, Dict, Any

ADDITIONAL_DATASETS_CATALOG: List[Dict[str, Any]] = [
    {
        "name": "eRaktKosh National Blood Bank Directory & Stock Status",
        "source": "Open Government Data (OGD) Platform India / Ministry of Health & Family Welfare",
        "url": "https://www.data.gov.in/resource/blood-bank-directory / https://eraktkosh.mohfw.gov.in/BLDAHIMS/bloodbank/stockAvailability.cnt",
        "publisher": "Ministry of Health and Family Welfare (MoHFW) / Centre for Development of Advanced Computing (C-DAC)",
        "coverage": "~4,487 licensed blood banks across 36 States/UTs [VERIFY BEFORE CITING - portal directory snapshot count; live number varies daily]",
        "update_frequency": "Directory: Periodic / Monthly; Stock telemetry: Near Real-Time where hospitals update [VERIFY BEFORE CITING]",
        "relevant_fields": [
            "hospitalCode", "hospitalname", "hospitaladd", "stateCode", "districtCode",
            "hospitalcontact", "hospitalType", "latitude", "longitude", "components", "bloodGroupAvailable"
        ],
        "license_constraints": "National Data Sharing and Accessibility Policy (NDSAP) / Government Open Data License - India (GODL-India) [VERIFY BEFORE CITING]",
        "integration_feasibility": "HIGH (Native API connector active in BloodLink)",
        "potential_duplicate_fields": ["hospitalCode", "hospitalname", "hospitalcontact", "hospitaladd"],
        "merge_strategy": "Serves as Primary Ground Truth for facility licensing and real-time component availability. Merged via deterministic hospitalCode matching with fuzzy name backup.",
        "value_proposition": "Essential core registry providing regulatory licensing validation and live component availability across government and trust blood banks."
    },
    {
        "name": "National Health Portal (NHP) Hospital Directory",
        "source": "Open Government Data Platform India (data.gov.in)",
        "url": "https://www.data.gov.in/resource/all-india-hospital-directory",
        "publisher": "National Institute of Health and Family Welfare (NIHFW) / MoHFW",
        "coverage": ">35,000 public and private healthcare facilities [VERIFY BEFORE CITING - exact count depends on data.gov.in resource release date]",
        "update_frequency": "Periodic government releases [VERIFY BEFORE CITING]",
        "relevant_fields": [
            "Hospital_Name", "State", "District", "Address", "Pincode", "Telephone",
            "Emergency_Services", "Blood_Bank_Available_Flag", "Latitude", "Longitude"
        ],
        "license_constraints": "Government Open Data License - India (GODL-India) [VERIFY BEFORE CITING]",
        "integration_feasibility": "HIGH (Tabular CSV / CKAN API ingestion via data.gov.in)",
        "potential_duplicate_fields": ["Hospital_Name", "Address", "Telephone", "Latitude", "Longitude"],
        "merge_strategy": "Used to enrich eRaktKosh facilities with verified hospital phone exchanges, emergency department direct lines, and precise street addresses via spatial distance join (< 200m).",
        "value_proposition": "Enables emergency contact enrichment and identifies hospitals with trauma centers requiring continuous blood corridor links."
    },
    {
        "name": "Ayushman Bharat PMJAY Empanelled Hospital Registry",
        "source": "National Health Authority (NHA) Hospital Search Registry",
        "url": "https://hospitals.pmjay.gov.in/Search/empnlValData.htm",
        "publisher": "National Health Authority (NHA), Government of India",
        "coverage": "~28,000 empanelled tertiary and secondary care hospitals [VERIFY BEFORE CITING - fluctuates dynamically on official portal]",
        "update_frequency": "Dynamic / Monthly portal refreshes [VERIFY BEFORE CITING]",
        "relevant_fields": [
            "Hospital_ID", "Hospital_Name", "State", "District", "Hospital_Type",
            "Specialties_Covered", "NABH_Accreditation_Status", "Contact_Number"
        ],
        "license_constraints": "Public domain government beneficiary registry; programmatic extraction subject to NHA terms [VERIFY BEFORE CITING]",
        "integration_feasibility": "MEDIUM (Periodic web harvesting or official NHA partnership)",
        "potential_duplicate_fields": ["Hospital_Name", "District", "Contact_Number"],
        "merge_strategy": "Correlates hospital facilities with NABH/NABL accreditation status. Links to BloodLink reliability score $S_{rel}$: NABH accredited facilities receive top reliability tier (1.0).",
        "value_proposition": "Directly empowers the ranking engine's institutional reliability factor with government-verified accreditation data."
    },
    {
        "name": "OpenStreetMap (OSM) India Healthcare Amenities Layer",
        "source": "OpenStreetMap Contributors / Geofabrik Asia / India Regional Extract",
        "url": "https://download.geofabrik.de/asia/india.html / https://overpass-turbo.eu",
        "publisher": "OpenStreetMap Foundation (OSMF)",
        "coverage": "Crowdsourced healthcare amenities across all Indian States & UTs [VERIFY BEFORE CITING - uncurated crowdsourced coverage]",
        "update_frequency": "Continuous Community Contribution (Daily diffs via Geofabrik)",
        "relevant_fields": [
            "amenity=hospital", "amenity=blood_bank", "healthcare=blood_bank",
            "emergency=yes", "name", "addr:street", "addr:city", "addr:postcode", "geometry"
        ],
        "license_constraints": "Open Database License (ODbL) 1.0 (attribution and share-alike mandatory)",
        "integration_feasibility": "HIGH (Overpass API or shapefile extraction using geopandas)",
        "potential_duplicate_fields": ["name", "addr:street", "coordinates"],
        "merge_strategy": "Geographic enrichment layer: Imputes missing coordinates for eRaktKosh facilities with null coordinates by matching facility names against OSM amenity points within the same district.",
        "value_proposition": "Resolves missing GPS coordinates for rural blood centres that lack geocoding in official text registries."
    },
    {
        "name": "State Blood Transfusion Council (SBTC) Maharashtra Directory",
        "source": "State Blood Transfusion Council (SBTC), Public Health Department, Govt of Maharashtra",
        "url": "https://sbtc.maharashtra.gov.in",
        "publisher": "State Blood Transfusion Council (SBTC) Maharashtra",
        "coverage": "~350 blood centres in Maharashtra [VERIFY BEFORE CITING - based on SBTC annual reports and regulatory rosters]",
        "update_frequency": "Annual / Bi-Annual [VERIFY BEFORE CITING]",
        "relevant_fields": [
            "Blood_Bank_Name", "License_Number", "Valid_Upto", "Medical_Officer_InCharge",
            "Component_Facility_Available", "Apherisis_Facility", "Contact_Person", "Mobile"
        ],
        "license_constraints": "State Government Public Record for informational use [VERIFY BEFORE CITING]",
        "integration_feasibility": "MEDIUM (Tabular HTML/PDF rosters requiring scraping)",
        "potential_duplicate_fields": ["Blood_Bank_Name", "License_Number", "Mobile"],
        "merge_strategy": "Enriches component separation tags (Single Donor Platelets / Apheresis availability) which are frequently unlisted in national registries.",
        "value_proposition": "Critical for rare component emergency triage (SDP Platelets and Cryoprecipitate for acute dengue and hemophilia crises)."
    },
    {
        "name": "Census of India District Population Indicators",
        "source": "Office of the Registrar General & Census Commissioner / data.gov.in",
        "url": "https://censusindia.gov.in / https://www.data.gov.in",
        "publisher": "Ministry of Home Affairs / Ministry of Statistics and Programme Implementation",
        "coverage": "700+ Administrative Districts nationwide [VERIFY BEFORE CITING - administrative district boundaries vary by census year]",
        "update_frequency": "Decennial Census / Periodic Survey Projections [VERIFY BEFORE CITING]",
        "relevant_fields": [
            "District_Code", "Total_Population", "Sex_Ratio", "Urban_Rural_Ratio",
            "Hospital_Beds_Per_Thousand", "Trauma_Incidence_Rate"
        ],
        "license_constraints": "Government Open Data License - India (GODL-India) [VERIFY BEFORE CITING]",
        "integration_feasibility": "HIGH (Clean standardized CSV tables)",
        "potential_duplicate_fields": ["District_Code"],
        "merge_strategy": "Joined with `assets/district_data.json` via districtCode to establish baseline emergency demand priors for BloodLink's machine learning shortage forecast model.",
        "value_proposition": "Supplies demographic volume priors for machine learning demand forecasting, normalizing blood shortage alerts by local population density."
    }
]

def get_catalog_summary() -> List[Dict[str, str]]:
    return [
        {
            "name": d["name"],
            "publisher": d["publisher"],
            "coverage": d["coverage"],
            "license": d["license_constraints"][:50] + "...",
            "feasibility": d["integration_feasibility"],
            "value": d["value_proposition"][:75] + "..."
        }
        for d in ADDITIONAL_DATASETS_CATALOG
    ]
