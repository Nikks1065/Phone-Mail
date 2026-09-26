import { db, normalizePhoneNumber, isValidUsername, normalizeUsername } from './db.ts';
import { hashPassword, comparePassword } from './auth.ts';

async function runTests() {
  console.log('🧪 Starting PhoneMail backend test suite...\n');
  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string) {
    if (condition) {
      console.log(`  ✅ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${testName}`);
      failed++;
    }
  }

  try {
    await db.ready();
    console.log(`  (database backend: ${db.getBackend()})\n`);

    const normalized = normalizePhoneNumber('+1 (987) 654-3210');
    assert(normalized === '19876543210', 'Phone number normalization strips punctuation');
    assert(isValidUsername('alice') === true, 'Valid username accepted');
    assert(isValidUsername('1bad') === false, 'Username starting with digit rejected');
    assert(normalizeUsername('Alice') === 'alice', 'Username normalized to lowercase');

    const runId = Date.now().toString(36);
    const userAPhone = `55${String(Date.now()).slice(-8)}`;
    const userBPhone = `56${String(Date.now()).slice(-8)}`;
    const userAName = `alice_${runId}`;
    const userBName = `bob_${runId}`;
    const password = 'SecurePass123!';
    const hash = await hashPassword(password);

    const userA = await db.createUser({
      phone_number: userAPhone,
      username: userAName,
      display_name: 'Alice Test',
      password_hash: hash
    });
    assert(userA.username === userAName, 'User A created with username');
    assert(userA.email_address === `${userAPhone}@phonemail.com`, 'User gets phone@phonemail.com address');

    let duplicateUser = false;
    try {
      await db.createUser({
        phone_number: `57${String(Date.now()).slice(-8)}`,
        username: userAName,
        password_hash: hash
      });
    } catch {
      duplicateUser = true;
    }
    assert(duplicateUser, 'Duplicate username is rejected');

    const loaded = await db.getUserByUsername(userAName);
    assert(Boolean(loaded?.password_hash && loaded.password_hash !== password), 'Password stored as hash, not plaintext');
    assert(await comparePassword(password, loaded!.password_hash!), 'Password hash verifies correctly');

    const userB = await db.createUser({
      phone_number: userBPhone,
      username: userBName,
      display_name: 'Bob Test',
      password_hash: hash
    });

    const search = await db.searchUsersByUsername(userBName.slice(0, 5), userA.id);
    assert(search.some((u) => u.username === userBName), 'Username search finds other users');
    assert(!search.some((u) => u.id === userA.id), 'Username search excludes current user');

    // Username messaging via createMessage
    const msg1 = await db.createMessage({
      sender_user_id: userA.id,
      to: [userBName],
      subject: 'Hello Bob',
      body_text: 'Message from Alice via username'
    });
    assert(Boolean(msg1.message.id), 'Message sent to username');

    const msg2 = await db.createMessage({
      sender_user_id: userB.id,
      to: [userAName],
      subject: 'Re: Hello Bob',
      body_text: 'Reply from Bob'
    });
    assert(msg1.conversation.id === msg2.conversation.id, '1-to-1 username messages share one conversation');

    const bobInbox = await db.getUserConversations(userB.id, 'inbox');
    assert(bobInbox.some((c) => c.id === msg1.conversation.id), 'Recipient sees conversation in inbox');

    const aliceView = await db.getConversationMessages(msg1.conversation.id, userA.id);
    assert(aliceView.some((m) => m.body_text.includes('Reply from Bob')), 'Sender sees reply after refresh');

    // Single-reply constraint
    const fresh = await db.createMessage({
      sender_user_id: userA.id,
      to: [userBName],
      subject: `Reply test ${runId}`,
      body_text: 'Please reply once'
    });
    await db.createMessage({
      sender_user_id: userB.id,
      conversation_id: fresh.conversation.id,
      to: [userA.email_address],
      subject: 'Re',
      body_text: 'First reply',
      in_reply_to_id: fresh.message.id
    });
    let blocked = false;
    try {
      await db.createMessage({
        sender_user_id: userB.id,
        conversation_id: fresh.conversation.id,
        to: [userA.email_address],
        subject: 'Re',
        body_text: 'Second reply',
        in_reply_to_id: fresh.message.id
      });
    } catch {
      blocked = true;
    }
    assert(blocked, 'Single-reply constraint enforced');

    // Group conversation
    const userC = await db.createUser({
      phone_number: `58${String(Date.now()).slice(-8)}`,
      username: `carol_${runId}`,
      password_hash: hash
    });
    const group = await db.createMessage({
      sender_user_id: userA.id,
      to: [userBName, userC.username!],
      subject: 'Group chat',
      body_text: 'Hi all'
    });
    assert(group.conversation.type === 'group', 'Multi-username compose creates group conversation');

    // Persistence round-trip
    await db.flush();
    const again = await db.getUserByUsername(userAName);
    assert(again?.id === userA.id, 'User persists in SQL store after flush');

    console.log(`\n🏁 Test Suite Complete: ${passed} Passed, ${failed} Failed.`);
    if (failed > 0) process.exit(1);
  } catch (e: unknown) {
    console.error('Fatal test exception:', e);
    process.exit(1);
  }
}

runTests();
