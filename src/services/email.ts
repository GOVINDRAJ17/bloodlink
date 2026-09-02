/**
 * Server-Only Transactional Email Notification Service via Resend
 */

export async function sendEmergencyDonorEmail({
  toEmail,
  donorName,
  bloodGroup,
  hospitalName,
  urgency,
  distanceKm,
  requestId
}: {
  toEmail: string;
  donorName: string;
  bloodGroup: string;
  hospitalName: string;
  urgency: string;
  distanceKm: number;
  requestId: string;
}) {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey || apiKey.includes("dummy")) {
    console.log(`[RESEND EMAIL MOCK] Alert sent to ${toEmail} for ${bloodGroup} emergency at ${hospitalName}`);
    return { success: true, mock: true };
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        from: "BloodLink Emergency <dispatch@bloodlink.org>",
        to: [toEmail],
        subject: `🚨 ${urgency} EMERGENCY: ${bloodGroup} Donor Needed (${distanceKm} km away)`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; padding: 20px; border: 1px solid #e2e4e1; border-radius: 12px;">
            <div style="background-color: #14213D; padding: 15px; border-radius: 8px; text-align: center; color: #ffffff;">
              <h2 style="margin: 0; font-size: 20px;">🚨 BloodLink Emergency Alert</h2>
            </div>
            <div style="padding: 20px 0;">
              <p>Hello <strong>${donorName}</strong>,</p>
              <p>An urgent blood requirement matching your blood group (<strong>${bloodGroup}</strong>) has been requested near you.</p>
              <table style="width: 100%; border-collapse: collapse; margin: 15px 0;">
                <tr><td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Hospital:</strong></td><td style="padding: 8px; border-bottom: 1px solid #eee;">${hospitalName}</td></tr>
                <tr><td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Distance:</strong></td><td style="padding: 8px; border-bottom: 1px solid #eee;">${distanceKm} km away</td></tr>
                <tr><td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Urgency:</strong></td><td style="padding: 8px; border-bottom: 1px solid #eee; color: #D62828; font-weight: bold;">${urgency}</td></tr>
              </table>
              <div style="text-align: center; margin-top: 25px;">
                <a href="${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/dashboard/donor" style="background-color: #D62828; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">View & Respond to Alert →</a>
              </div>
            </div>
          </div>
        `
      })
    });

    return { success: res.ok };
  } catch (err: any) {
    console.error("Resend email error:", err);
    return { success: false, error: err.message };
  }
}
