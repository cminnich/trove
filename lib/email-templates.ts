// Escape HTML to prevent XSS in email templates
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function getBaseUrl(): string {
  // Explicit base URL (set this in production to avoid deployment-specific URLs)
  if (process.env.NEXT_PUBLIC_BASE_URL) {
    return process.env.NEXT_PUBLIC_BASE_URL;
  }
  // Vercel preview URLs (for staging/preview deployments)
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  // Fallback to production domain
  return "https://www.opentrove.app";
}

interface CollaborationInviteParams {
  inviterName: string;
  collectionName: string;
  collectionId: string;
  accessLevel: "viewer" | "editor";
}

export function collaborationInviteEmail(params: CollaborationInviteParams): string {
  const { inviterName, collectionName, collectionId, accessLevel } = params;
  const baseUrl = getBaseUrl();
  const collectionUrl = `${baseUrl}/collections/${escapeHtml(collectionId)}`;
  const accessText = accessLevel === "editor" ? "edit" : "view";

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
    <h1 style="color: white; margin: 0; font-size: 24px;">You've been invited!</h1>
  </div>

  <div style="background: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
    <p style="font-size: 16px; margin-top: 0;">
      <strong>${escapeHtml(inviterName)}</strong> invited you to ${accessText} their collection <strong>"${escapeHtml(collectionName)}"</strong> on Trove.
    </p>

    <div style="text-align: center; margin: 30px 0;">
      <a href="${collectionUrl}" style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">
        View Collection
      </a>
    </div>

    <p style="font-size: 14px; color: #6b7280; margin-bottom: 0;">
      If you weren't expecting this invitation, you can safely ignore this email.
    </p>
  </div>

  <div style="text-align: center; padding: 20px; color: #9ca3af; font-size: 12px;">
    <p style="margin: 0;">Sent by <a href="https://www.opentrove.app" style="color: #9ca3af;">Trove</a></p>
    <p style="margin: 5px 0 0 0;">Questions? <a href="mailto:help@opentrove.app" style="color: #9ca3af;">help@opentrove.app</a></p>
  </div>
</body>
</html>
`.trim();
}

interface JoinInviteParams {
  inviterName: string;
  inviterEmail: string;
}

export function joinInviteEmail(params: JoinInviteParams): string {
  const { inviterName, inviterEmail } = params;
  const baseUrl = getBaseUrl();

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
    <h1 style="color: white; margin: 0; font-size: 24px;">You're invited to Trove!</h1>
  </div>

  <div style="background: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
    <p style="font-size: 16px; margin-top: 0;">
      <strong>${escapeHtml(inviterName)}</strong> (${escapeHtml(inviterEmail)}) wants to share a collection with you on Trove.
    </p>

    <p style="font-size: 16px;">
      Trove helps you collect, organize, and discover things you love. Sign up to access your shared collection and start building your own.
    </p>

    <div style="text-align: center; margin: 30px 0;">
      <a href="${baseUrl}" style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">
        Join Trove
      </a>
    </div>

    <p style="font-size: 14px; color: #6b7280; margin-bottom: 0;">
      If you weren't expecting this invitation, you can safely ignore this email.
    </p>
  </div>

  <div style="text-align: center; padding: 20px; color: #9ca3af; font-size: 12px;">
    <p style="margin: 0;">Sent by <a href="https://www.opentrove.app" style="color: #9ca3af;">Trove</a></p>
    <p style="margin: 5px 0 0 0;">Questions? <a href="mailto:help@opentrove.app" style="color: #9ca3af;">help@opentrove.app</a></p>
  </div>
</body>
</html>
`.trim();
}
