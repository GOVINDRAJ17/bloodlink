"use client";
import { useState, useEffect } from "react";
import data from "@/../assets/district_data.json";
import axios from "axios";

const bloodComponents = {
    "Whole Blood": 11,
    "Packed Red Blood Cells": 12,
    "Fresh Frozen Plasma": 13,
    "Single Donor Platelet": 14,
    "Platelet Rich Plasma": 16,
    "Cryoprecipitate": 17,
    "Single Donor Plasma": 18,
    "Plasma": 19,
    "Platelet Concentrate": 20,
    "Cryo Poor Plasma": 21,
    "Random Donor Platelets": 23,
    "Sagm Packed Red Blood Cells": 28,
    "Irradiated RBC": 29,
    "Leukoreduced Rbc": 30
};
const bloodGroups = {
    "A-Ve": 12,
    "B+Ve": 13,
    "B-Ve": 14,
    "O+Ve": 15,
    "AB+Ve": 17,
    "AB-Ve": 18,
    "A+Ve": 11,
    "O-Ve": 16,
    "Oh+VE": 22,
    "Oh-VE": 23
};

export default function Search() {
    const states = data.statesWithDistricts;
    const [stateCode, setStateCode] = useState("");
    const [districtCode, setDistrictCode] = useState("");
    const [districts, setDistricts] = useState([]);
    const [bloodComponentId, setBloodComponentId] = useState();
    const [bloodGroupId, setBloodGroupId] = useState("");
    const [loaded, setLoaded] = useState(false);
    const [loading, setLoading] = useState(false);
    const [searchResults, setSearchResults] = useState([]);
    const [coords, setCoords] = useState(null)
    const [error, setError] = useState("")
    const [locationSearchResults, setLocationSearchResults] = useState([]);

    useEffect(() => { //geolocation fetching
        if (!navigator.geolocation) {
            setError("Geolocation not supported");
            return;
        }

        navigator.geolocation.getCurrentPosition(
            (pos) => setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
            (err) => setError(err.message),
            { enableHighAccuracy: true }
        );
    }, []);

    useEffect(() => { //update districts when state changes
        const selectedState = states.find(s => s.stateCode === stateCode);

        if (selectedState) {
            setDistricts(selectedState.districts);
            setDistrictCode("");
        } else {
            setDistricts([]);
        }
    }, [stateCode, states]);


    const handleSearchWithLocation = async (getCurrentPosition, bloodComponentId, bloodGroupId) => {
        setLoading(true);
        if (!coords) {
            alert("Failed to get location. Please allow location access and try again.");
            console.log(error);
            return;
        }
        setSearchResults([]);
        const params = new URLSearchParams();
        if (coords.lat) params.append("latitude", coords.lat);
        else {
            alert("Failed to get location. Please allow location access and try again.");
            setLoading(false);
            return;
        }
        if (coords.lng) params.append("longitude", coords.lng);
        params.append("radius", 50000);
        // if (bloodComponentId) params.append("ComponentId", bloodComponentId);
        // if (bloodGroupId) params.append("bloodGroupId", bloodGroupId);
        console.log(params.toString());
        const response = await axios.get(`/api/nearest?${params.toString()}`, {});
        if (response.status !== 200) {
            alert("Failed to fetch data. Please try again later.");
            setLoading(false);
            return;
        }
        console.log(response.data);
        setLoading(false);
        setLoaded(true);
        setLocationSearchResults(Array.isArray(response.data) ? response.data : []);
    };

    const handleSearch = async (stateCode, districtCode, bloodComponentId, bloodGroupId) => {
        setLoading(true);
        setLocationSearchResults([]);
        const params = new URLSearchParams();
        if (stateCode) params.append("stateCode", stateCode);
        else {
            setLoading(false);
            alert("Please select a state.");
            return;
        }
        if (districtCode) params.append("districtCode", districtCode);
        if (bloodComponentId) params.append("ComponentId", bloodComponentId);
        if (bloodGroupId) params.append("bloodGroupId", bloodGroupId);
        console.log(params.toString());
        const response = await axios.get(`/api/search?${params.toString()}`, {});
        console.log(response.data);
        setLoading(false);
        if (response.status === 200) {
            setLoaded(true);
            setSearchResults(Array.isArray(response.data) ? response.data : []);
        }
        else
            alert("Failed to fetch data. Please try again later.");

    };

    const getInfo = async (hospitalCode, stateCode) => {
        const response = await axios.get(`/api/search?stateCode=${stateCode}&hospitalCodes=${hospitalCode}`);
        console.log(response.data);
    };

    return (
        <div className="flex flex-col gap-4 p-10">
            <select //blood component dropdown
                value={bloodComponentId}
                onChange={(e) => setBloodComponentId(e.target.value)}
            >
                <option value="">Select Blood Component</option>
                {Object.entries(bloodComponents).map(([name, code]) => (
                    <option key={code} value={code}>
                        {name}
                    </option>
                ))}
            </select>
            <select //blood group dropdown
                value={bloodGroupId}
                onChange={(e) => setBloodGroupId(e.target.value)}
            >
                <option value="">Select Blood Group</option>
                {Object.entries(bloodGroups).map(([name, code]) => (
                    <option key={code} value={code}>
                        {name}
                    </option>
                ))}
            </select>
            <select //state dropdown
                value={stateCode}
                onChange={(e) => setStateCode(e.target.value)}
            >
                <option value="">Select State</option>
                {states.map((state) => (
                    <option key={state.stateCode} value={state.stateCode}>
                        {state.stateName}
                    </option>
                ))}
            </select>

            <select //district dropdown
                value={districtCode}
                onChange={(e) => setDistrictCode(e.target.value)}
                disabled={!stateCode}
            >
                <option value="">Select District</option>
                {districts.map((district) => (
                    <option key={district.districtCode} value={district.districtCode}>
                        {district.districtName}
                    </option>
                ))}
            </select>

            <button //search button
                onClick={() => handleSearch(stateCode, districtCode, bloodComponentId, bloodGroupId)}
                disabled={loading}
                className="bg-blue-500 text-white px-4 py-2 rounded"
            >
                {loading ? "Searching..." : "Search"}
            </button>

            <button //location search button
                onClick={() => handleSearchWithLocation(coords, bloodComponentId, bloodGroupId)}
                disabled={loading}
                className="bg-blue-500 text-white px-4 py-2 rounded"
            >
                Search with current location instead
            </button>

            {loaded && searchResults.length === 0 && locationSearchResults.length === 0 && (
                <p>No results found.</p>
            )}
            {loaded && searchResults.length > 0 && (
                <div>
                    <h2 className="text-xl font-bold mb-2">Search Results:</h2>
                    <ul>
                        {searchResults.map((result, idx) => (
                            <li key={result.hospitalCode || idx} className="p-4 border-b">
                                <h3 className="font-bold">{result.hospitalname || result.name}</h3>
                                <p className="text-sm text-gray-600">{result.hospitaladd || result.address}</p>

                                <div className="mt-2 flex flex-wrap gap-2">
                                    {Object.entries(result.components || {}).map(([name, info]) => {
                                        const isAvailable = info?.available_WithQty && info.available_WithQty.trim() !== "";
                                        return isAvailable ? (
                                            <span key={name} className="bg-green-100 text-green-800 px-2 py-1 rounded text-xs">
                                                <strong>{name}:</strong> {info.available_WithQty}
                                            </span>
                                        ) : null;
                                    })}
                                </div>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
            {loaded && locationSearchResults.length > 0 && (
                <div>
                    <h2 className="text-xl font-bold mb-2">Search Results based on location:</h2>
                    <ul>
                        {locationSearchResults.map((result, idx) => (
                            <li key={result.hospitalCode || idx} className="p-4 border-b">
                                <h3 className="font-bold">{result.name || result.hospitalname}</h3>
                                <p className="text-sm text-gray-600">{result.address || result.hospitaladd} {result.dist ? `• ${round(result.dist / 1000, 2)} km` : ""}</p>
                                <button onClick={() => getInfo(result.hospitalCode, result.stateCode)}
                                    className="bg-green-500 text-white px-3 py-1 text-xs rounded mt-1">
                                    Get detailed stock
                                </button>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
}
function round(value, decimals) {
    return Number(Math.round(value + 'e' + decimals) + 'e-' + decimals);
}//make inline