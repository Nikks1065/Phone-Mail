import { db } from './db.ts';
import { hashPassword } from './auth.ts';

export async function seedDatabase(options: { force?: boolean } = {}) {
  console.log('[SEED] Initializing seed data for PhoneMail...');

  if (options.force) {
    db.resetData({
      users: [],
      otps: [],
      aliases: [],
      conversations: [],
      conversation_participants: [],
      messages: [],
      user_message_states: [],
      sms_notifications: [],
      ivr_logs: []
    });
    console.log('[SEED] Cleared existing data for force reset.');
  }

  const user1Phone = '9876543210';
  const user2Phone = '9123456789';
  const user3Phone = '9988776655';

  const defaultPassword = 'Password123!';
  const hashedPassword = await hashPassword(defaultPassword);

  // User 1
  let user1 = await db.getUserByPhone(user1Phone);
  if (!user1) {
    user1 = await db.createUser({
      phone_number: user1Phone,
      display_name: 'Nikhil Nitt',
      password_hash: hashedPassword,
      avatar_url: '/src/assets/images/avatar_nikhil_user_1790265399608.jpg',
      language: 'en'
    });
    // Create an alias
    await db.createAlias(user1.id, 'nikhil.lead@phonemail.com');
  }

  // User 2
  let user2 = await db.getUserByPhone(user2Phone);
  if (!user2) {
    user2 = await db.createUser({
      phone_number: user2Phone,
      display_name: 'Sarah Chen',
      password_hash: hashedPassword,
      avatar_url: '/src/assets/images/avatar_sarah_lead_1790265411344.jpg',
      language: 'en'
    });
    await db.createAlias(user2.id, 'sarah.tech@phonemail.com');
  }

  // User 3
  let user3 = await db.getUserByPhone(user3Phone);
  if (!user3) {
    user3 = await db.createUser({
      phone_number: user3Phone,
      display_name: 'Alex Rivera',
      password_hash: hashedPassword,
      avatar_url: '/src/assets/images/avatar_alex_founder_1790265423137.jpg',
      language: 'en'
    });
  }

  // Check if messages already exist
  const existingConvs = await db.getUserConversations(user1.id, 'inbox');
  if (existingConvs.length > 0) {
    console.log('[SEED] Data already seeded. Skipping message generation.');
    return;
  }

  // Thread 1: Sarah Chen to Nikhil (One-to-one conversation)
  const convSarah = await db.createMessage({
    sender_user_id: user2.id,
    to: [user1.email_address],
    subject: 'AlphaStack Buildathon — PhoneMail Architecture Review',
    body_text: `Hey Nikhil,\n\nI just finalized the system architecture review for PhoneMail. The phone-number identity model is working seamlessly! A few highlights:\n\n1. Normalizing E.164 phone numbers for consistent mail routing.\n2. Inbound webhook integration maps incoming SMTP to recipient phone.\n3. Twilio SMS notifications dispatch immediately whenever an offline recipient receives new mail.\n\nLet me know your thoughts on the single-reply constraint validation.\n\nBest,\nSarah`,
    attachments: [
      {
        id: 'att_arch_01',
        name: 'phonemail_system_architecture.pdf',
        size: 2450000,
        type: 'application/pdf',
        url: '#'
      },
      {
        id: 'att_diagram_02',
        name: 'flow_sequence_diagram.png',
        size: 1180000,
        type: 'image/png',
        url: '#'
      }
    ]
  });

  // Reply from Nikhil back to Sarah (linked to first message)
  await db.createMessage({
    sender_user_id: user1.id,
    conversation_id: convSarah.conversation.id,
    to: [user2.email_address],
    subject: 'Re: AlphaStack Buildathon — PhoneMail Architecture Review',
    body_text: `Hi Sarah,\n\nThis looks fantastic! The WhatsApp-inspired mobile experience with the Gmail-inspired desktop split layout creates the perfect dual personality. I verified the single-reply constraint: each message now safely rejects accidental double replies.\n\nLet's run the final end-to-end demo before submission.\n\nCheers,\nNikhil`,
    in_reply_to_id: convSarah.message.id
  });

  // Thread 2: Alex Rivera (Group collaboration with Nikhil & Sarah)
  await db.createMessage({
    sender_user_id: user3.id,
    to: [user1.email_address, user2.email_address],
    subject: 'Demo Day Pitch & Telephony IVR Walkthrough',
    body_text: `Team,\n\nWe are scheduled to present PhoneMail at the AlphaStack Buildathon demo slot. The judges will test:\n• Automatic PhoneMail generation (${user1.email_address})\n• Inbound external email simulation\n• Instant SMS notification delivery\n• Toll-free IVR account creation (press 1)\n\nAll systems are green! Please make sure Docker Compose tests pass cleanly.\n\nRegards,\nAlex Rivera\nFounder & Lead Architect`,
    attachments: [
      {
        id: 'att_pitch_deck',
        name: 'phonemail_pitch_deck_vFinal.pdf',
        size: 4800000,
        type: 'application/pdf',
        url: '#'
      }
    ]
  });

  // Thread 3: External Incoming Partner (Welcome to PhoneMail)
  await db.receiveInboundEmail({
    sender_email: 'team@phonemail.com',
    sender_name: 'PhoneMail Welcome Team',
    to_email: user1.email_address,
    subject: 'Welcome to your new PhoneMail inbox!',
    body_text: `Welcome to PhoneMail!\n\nYour phone number is now your official email address: ${user1.email_address}.\n\nYou can share this address with anyone worldwide. When someone emails you, it lands directly in your conversational inbox and sends you a quick SMS notification so you never miss an urgent update.\n\nTip: You can also configure aliases (like nikhil.lead@phonemail.com) under your Settings menu.\n\nHappy communicating,\nThe PhoneMail Team`
  });

  // Thread 4: Draft email for User 1
  await db.createMessage({
    sender_user_id: user1.id,
    to: ['investors@alphaventures.vc'],
    subject: 'Draft: PhoneMail Seed Round Summary & Metrics',
    body_text: `Dear Alpha Ventures Team,\n\nFollowing our buildathon showcase, here are the key operational metrics for PhoneMail:\n• 100% phone-number identity verification\n• Near-instant SMS alert turnaround (<500ms)\n• Zero setup friction with IVR toll-free dial-in\n\n[Need to insert monthly growth projection charts here]`,
    is_draft: true
  });

  // Thread 5: Spam message
  const spamMsg = await db.receiveInboundEmail({
    sender_email: 'prize-notify@winner-claim-center.biz',
    sender_name: 'Global Rewards Lottery',
    to_email: user1.email_address,
    subject: 'URGENT: Your phone number won $50,000 in international giveaway',
    body_text: `Congratulations! Your mobile number +9876543210 has been selected as the prime recipient in our sweepstakes. Click here immediately to claim your funds.`
  });
  await db.setSpamState(user1.id, spamMsg.message.id, true);

  // Thread 6: Trash message
  const trashMsg = await db.receiveInboundEmail({
    sender_email: 'newsletter@dailytechdigest.com',
    sender_name: 'Daily Tech Digest',
    to_email: user1.email_address,
    subject: 'Daily Tech Digest #184 — Microservices vs Modular Monoliths',
    body_text: `In today's edition: Why modular architectures are surging in 2026, plus top React 19 tips for responsive email clients.`
  });
  await db.setTrashState(user1.id, trashMsg.message.id, true);

  // Mark the Sarah thread as favorite
  await db.toggleFavorite(user1.id, convSarah.message.id, true);

  console.log('[SEED] Demo database successfully populated with rich conversations, attachments, drafts, spam, and trash.');
}
