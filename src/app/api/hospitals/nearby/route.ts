import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import axios from "axios";
import { getResilientClient, ErrorCategory } from "@/lib/resilience";
import { DEMO_BLOOD_BANKS, CITYCARE_HOSPITAL } from "@/lib/emergency/demoSeedData";

// Helper to parse eRaktKosh available_WithQty string
// e.g. "AB-Ve : 5, O+Ve : 284, B-Ve : 13, A-Ve : 12, AB+Ve : 48, A+Ve : 180, O-Ve : 15, B+Ve : 263"
function parseAvailableWithQty(str?: string | null): Record<string, number> {
  const stock: Record<string, number> = {
    "A+": 0, "A-": 0, "B+": 0, "B-": 0,
    "AB+": 0, "AB-": 0, "O+": 0, "O-": 0
  };
  if (!str) return stock;

  const parts = str.split(",");
  for (const part of parts) {
    const [grpRaw, qtyRaw] = part.split(":");
    if (grpRaw && qtyRaw) {
      const grp = grpRaw
        .trim()
        .replace(/-Ve/i, "-")
        .replace(/\+Ve/i, "+")
        .replace(/VE/i, "")
        .trim();
      const qty = parseInt(qtyRaw.trim(), 10);
      if (!isNaN(qty)) {
        if (stock[grp] !== undefined) {
          stock[grp] += qty;
        } else {
          stock[grp] = qty;
        }
      }
    }
  }
  return stock;
}

function calculateHaversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

// In-memory index cache for parsed state availability datasets
const stateAvailabilityIndexCache = new Map<
  string,
  { timestamp: number; byCode: Map<string, any>; byName: Map<string, any>; rawList: any[] }
>();
const REGISTRY_CACHE_TTL = 15 * 60 * 1000;

async function getStateAvailabilityMap(stateCode: string, apiUrl: string) {
  const cached = stateAvailabilityIndexCache.get(stateCode);
  if (cached && Date.now() - cached.timestamp < REGISTRY_CACHE_TTL) {
    return cached;
  }

  const client = getResilientClient();
  const cacheKey = `raw_state_avail_${stateCode}`;

  const res = await client.execute<any[]>(
    cacheKey,
    async (signal) => {
      const resp = await axios.get(`${apiUrl}blood-availability?stateCode=${stateCode}`, {
        headers: {
          "User-Agent": "BloodLink-Emergency-App/1.0 (Mozilla/5.0)",
          Accept: "application/json",
        },
        timeout: client.config.timeoutMs,
        signal,
      });
      return resp.data;
    }
  );

  if (res.data && Array.isArray(res.data)) {
    const byCode = new Map<string, any>();
    const byName = new Map<string, any>();
    for (const item of res.data) {
      if (item.hospitalCode) byCode.set(String(item.hospitalCode), item);
      if (item.hospitalname) {
        const clean = item.hospitalname.toLowerCase().trim().replace(/,\s*$/, "");
        byName.set(clean, item);
      }
    }
    const entry = { timestamp: Date.now(), byCode, byName, rawList: res.data };
    stateAvailabilityIndexCache.set(stateCode, entry);
    return entry;
  }

  return null;
}

function getSeedFallbackFacilities(lat: number | null, lng: number | null): any[] {
  const list = [
    {
      id: CITYCARE_HOSPITAL.id,
      name: CITYCARE_HOSPITAL.name,
      address: CITYCARE_HOSPITAL.address,
      phone: CITYCARE_HOSPITAL.phone,
      hospitalType: "Specialized Tertiary Hospital",
      latitude: CITYCARE_HOSPITAL.location.lat,
      longitude: CITYCARE_HOSPITAL.location.lng,
      components: {
        "Packed Red Blood Cells": { available_WithQty: "A+ : 15, B+ : 18, O+ : 22, O- : 2" },
        "Platelets": { available_WithQty: "A+ : 4, B+ : 6, O+ : 8, O- : 2" },
      },
    },
    ...DEMO_BLOOD_BANKS.map((b) => ({
      id: b.id,
      name: b.name,
      address: b.address,
      phone: b.phone,
      hospitalType: "Regional Blood Center",
      latitude: b.location.lat,
      longitude: b.location.lng,
      components: {
        [b.component]: { available_WithQty: `${b.bloodGroup} : ${b.availableUnits}` },
      },
    })),
  ];

  return list.map((item) => {
    const distKm =
      lat !== null && lng !== null && item.latitude && item.longitude
        ? calculateHaversineKm(lat, lng, item.latitude, item.longitude)
        : null;
    return {
      ...item,
      dist: distKm ? distKm * 1000 : 0,
      source: "BloodLink Offline Backup Registry",
    };
  });
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const rawLat = searchParams.get("lat") || searchParams.get("latitude");
    const rawLng = searchParams.get("lng") || searchParams.get("longitude");
    const hasCoords =
      rawLat !== null &&
      rawLng !== null &&
      !isNaN(parseFloat(rawLat)) &&
      !isNaN(parseFloat(rawLng));
    const lat = hasCoords ? parseFloat(rawLat!) : null;
    const lng = hasCoords ? parseFloat(rawLng!) : null;

    const radiusKm = parseFloat(
      searchParams.get("radiusKm") || searchParams.get("radius") || "50"
    );
    const query = (
      searchParams.get("query") ||
      searchParams.get("q") ||
      ""
    )
      .toLowerCase()
      .trim();
    const typeFilter = searchParams.get("type") || "ALL"; // "HOSPITAL" | "BLOOD_BANK" | "ALL"
    const stockCode = searchParams.get("stockCode") || searchParams.get("hospitalCode");
    const stateCode = searchParams.get("stateCode");

    const api_url =
      process.env.NEXT_PUBLIC_API_URL ||
      "https://eraktkosh.mohfw.gov.in/eraktkoshPortal/eraktkosh/";

    const client = getResilientClient();

    // If stockCode is requested, fetch specific hospital stock directly from eRaktKosh with resilience
    if (stockCode && stateCode) {
      try {
        const stockResult = await client.execute(
          `stock_${stateCode}_${stockCode}`,
          async (signal) => {
            const resp = await axios.get(
              `${api_url}blood-availability?stateCode=${stateCode}&hospitalCodes=${stockCode}`,
              {
                headers: {
                  "User-Agent": "BloodLink-Emergency-App/1.0",
                  Accept: "application/json",
                },
                timeout: client.config.timeoutMs,
                signal,
              }
            );
            return resp.data;
          }
        );

        if (Array.isArray(stockResult.data) && stockResult.data.length > 0) {
          const hospData = stockResult.data[0];
          let parsedStock: Record<string, number> = {};
          let componentsList: string[] = [];

          if (hospData.components) {
            componentsList = Object.keys(hospData.components);
            for (const compName of componentsList) {
              const compObj = hospData.components[compName];
              if (compObj?.available_WithQty) {
                const s = parseAvailableWithQty(compObj.available_WithQty);
                for (const [bg, qty] of Object.entries(s)) {
                  parsedStock[bg] = (parsedStock[bg] || 0) + qty;
                }
              }
            }
          }

          if (Object.keys(parsedStock).length === 0 && hospData.available_WithQty) {
            parsedStock = parseAvailableWithQty(hospData.available_WithQty);
          }

          return NextResponse.json({
            success: true,
            hospital: hospData,
            stock: parsedStock,
            components: componentsList,
            stale: stockResult.stale,
            isFallback: stockResult.isFallback,
          });
        }
      } catch (err: any) {
        console.warn("Error fetching specific hospital stock:", err?.message);
      }
    }

    let eraktkoshFacilities: any[] = [];
    const effectiveStateCode = stateCode || "27"; // Default: Maharashtra (27)
    
    // Stable rounded cache key (lat/lng rounded to 2 decimal places ~1.1km)
    const roundedLat = hasCoords ? Math.round(lat! * 100) / 100 : null;
    const roundedLng = hasCoords ? Math.round(lng! * 100) / 100 : null;
    const registryKey = hasCoords
      ? `geo_${roundedLat!.toFixed(2)}_${roundedLng!.toFixed(2)}_${radiusKm}_${effectiveStateCode}`
      : `state_${effectiveStateCode}`;

    let isStale = false;
    let isFallback = false;
    let executionErrorCategory: ErrorCategory | undefined;

    // Mode A: Query without authentic coordinates (State / District fallback)
    if (!hasCoords) {
      const stateResult = await client.execute<any[]>(
        `state_list_${effectiveStateCode}`,
        async (signal) => {
          const resp = await axios.get(
            `${api_url}blood-availability?stateCode=${effectiveStateCode}`,
            {
              headers: {
                "User-Agent": "BloodLink-Emergency-App/1.0",
                Accept: "application/json",
              },
              timeout: client.config.timeoutMs,
              signal,
            }
          );
          return resp.data;
        },
        { staticFallback: getSeedFallbackFacilities(null, null) }
      );

      isStale = stateResult.stale;
      isFallback = stateResult.isFallback;
      executionErrorCategory = stateResult.errorCategory;

      if (Array.isArray(stateResult.data)) {
        eraktkoshFacilities = stateResult.data.map((item) => ({
          name: item.hospitalname || item.name,
          address: item.hospitaladd || item.address,
          phone:
            item.phone ||
            item.hospitalcontact?.replace(/Phone:\s*|Fax:.*|Email:.*/gi, "").trim(),
          email: item.hospitalcontact?.match(/Email:\s*([^\s,]+)/i)?.[1] || "",
          hospitalType: item.hospitalType || "Govt.",
          hospitalCode: item.hospitalCode || item.id,
          stateCode: effectiveStateCode,
          dist: 0,
          latitude: item.latitude || null,
          longitude: item.longitude || null,
          components: item.components || null,
        }));
      }
    }

    // Mode B: Geolocation nearest query (authenticated coordinates)
    if (hasCoords) {
      const radiusMeters = Math.min(Math.max(Math.round(radiusKm * 1000), 10000), 500000);

      // Execute with resilience: concurrent nearest search + state availability enrichment
      const [nearestResult, stateData] = await Promise.all([
        client.execute<any[]>(
          registryKey,
          async (signal) => {
            const nearestResp = await axios.get(
              `${api_url}bloodbank/nearest?latitude=${lat}&longitude=${lng}&radius=${radiusMeters}`,
              {
                headers: {
                  "User-Agent": "BloodLink-Emergency-App/1.0",
                  Accept: "application/json",
                },
                timeout: client.config.timeoutMs,
                signal,
              }
            );
            return nearestResp.data;
          },
          {
            geoFallbackCoords: { lat: lat!, lng: lng! },
            staticFallback: getSeedFallbackFacilities(lat, lng),
          }
        ),
        getStateAvailabilityMap(effectiveStateCode, api_url).catch(() => null)
      ]);

      isStale = nearestResult.stale;
      isFallback = nearestResult.isFallback;
      executionErrorCategory = nearestResult.errorCategory;

      let nearestItems: any[] = [];
      if (Array.isArray(nearestResult.data)) {
        nearestItems = nearestResult.data;
      }

      if (nearestItems.length > 0) {
        eraktkoshFacilities = nearestItems.map((item) => {
          const codeStr = String(item.hospitalCode || item.id || "");
          const cleanName = (item.name || item.hospitalname || "")
            .toLowerCase()
            .trim()
            .replace(/,\s*$/, "");
          let matched = stateData?.byCode.get(codeStr);
          if (!matched && stateData) {
            for (const [sName, sItem] of stateData.byName) {
              if (sName.includes(cleanName) || cleanName.includes(sName)) {
                matched = sItem;
                break;
              }
            }
          }

          return {
            ...item,
            hospitalType: item.hospitalType || matched?.hospitalType || "Govt.",
            components: matched?.components || item.components || null,
            stateCode: item.stateCode || effectiveStateCode,
          };
        });
      }
    }

    const facilities: any[] = [];

    // Process all eRaktKosh / cached facilities
    if (eraktkoshFacilities.length > 0) {
      eraktkoshFacilities.forEach((item: any, idx: number) => {
        const rawName = (item.name || item.hospitalname || "").trim().replace(/,\s*$/, "");
        const rawAddress = (item.address || item.hospitaladd || "").trim().replace(/^,\s*/, "");
        const phone = (item.phone || "").trim() || "+91 Contact Facility";
        const email = (item.email || "").trim();
        const distMeters = item.dist || 0;
        const distKm =
          distMeters > 0
            ? Math.round((distMeters / 1000) * 10) / 10
            : hasCoords && item.latitude && item.longitude
            ? calculateHaversineKm(lat!, lng!, Number(item.latitude), Number(item.longitude))
            : null;
        const hospitalType = item.hospitalType ? item.hospitalType.trim() : "Govt.";

        const lowerName = rawName.toLowerCase();
        const isHospital =
          lowerName.includes("hospital") ||
          lowerName.includes("institute") ||
          lowerName.includes("medical") ||
          lowerName.includes("clinic") ||
          lowerName.includes("trust") ||
          lowerName.includes("trauma") ||
          lowerName.includes("health") ||
          hospitalType === "Govt.";

        const isBloodBank = true;
        const type = isHospital ? "HOSPITAL" : "BLOOD_BANK";

        if (typeFilter === "HOSPITAL" && !isHospital) return;

        // Substring search filtering
        if (query) {
          const matchName = lowerName.includes(query);
          const matchAddr = rawAddress.toLowerCase().includes(query);
          const matchPhone = phone.includes(query);
          if (!matchName && !matchAddr && !matchPhone) return;
        }

        // Parse stock from components
        const stock: Record<string, number> = {
          "A+": 0, "A-": 0, "B+": 0, "B-": 0,
          "AB+": 0, "AB-": 0, "O+": 0, "O-": 0,
        };
        const componentStock: Record<string, Record<string, number>> = {};
        const availableComponents: string[] = [];

        if (item.components && typeof item.components === "object") {
          for (const compName of Object.keys(item.components)) {
            const compObj = item.components[compName];
            if (compObj?.available_WithQty && compObj.available_WithQty.trim()) {
              const compParsed = parseAvailableWithQty(compObj.available_WithQty);
              const hasUnits = Object.values(compParsed).some((q) => q > 0);
              if (hasUnits) {
                availableComponents.push(compName);
                componentStock[compName] = compParsed;
                for (const [bg, qty] of Object.entries(compParsed)) {
                  stock[bg] = (stock[bg] || 0) + qty;
                }
              }
            }
          }
        }

        facilities.push({
          id: String(item.hospitalCode || item.id || `erakt-${idx}`),
          name: rawName,
          type,
          isHospital,
          isBloodBank,
          hospitalType,
          distanceKm: distKm,
          address: rawAddress || "Address listed under eRaktKosh Registry",
          phone,
          email,
          lat: item.latitude ? Number(item.latitude) : null,
          lng: item.longitude ? Number(item.longitude) : null,
          hospitalCode: item.hospitalCode ? String(item.hospitalCode) : null,
          stateCode: item.stateCode ? String(item.stateCode) : null,
          verified: true,
          componentsAvailable:
            availableComponents.length > 0
              ? availableComponents
              : ["Whole Blood", "Packed Red Blood Cells", "Platelets", "Fresh Frozen Plasma"],
          stock,
          componentStock,
          source: isFallback
            ? "Verified Offline Cache"
            : item.source || "eRaktKosh (MoHFW)",
          lastUpdated: isFallback ? "Cached (Offline Fallback)" : "Live eRaktKosh",
          isStale: isStale || isFallback,
        });
      });
    }

    // Best-effort Supabase query with 1500ms timeout race (prevents DNS hang)
    try {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      if (supabaseUrl && !supabaseUrl.includes("xyzcompany")) {
        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("Supabase query timed out")), 1500)
        );

        const queryPromise = (async () => {
          const supabase = await createClient();
          let supaQuery = supabase.from("hospital_profiles").select("*");
          if (query) {
            supaQuery = supaQuery.or(`hospital_name.ilike.%${query}%,address.ilike.%${query}%`);
          }
          return await supaQuery;
        })();

        const { data: hosps, error: supaErr } = await Promise.race([
          queryPromise,
          timeoutPromise,
        ]);

        if (!supaErr && Array.isArray(hosps)) {
          hosps.forEach((h) => {
            const hDist =
              hasCoords && h.latitude && h.longitude
                ? calculateHaversineKm(lat!, lng!, Number(h.latitude), Number(h.longitude))
                : null;

            facilities.unshift({
              id: h.id,
              name: h.hospital_name,
              type: "HOSPITAL",
              isHospital: true,
              isBloodBank: false,
              hospitalType: "Registered Partner",
              distanceKm: hDist,
              address: h.address || "Registered Hospital",
              phone: h.phone || "Contact via portal",
              lat: h.latitude ? Number(h.latitude) : null,
              lng: h.longitude ? Number(h.longitude) : null,
              verified: h.verified ?? true,
              componentsAvailable: [
                "Whole Blood",
                "Packed Red Blood Cells",
                "Platelets",
                "Fresh Frozen Plasma",
              ],
              stock: {},
              source: "BloodLink Partner Network",
              lastUpdated: "Just now",
              isStale: false,
            });
          });
        }
      }
    } catch (supaErr: any) {
      console.warn("Supabase query skipped (timeout or unreachable):", supaErr?.message);
    }

    // Sort: items with known distance first, then alphabetically
    facilities.sort((a, b) => {
      if (a.distanceKm !== null && b.distanceKm !== null) {
        return (a.distanceKm || 0) - (b.distanceKm || 0);
      }
      if (a.distanceKm !== null) return -1;
      if (b.distanceKm !== null) return 1;
      return a.name.localeCompare(b.name);
    });

    const payload = {
      success: true,
      source: isFallback
        ? "CACHED_FALLBACK"
        : eraktkoshFacilities.length > 0
        ? "eRaktKosh"
        : "database",
      stale: isStale || isFallback,
      isFallback,
      circuitState: client.circuitBreaker.getState(),
      errorCategory: executionErrorCategory,
      count: facilities.length,
      facilities,
    };

    return NextResponse.json(payload, { status: 200 });
  } catch (err: any) {
    console.error("Error in /api/hospitals/nearby:", err);
    return NextResponse.json(
      {
        success: false,
        error: err.message || "Failed to fetch facilities",
        errorCategory: "SERVER_5XX_ERROR",
        stale: true,
        isFallback: true,
        count: 0,
        facilities: [],
      },
      { status: 500 }
    );
  }
}
