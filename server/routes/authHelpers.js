function generatePassword() {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#';
  return Array.from({ length: 10 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

async function syncOwnerLocalCredentials(supabase, ownerId, email, password, displayName) {
  if (!ownerId || !email || !password) return;

  const bcrypt = require('bcryptjs');
  const normalizedEmail = email.toLowerCase().trim();
  const passwordHash = await bcrypt.hash(password, 10);

  const payload = {
    owner_id: ownerId,
    email: normalizedEmail,
    password,
    password_hash: passwordHash,
    display_name: displayName ?? '',
  };

  const { data: existing, error: fetchErr } = await supabase
    .from('user_table')
    .select('user_id')
    .eq('owner_id', ownerId)
    .maybeSingle();

  if (fetchErr) {
    throw new Error(`Failed to read local owner credentials: ${fetchErr.message}`);
  }

  if (existing?.user_id) {
    const { error: updateErr } = await supabase
      .from('user_table')
      .update(payload)
      .eq('user_id', existing.user_id);

    if (updateErr) {
      throw new Error(`Failed to update local owner credentials: ${updateErr.message}`);
    }
    return;
  }

  const { error: insertErr } = await supabase
    .from('user_table')
    .insert(payload);

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

  if (process.env.SUPABASE_ANON_KEY) {
    const { createClient } = require('@supabase/supabase-js');
    const anonClient = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
    const { error: otpErr } = await anonClient.auth.signInWithOtp({
      email: normalizedEmail,
      options: {
        emailRedirectTo: redirectTo,
        shouldCreateUser: false,
      },
    });

    if (otpErr) {
      throw new Error(`Magic link send failed: ${otpErr.message}`);
    }

    return { channel: 'supabase-otp', user };
  }

  await sendCredentialsEmail(normalizedEmail, name, password);
  return { channel: 'smtp-credentials', user };
}

async function sendOwnerAccessLink(supabase, email, password, metadata, redirectTo) {
  const normalizedEmail = email.toLowerCase().trim();
  if (!process.env.SUPABASE_ANON_KEY) {
    throw new Error('Missing SUPABASE_ANON_KEY');
  }

  const user = await upsertSupabaseUser(supabase, normalizedEmail, password, metadata);
  if (!user?.id) {
    throw new Error(`Failed to create or update Supabase auth user for ${normalizedEmail}`);
  }

  const { createClient } = require('@supabase/supabase-js');
  const anonClient = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
  const { error: otpErr } = await anonClient.auth.signInWithOtp({
    email: normalizedEmail,
    options: {
      emailRedirectTo: redirectTo,
      shouldCreateUser: false,
    },
  });

  if (otpErr) {
    throw new Error(`Magic link send failed: ${otpErr.message}`);
  }

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

module.exports = { deliverOwnerCredentials, findAuthUserByEmail, generatePassword, sendCredentialsEmail, sendOwnerAccessLink, syncOwnerLocalCredentials, upsertSupabaseUser };
