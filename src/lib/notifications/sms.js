import axios from "axios";

/**
 * Multi-Provider SMS Alert Gateway
 * 
 * Supported Providers:
 * - TWILIO
 * - MSG91
 * - FAST2SMS
 * - MOCK (Default local dev mode)
 */

const SMS_PROVIDER = (process.env.SMS_PROVIDER || "MOCK").toUpperCase();

export async function sendSmsAlert({ to, message, template = "EMERGENCY_ALERT" }) {
  if (!to) return { success: false, error: "Recipient phone number is required" };

  switch (SMS_PROVIDER) {
    case "TWILIO":
      return sendTwilioSms(to, message);
    case "MSG91":
      return sendMsg91Sms(to, message);
    case "FAST2SMS":
      return sendFast2Sms(to, message);
    case "MOCK":
    default:
      return sendMockSms(to, message, template);
  }
}

function sendMockSms(to, message, template) {
  console.log(`\n======================================================`);
  console.log(`📱 [MOCK SMS ALERT - ${template}]`);
  console.log(`To: ${to}`);
  console.log(`Message:\n${message}`);
  console.log(`======================================================\n`);
  return Promise.resolve({
    success: true,
    messageId: `mock-sms-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    provider: "MOCK"
  });
}

async function sendTwilioSms(to, message) {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_PHONE_NUMBER;

  if (!sid || !token || !from) {
    console.warn("Twilio credentials missing; falling back to Mock SMS.");
    return sendMockSms(to, message, "TWILIO_FALLBACK");
  }

  try {
    const auth = Buffer.from(`${sid}:${token}`).toString("base64");
    const params = new URLSearchParams();
    params.append("To", to);
    params.append("From", from);
    params.append("Body", message);

    const response = await axios.post(
      `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
      params.toString(),
      {
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/x-www-form-urlencoded"
        },
        timeout: 5000
      }
    );

    return {
      success: true,
      messageId: response.data.sid,
      provider: "TWILIO"
    };
  } catch (error) {
    console.error("Twilio SMS error:", error.response?.data || error.message);
    return {
      success: false,
      error: error.response?.data?.message || error.message,
      provider: "TWILIO"
    };
  }
}

async function sendMsg91Sms(to, message) {
  const authKey = process.env.MSG91_AUTH_KEY;
  const senderId = process.env.MSG91_SENDER_ID || "BLDLNK";

  if (!authKey) {
    return sendMockSms(to, message, "MSG91_FALLBACK");
  }

  try {
    const response = await axios.post(
      "https://control.msg91.com/api/v5/flow/",
      {
        sender: senderId,
        recipients: [{ mobiles: to, message }]
      },
      {
        headers: { authkey: authKey, "Content-Type": "application/json" },
        timeout: 5000
      }
    );

    return {
      success: true,
      messageId: response.data.request_id || "msg91-sent",
      provider: "MSG91"
    };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.message || error.message,
      provider: "MSG91"
    };
  }
}

async function sendFast2Sms(to, message) {
  const apiKey = process.env.FAST2SMS_API_KEY;

  if (!apiKey) {
    return sendMockSms(to, message, "FAST2SMS_FALLBACK");
  }

  try {
    const response = await axios.post(
      "https://www.fast2sms.com/dev/bulkV2",
      {
        route: "q",
        message,
        numbers: to.replace(/[^0-9]/g, "")
      },
      {
        headers: { authorization: apiKey, "Content-Type": "application/json" },
        timeout: 5000
      }
    );

    return {
      success: true,
      messageId: response.data.request_id || "fast2sms-sent",
      provider: "FAST2SMS"
    };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.message || error.message,
      provider: "FAST2SMS"
    };
  }
}

/**
 * Builds standard SMS alert message
 */
export function buildEmergencySmsText(request, candidate, actionUrl) {
  return `🚨 BLOODLINK EMERGENCY ALERT (${request.urgency}): ${request.bloodGroup} needed at ${request.hospitalName}. You are ~${candidate.distanceKm}km away. Track/Respond: ${actionUrl}`;
}
