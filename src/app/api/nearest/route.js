import { NextResponse } from 'next/server';
import axios from 'axios';

// In-memory cache for nearest API responses (TTL: 5 minutes)
const cache = new Map();
const CACHE_TTL = 5 * 60 * 1000;

export async function GET(request) {
    const { searchParams } = new URL(request.url);
    const api_url = process.env.NEXT_PUBLIC_API_URL || "https://eraktkosh.mohfw.gov.in/eraktkoshPortal/eraktkosh/";

    // Support both latitude/lat and longitude/lng parameter names
    const lat = searchParams.get("latitude") || searchParams.get("lat");
    const lng = searchParams.get("longitude") || searchParams.get("lng");

    if (!lat || !lng) {
        return NextResponse.json({ error: "Latitude and Longitude query parameters are required" }, { status: 400 });
    }

    let radius = parseInt(searchParams.get("radius") || "50000", 10);
    if (isNaN(radius) || radius < 10000) {
        radius = 50000;
    }

    const cacheKey = `${lat}_${lng}_${radius}`;
    const cached = cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        return NextResponse.json(cached.data);
    }

    const headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json',
    };

    try {
        const queryUrl = `${api_url}bloodbank/nearest?latitude=${lat}&longitude=${lng}&radius=${radius}`;
        let response = await axios.get(queryUrl, { headers, timeout: 15000 });
        let data = response.data;

        // If 0 results found at current radius and radius < 100km, auto-expand to 100km
        if ((!Array.isArray(data) || data.length === 0) && radius < 100000) {
            try {
                const retryUrl = `${api_url}bloodbank/nearest?latitude=${lat}&longitude=${lng}&radius=100000`;
                const retryRes = await axios.get(retryUrl, { headers, timeout: 15000 });
                if (Array.isArray(retryRes.data) && retryRes.data.length > 0) {
                    data = retryRes.data;
                }
            } catch (retryErr) {
                console.warn("Radius expansion retry failed:", retryErr.message);
            }
        }

        if (Array.isArray(data) && data.length > 0) {
            cache.set(cacheKey, { timestamp: Date.now(), data });
            return NextResponse.json(data);
        }

        // Return empty array when no facilities are found in radius
        return NextResponse.json([], { status: 200 });

    } catch (error) {
        console.warn('Error fetching data from eRaktKosh nearest:', error.message);
        return NextResponse.json([], { status: 200 });
    }
}
