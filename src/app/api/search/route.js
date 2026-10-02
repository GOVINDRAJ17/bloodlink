import { NextResponse } from 'next/server';
import axios from 'axios';

// In-memory cache for search responses (TTL: 5 minutes)
const searchCache = new Map();
const CACHE_TTL = 5 * 60 * 1000;

export async function GET(request) {
    const { searchParams } = new URL(request.url);
    const queryString = searchParams.toString();
    const districtName = (searchParams.get("districtName") || "").toLowerCase().trim();
    const api_url = process.env.NEXT_PUBLIC_API_URL || "https://eraktkosh.mohfw.gov.in/eraktkoshPortal/eraktkosh/";

    if (!queryString) {
        return NextResponse.json({ error: 'No query parameters provided' }, { status: 400 });
    }

    const cached = searchCache.get(queryString);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        return NextResponse.json(cached.data);
    }

    try {
        console.log(`Calling eRaktKosh search: ${api_url}blood-availability?${queryString}`);
        const response = await axios.get(
            `${api_url}blood-availability?${queryString}`,
            {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    'Accept': 'application/json'
                },
                timeout: 15000
            }
        );

        let data = response.data;
        if (!Array.isArray(data)) {
            data = [];
        }

        // If districtName filter is provided, filter records by district in hospitaladd
        if (districtName && data.length > 0) {
            const districtFiltered = data.filter(item => {
                const addr = (item.hospitaladd || "").toLowerCase();
                const name = (item.hospitalname || "").toLowerCase();
                return addr.includes(districtName) || name.includes(districtName);
            });
            if (districtFiltered.length > 0) {
                data = districtFiltered;
            }
        }

        searchCache.set(queryString, { timestamp: Date.now(), data });
        return NextResponse.json(data);

    } catch (error) {
        console.error('Error fetching data from eRaktKosh search:', error.message);
        return NextResponse.json([], { status: 200 });
    }
}