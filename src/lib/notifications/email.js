import axios from "axios";

/**
 * Resend Email Notification Gateway
 */

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL = process.env.FROM_EMAIL || "BloodLink Emergency Alerts <alerts@bloodlink.org>";

export async function sendEmailAlert({ to, subject, html, template = "EMERGENCY_ALERT" }) {
  if (!to) return { success: false, error: "Recipient email is required" };

  // Mock fallback if Resend API key is not configured
  if (!RESEND_API_KEY) {
    console.log(`\n======================================================`);
    console.log(`📧 [MOCK EMAIL ALERT - ${template}]`);
    console.log(`To: ${to}`);
    console.log(`Subject: ${subject}`);
    console.log(`Content:\n${html.replace(/<[^>]*>?/gm, ' ')}`);
    console.log(`======================================================\n`);
    return {
      success: true,
      messageId: `mock-email-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      provider: "MOCK"
    };
  }

  try {
    const response = await axios.post(
      "https://api.resend.com/emails",
      {
        from: FROM_EMAIL,
        to: [to],
        subject,
        html
      },
      {
        headers: {
          Authorization: `Bearer ${RESEND_API_KEY}`,
          "Content-Type": "application/json"
        },
        timeout: 5000
      }
    );

    return {
      success: true,
      messageId: response.data.id,
      provider: "RESEND"
    };
  } catch (error) {
    console.error("Resend Email error:", error.response?.data || error.message);
    return {
      success: false,
      error: error.response?.data?.message || error.message,
      provider: "RESEND"
    };
  }
}

/**
 * Renders HTML template for Emergency Blood Requests
 */
export function buildEmergencyEmailHtml(request, candidate, actionUrl) {
  const urgencyColor = request.urgency === "CRITICAL" ? "#dc2626" : "#f97316";

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1f2937; margin: 0; padding: 20px; background-color: #f9fafb; }
          .container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; border: 1px solid #e5e7eb; overflow: hidden; }
          .header { background: ${urgencyColor}; color: white; padding: 24px; text-align: center; }
          .content { padding: 24px; }
          .badge { display: inline-block; background: #fee2e2; color: #991b1b; font-size: 12px; font-weight: 800; padding: 4px 10px; border-radius: 9999px; text-transform: uppercase; margin-bottom: 12px; }
          .details-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin: 16px 0; }
          .btn { display: inline-block; background: #dc2626; color: white; font-weight: 700; text-decoration: none; padding: 12px 24px; border-radius: 8px; text-align: center; margin-top: 16px; }
          .footer { font-size: 11px; color: #6b7280; text-align: center; padding: 16px; border-top: 1px solid #f1f5f9; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1 style="margin:0; font-size: 22px;">🚨 Emergency Blood Alert</h1>
            <p style="margin:4px 0 0 0; font-size: 14px; opacity: 0.9;">Urgent Donor Dispatch Required</p>
          </div>
          <div class="content">
            <span class="badge">${request.urgency} URGENCY</span>
            <h2 style="margin: 0 0 8px 0; color: #111827;">Blood Required: ${request.bloodGroup} (${request.bloodComponent || "Whole Blood"})</h2>
            <p style="margin: 0; color: #4b5563;">Hello <strong>${candidate.candidateName}</strong>,</p>
            <p>You have been identified as a compatible nearby donor (~${candidate.distanceKm} km away) for an urgent blood requirement.</p>
            
            <div class="details-card">
              <p style="margin: 4px 0;"><strong>Patient:</strong> ${request.patientName}</p>
              <p style="margin: 4px 0;"><strong>Hospital:</strong> ${request.hospitalName}</p>
              <p style="margin: 4px 0;"><strong>Address:</strong> ${request.hospitalAddress || "Address on file"}</p>
              <p style="margin: 4px 0;"><strong>Units Needed:</strong> ${request.unitsNeeded}</p>
            </div>

            <p style="font-size: 13px; color: #6b7280;">
              <em>Medical Disclaimer: Mandatory clinical cross-matching must be performed by certified lab staff before transfusion.</em>
            </p>

            <div style="text-align: center;">
              <a href="${actionUrl}" class="btn">View & Respond to Emergency Request</a>
            </div>
          </div>
          <div class="footer">
            BloodLink Emergency Coordination Platform • Automatic Dispatch System
          </div>
        </div>
      </body>
    </html>
  `;
}
