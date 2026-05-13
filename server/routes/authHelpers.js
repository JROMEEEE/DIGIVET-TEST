function generatePassword() {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#';
  return Array.from({ length: 10 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

// Singleton pooled transporter — connection reused across all emails, no reconnect overhead
let _transporter = null;
function getTransporter() {
  if (!_transporter) {
    const nodemailer = require('nodemailer');
    _transporter = nodemailer.createTransport({
      service: 'gmail',
      pool: true,          // reuse connections instead of creating a new one per email
      maxConnections: 5,   // up to 5 parallel SMTP connections
      maxMessages: 100,    // send up to 100 messages per connection before cycling
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });
  }
  return _transporter;
}

async function sendCredentialsEmail(email, name, password) {
  const QRCode = require('qrcode');

  // Generate QR as PNG buffer — CID embed works in all email clients
  const qrBuffer = await QRCode.toBuffer(
    JSON.stringify({ email, password }),
    { width: 220, margin: 2 }
  );

  const loginUrl = process.env.CLIENT_URL || 'http://localhost:5173';

  await getTransporter().sendMail({
    from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
    to: email,
    subject: 'Your DIGIVET Online Account Credentials',
    attachments: [
      {
        filename: 'digivet-login-qr.png',
        content: qrBuffer,
        cid: 'login-qr@digivet',
      },
    ],
    html: `
      <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;padding:32px;border:1px solid #eee;border-radius:12px;">
        <div style="text-align:center;margin-bottom:24px;">
          <div style="display:inline-block;background:#7B1B2E;color:#fff;font-weight:bold;font-size:18px;padding:10px 20px;border-radius:8px;">DIGIVET Online</div>
        </div>
        <h2 style="color:#111;margin:0 0 8px;">Hello, ${name}!</h2>
        <p style="color:#555;line-height:1.6;">Your pet owner account has been created on the <strong>DIGIVET Online Portal</strong> of the Lipa City Veterinary Office.</p>
        <div style="background:#f5e8ea;border-radius:10px;padding:20px;margin:24px 0;">
          <p style="margin:0 0 8px;color:#888;font-size:13px;font-weight:bold;text-transform:uppercase;letter-spacing:0.5px;">Your Login Credentials</p>
          <p style="margin:6px 0;color:#111;font-size:15px;"><strong>Email:</strong> ${email}</p>
          <p style="margin:6px 0;color:#111;font-size:15px;"><strong>Password:</strong> <span style="font-family:monospace;font-size:16px;background:#fff;padding:3px 10px;border-radius:4px;letter-spacing:1px;">${password}</span></p>
        </div>
        <div style="text-align:center;background:#fafafa;border:1px solid #eee;border-radius:12px;padding:24px;margin:0 0 24px;">
          <p style="color:#555;font-size:14px;font-weight:bold;margin:0 0 4px;">Quick Login — Scan this QR Code</p>
          <p style="color:#888;font-size:12px;margin:0 0 16px;">Open the DIGIVET login page, tap <strong>QR Code</strong> tab, then scan below</p>
          <img src="cid:login-qr@digivet" alt="DIGIVET Login QR Code" width="180" height="180" style="border:4px solid #7B1B2E;border-radius:10px;display:block;margin:0 auto;" />
          <p style="color:#aaa;font-size:11px;margin:12px 0 0;">Screenshot or print this QR code and keep it safe</p>
        </div>
        <a href="${loginUrl}/login" style="display:block;text-align:center;background:#7B1B2E;color:#fff;text-decoration:none;padding:14px;border-radius:8px;font-weight:bold;font-size:15px;margin-bottom:24px;">Sign In to DIGIVET</a>
        <p style="color:#aaa;font-size:12px;text-align:center;">Keep your password and QR code private. Contact the Lipa City Veterinary Office if you need help.</p>
      </div>
    `,
  });
}

// Creates or updates a Supabase auth account — avoids the slow listUsers() call
// Tries createUser first; if the email is already registered, updates instead
async function upsertSupabaseUser(supabase, email, password, metadata) {
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: metadata,
  });

  if (!error) return data.user;

  // User already exists — get their ID via generateLink (faster than listUsers)
  const { data: linkData } = await supabase.auth.admin.generateLink({
    type: 'magiclink',
    email,
  });

  if (linkData?.user?.id) {
    await supabase.auth.admin.updateUserById(linkData.user.id, {
      password,
      email_confirm: true,
      user_metadata: metadata,
    });
    return linkData.user;
  }

  return null;
}

module.exports = { generatePassword, sendCredentialsEmail, upsertSupabaseUser };