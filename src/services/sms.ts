/**
 * Server-Only Transactional SMS Service for CRITICAL Emergencies
 */

export async function sendCriticalEmergencySMS({
  phone,
  bloodGroup,
  hospitalName,
  distanceKm
}: {
  phone: string;
  bloodGroup: string;
  hospitalName: string;
  distanceKm: number;
}) {
  const apiKey = process.env.SMS_API_KEY;

  if (!apiKey || apiKey.includes("dummy")) {
    console.log(`[SMS MOCK] Alert sent to ${phone}: CRITICAL ${bloodGroup} blood needed at ${hospitalName} (${distanceKm}km away). Respond on BloodLink.`);
    return { success: true, mock: true };
  }

  try {
    const res = await fetch(process.env.SMS_PROVIDER_URL || "https://api.sms-provider.com/v1/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        to: phone,
        message: `🚨 CRITICAL EMERGENCY: ${bloodGroup} blood required immediately at ${hospitalName} (~${distanceKm}km away). Please check BloodLink app to accept.`
      })
    });

    return { success: res.ok };
  } catch (err: any) {
    console.error("SMS gateway error:", err);
    return { success: false, error: err.message };
  }
}
