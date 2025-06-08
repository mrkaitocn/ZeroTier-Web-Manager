// netlify/functions/zerotier-webhook.js

import { Redis } from '@upstash/redis';
import { Resend } from 'resend';
import crypto from 'crypto';

// --- KHỞI TẠO CÁC CLIENT ---
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

const resend = new Resend(process.env.RESEND_API_KEY);

// --- LẤY CÁC BIẾN MÔI TRƯỜNG MỚI ---
const telegramBotToken = process.env.TELEGRAM_BOT_TOKEN;
const telegramChatId = process.env.TELEGRAM_CHAT_ID;
const webhookSecret = process.env.ZT_WEBHOOK_SECRET;
const ntfyTopic = process.env.NTFY_TOPIC;
const notifyMemberIds = process.env.ZT_NOTIFY_MEMBER_IDS;


// --- CÁC HÀM GỬI THÔNG BÁO ---

// Hàm gửi tin nhắn Telegram
async function sendTelegramMessage(message) {
  if (!telegramBotToken || !telegramChatId) return;
  const url = `https://api.telegram.org/bot${telegramBotToken}/sendMessage`;
  await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: telegramChatId, text: message, parse_mode: 'Markdown' }),
  });
}

// Hàm gửi email
async function sendEmail(subject, message) {
  if (!process.env.RESEND_API_KEY) return;
  const toEmail = 'email-nhan-thong-bao@cua-ban.com'; // Thay bằng email của bạn
  if (!toEmail.includes('@')) return; // Bỏ qua nếu email chưa được cấu hình
  await resend.emails.send({
    from: 'ZeroTier Notifier <onboarding@resend.dev>',
    to: toEmail,
    subject: subject,
    html: `<p>${message}</p>`,
  });
}

// *** HÀM MỚI: GỬI THÔNG BÁO NTFY.SH ***
async function sendNtfyMessage(title, message, tags) {
  if (!ntfyTopic) return;
  const url = `https://ntfy.sh/${ntfyTopic}`;
  await fetch(url, {
    method: 'POST',
    body: message,
    headers: {
      'Title': title,
      'Tags': tags, // Thêm icon cho thông báo
    },
  });
}


// --- HÀM BẢO MẬT VÀ HÀM XỬ LÝ CHÍNH ---

async function verifySignature(request) {
  const signature = request.headers.get('x-zerotier-webhook-signature');
  const bodyText = await request.text();
  if (!signature || !webhookSecret) return { isValid: false, body: bodyText };
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(webhookSecret), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
  const verified = await crypto.subtle.verify('HMAC', key, Buffer.from(signature, 'hex'), new TextEncoder().encode(bodyText));
  return { isValid: verified, body: bodyText };
}


export default async (request) => {
  if (request.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  const { isValid, body: bodyText } = await verifySignature(request);
  if (!isValid) {
    return new Response('Invalid signature', { status: 401 });
  }

  const eventData = JSON.parse(bodyText);
  const { event, member, network } = eventData;
  const memberId = member.id;
  const memberName = member.name || member.id;
  const networkName = network.name || network.id;

  // *** LOGIC LỌC THIẾT BỊ THEO DANH SÁCH ***
  // Nếu biến môi trường có tồn tại VÀ memberId hiện tại không nằm trong danh sách đó
  if (notifyMemberIds && !notifyMemberIds.split(',').includes(memberId)) {
    console.log(`Bỏ qua thông báo cho thiết bị ${memberName} (${memberId}) vì không có trong danh sách theo dõi.`);
    return new Response('Member not in notification list. Skipped.', { status: 200 });
  }

  const stateKey = `zt-member-state:${memberId}`;
  
  try {
    const lastState = await redis.get(stateKey);
    let subject = '';
    let message = '';
    let ntfyTitle = '';
    let ntfyTags = '';
    let ntfyMessage = '';

    if (event === 'MEMBER_ONLINE' && lastState !== 'online') {
      subject = `[ZeroTier] Online: ${memberName}`;
      message = `Thiết bị "${memberName}" vừa online trên network "${networkName}".`;
      ntfyTitle = `✅ Online: ${memberName}`;
      ntfyTags = 'white_check_mark';
      ntfyMessage = `Network: ${networkName}\nID: ${memberId}`;

      await redis.set(stateKey, 'online', { ex: 2592000 });
      // Gửi đồng thời cả 3 loại thông báo
      await Promise.all([
        sendTelegramMessage(`✅ *Online:* ${memberName}\n*Network:* ${networkName}`), 
        sendEmail(subject, message),
        sendNtfyMessage(ntfyTitle, ntfyMessage, ntfyTags)
      ]);

    } else if (event === 'MEMBER_OFFLINE' && lastState !== 'offline') {
      subject = `[ZeroTier] Offline: ${memberName}`;
      message = `Thiết bị "${memberName}" vừa offline trên network "${networkName}".`;
      ntfyTitle = `🔌 Offline: ${memberName}`;
      ntfyTags = 'electric_plug';
      ntfyMessage = `Network: ${networkName}\nID: ${memberId}`;

      await redis.set(stateKey, 'offline', { ex: 2592000 });
      await Promise.all([
        sendTelegramMessage(`🔌 *Offline:* ${memberName}\n*Network:* ${networkName}`), 
        sendEmail(subject, message),
        sendNtfyMessage(ntfyTitle, ntfyMessage, ntfyTags)
      ]);
    }
    
    return new Response('Webhook processed', { status: 200 });

  } catch (error) {
    console.error('Error processing webhook:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
};
