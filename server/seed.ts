/**
 * Demo seed is OPT-IN only.
 * Set SEED_DEMO_DATA=true to populate sample accounts (disabled by default).
 */

import { db } from './db.ts';
import { hashPassword } from './auth.ts';

export async function seedDatabase(options: { force?: boolean } = {}) {
  await db.ready();

  const allowDemoSeed = process.env.SEED_DEMO_DATA === 'true';
  if (!allowDemoSeed) {
    console.log('[SEED] Demo seed disabled (SEED_DEMO_DATA!=true). Starting with SQL store as-is.');
    if (options.force) {
      console.log('[SEED] Force reset requested but demo seed is disabled — leaving database unchanged.');
    }
    return;
  }

  console.log('[SEED] SEED_DEMO_DATA=true — initializing optional demo data...');

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
    await db.flush();
  }

  const user1Phone = '9876543210';
  const user2Phone = '9123456789';
  const hashedPassword = await hashPassword('Password123!');

  let user1 = await db.getUserByPhone(user1Phone);
  if (!user1) {
    user1 = await db.createUser({
      phone_number: user1Phone,
      username: 'nikhil',
      display_name: 'Nikhil Nitt',
      password_hash: hashedPassword,
      language: 'en'
    });
  }

  let user2 = await db.getUserByPhone(user2Phone);
  if (!user2) {
    user2 = await db.createUser({
      phone_number: user2Phone,
      username: 'sarah',
      display_name: 'Sarah Chen',
      password_hash: hashedPassword,
      language: 'en'
    });
  }

  const existingConvs = await db.getUserConversations(user1.id, 'inbox');
  if (existingConvs.length > 0) {
    console.log('[SEED] Demo conversations already present. Skipping.');
    return;
  }

  await db.createMessage({
    sender_user_id: user2.id,
    to: [user1.email_address],
    subject: 'Hello from Sarah',
    body_text: 'Hi Nikhil — this is an optional demo thread.'
  });

  console.log('[SEED] Optional demo data loaded.');
}
