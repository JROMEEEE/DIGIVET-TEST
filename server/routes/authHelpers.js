function generatePassword() {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#';
  return Array.from({ length: 10 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

function buildOwnerCredentialMetadata({ ownerId, ownerName, email, password, redirectTo }) {
  const normalizedEmail = email.toLowerCase().trim();
  const qrPayload = JSON.stringify({ email: normalizedEmail, password });

  return {
    full_name: ownerName,
    role: 'pet_owner',
    owner_id: ownerId,
    generated_password: password,
    qr_payload: qrPayload,
    qr_image_url: `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(qrPayload)}`,
    credential_login_url: `${(redirectTo || '').replace(/\/welcome$/, '')}/login`,
    must_change_password: true,
  };
}

async function syncOwnerLocalCredentials(supabase, ownerId, email, password, displayName) {
  if (!ownerId || !email || !password) return;

  const bcrypt = require('bcryptjs');
  const normalizedEmail = email.toLowerCase().trim();
  const passwordHash = await bcrypt.hash(password, 10);

  const payload = {
    owner_id: ownerId,
    email: normalizedEmail,
    username: normalizedEmail,
    user_role: 'pet_owner',
    password,
    password_hash: passwordHash,
    display_name: displayName ?? '',
  };

  const { data: existingByOwner, error: fetchOwnerErr } = await supabase
    .from('user_table')
    .select('user_id, userinfo_id, owner_id, email')
    .eq('owner_id', ownerId)
    .maybeSingle();

  if (fetchOwnerErr) {
    throw new Error(`Failed to read local owner credentials: ${fetchOwnerErr.message}`);
  }

  let existing = existingByOwner;

  if (!existing?.user_id && !existing?.userinfo_id) {
    const { data: existingByEmail, error: fetchEmailErr } = await supabase
      .from('user_table')
      .select('user_id, userinfo_id, owner_id, email')
      .eq('email', normalizedEmail)
      .maybeSingle();

    if (fetchEmailErr) {
      throw new Error(`Failed to read local owner credentials by email: ${fetchEmailErr.message}`);
    }

    existing = existingByEmail;
  }

  if (existing?.user_id || existing?.userinfo_id) {
    const rowIdColumn = existing?.user_id ? 'user_id' : 'userinfo_id';
    const rowIdValue = existing?.user_id ?? existing?.userinfo_id;
    const { error: updateErr } = await supabase
      .from('user_table')
      .update(payload)
      .eq(rowIdColumn, rowIdValue);

    if (updateErr) {
      throw new Error(`Failed to update local owner credentials: ${updateErr.message}`);
    }
    return;
  }

  const { data: lastRow, error: lastRowErr } = await supabase
    .from('user_table')
    .select('userinfo_id')
    .order('userinfo_id', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (lastRowErr) {
    throw new Error(`Failed to determine next local credential ID: ${lastRowErr.message}`);
  }

  const { error: insertErr } = await supabase
    .from('user_table')
    .insert({
      ...payload,
      userinfo_id: (lastRow?.userinfo_id ?? 0) + 1,
    });

  if (insertErr) {
    throw new Error(`Failed to create local owner credentials: ${insertErr.message}`);
  }
}

// Singleton pooled transporter — connection reused across all emails, no reconnect overhead
let _transporter = null;
function getTransporter() {
  if (!_transporter) {
    const nodemailer = require('nodemailer');
    _transporter = nodemailer.createTransport({
      service: 'gmail',
      pool: true,
      maxConnections: 5,
      maxMessages: 100,
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

async function deliverOwnerCredentials(supabase, email, name, password, metadata, redirectTo) {
  const normalizedEmail = email.toLowerCase().trim();

  const user = await upsertSupabaseUser(supabase, normalizedEmail, password, metadata);
  if (!user?.id) {
    throw new Error(`Failed to create or update Supabase auth user for ${normalizedEmail}`);
  }

  await sendCredentialsEmail(normalizedEmail, name, password);
  return { channel: 'smtp-credentials', user };
}

async function sendMagicLinkEmail(email, name, magicLink) {
  await getTransporter().sendMail({
    from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
    to: email,
    subject: 'Your DIGIVET Online Login Link',
    html: `
      <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;padding:0;border-radius:12px;overflow:hidden;border:1px solid #e0e0e0;">
        <div style="background:#7B1B2E;padding:28px 32px;text-align:center;">
          <div style="color:#fff;font-weight:bold;font-size:22px;letter-spacing:1px;">DIGIVET Online</div>
          <div style="color:#f5c6ce;font-size:13px;margin-top:4px;">Lipa City Veterinary Office</div>
        </div>
        <div style="padding:32px;">
          <h2 style="color:#111;margin:0 0 8px;font-size:20px;">Hello, ${name}!</h2>
          <p style="color:#555;line-height:1.6;margin:0 0 24px;">Click the button below to securely sign in to your <strong>DIGIVET Online</strong> account. This link expires in 1 hour and can only be used once.</p>
          <div style="text-align:center;margin:0 0 28px;">
            <a href="${magicLink}" style="display:inline-block;background:#7B1B2E;color:#fff;text-decoration:none;padding:14px 36px;border-radius:8px;font-weight:bold;font-size:15px;">Log In to DIGIVET</a>
          </div>
          <div style="background:#f9f2f3;border-left:4px solid #7B1B2E;border-radius:4px;padding:14px 16px;margin:0 0 24px;">
            <p style="margin:0;color:#666;font-size:13px;">If the button above doesn't work, copy and paste this link into your browser:</p>
            <p style="margin:8px 0 0;word-break:break-all;font-size:12px;color:#7B1B2E;">${magicLink}</p>
          </div>
          <p style="color:#aaa;font-size:12px;text-align:center;margin:0;">If you did not request this link, you can safely ignore this email.<br/>Contact the Lipa City Veterinary Office if you need assistance.</p>
        </div>
        <div style="background:#f5f5f5;padding:16px 32px;text-align:center;border-top:1px solid #e0e0e0;">
          <p style="margin:0;color:#bbb;font-size:11px;">DIGIVET Online &mdash; Lipa City Veterinary Office &copy; ${new Date().getFullYear()}</p>
        </div>
      </div>
    `,
  });
}

async function sendOwnerAccessLink(supabase, email, password, metadata, redirectTo) {
  const normalizedEmail = email.toLowerCase().trim();

  const user = await upsertSupabaseUser(supabase, normalizedEmail, password, metadata);
  if (!user?.id) {
    throw new Error(`Failed to create or update Supabase auth user for ${normalizedEmail}`);
  }

  const { data: linkData, error: linkErr } = await supabase.auth.admin.generateLink({
    type: 'magiclink',
    email: normalizedEmail,
    options: { redirectTo },
  });

  if (linkErr) {
    throw new Error(`Magic link generation failed: ${linkErr.message}`);
  }

  const magicLink = linkData?.properties?.action_link;
  if (!magicLink) {
    throw new Error('Magic link URL was not returned by Supabase');
  }

  const displayName = metadata?.full_name || normalizedEmail;
  await sendMagicLinkEmail(normalizedEmail, displayName, magicLink);

  return user;
}

async function findAuthUserByEmail(supabase, email) {
  const normalizedEmail = email.toLowerCase().trim();
  let page = 1;
  const perPage = 200;

  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) throw error;

    const users = data?.users ?? [];
    const match = users.find(user => user.email?.toLowerCase() === normalizedEmail);
    if (match) return match;
    if (users.length < perPage) return null;

    page += 1;
  }
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

  // User already exists — find it directly and update it
  const existingUser = await findAuthUserByEmail(supabase, email);

  if (existingUser?.id) {
    await supabase.auth.admin.updateUserById(existingUser.id, {
      password,
      email_confirm: true,
      user_metadata: metadata,
    });
    return existingUser;
  }

  return null;
}

module.exports = { buildOwnerCredentialMetadata, deliverOwnerCredentials, findAuthUserByEmail, generatePassword, sendCredentialsEmail, sendMagicLinkEmail, sendOwnerAccessLink, syncOwnerLocalCredentials, upsertSupabaseUser };
