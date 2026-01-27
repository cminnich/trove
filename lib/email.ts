import { Resend } from "resend";

// Lazy-initialized Resend client
let resendClient: Resend | null = null;

function getResendClient(): Resend | null {
  if (!process.env.RESEND_API_KEY) {
    return null;
  }
  if (!resendClient) {
    resendClient = new Resend(process.env.RESEND_API_KEY);
  }
  return resendClient;
}

interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
}

interface SendEmailResult {
  success: boolean;
  error?: string;
}

export async function sendEmail(params: SendEmailParams): Promise<SendEmailResult> {
  const client = getResendClient();

  if (!client) {
    console.warn("Email skipped: RESEND_API_KEY not configured");
    return { success: false, error: "Email not configured" };
  }

  try {
    const { error } = await client.emails.send({
      from: "Trove <noreply@opentrove.app>",
      replyTo: "help@opentrove.app",
      to: params.to,
      subject: params.subject,
      html: params.html,
    });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown email error";
    return { success: false, error: message };
  }
}
