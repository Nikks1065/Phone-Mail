import { db, normalizePhoneNumber } from './db.ts';
import { hashPassword, comparePassword, generateToken } from './auth.ts';

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
    // 1. Phone number normalization
    const normalized = normalizePhoneNumber('+1 (987) 654-3210');
    assert(normalized === '19876543210', 'Phone number normalization strips punctuation');

    // 2. Account creation
    const testPhone = '9991112222';
    const existing = await db.getUserByPhone(testPhone);
    const user = existing || await db.createUser({
      phone_number: testPhone,
      display_name: 'Test Runner User'
    });
    assert(user.email_address === `${testPhone}@phonemail.com`, 'User automatically gets <phone>@phonemail.com address');

    // 3. Password hashing
    const pw = 'SecretPass123!';
    const hashed = await hashPassword(pw);
    const isMatch = await comparePassword(pw, hashed);
    assert(isMatch === true, 'Password hashing and verification succeed');

    // 4. OTP Generation and Verification
    const otpCode = '654321';
    await db.saveOtp(testPhone, otpCode, 5);
    const verifySuccess = await db.verifyOtp(testPhone, otpCode);
    assert(verifySuccess.success === true, 'OTP verification succeeds with valid code');

    const verifyFail = await db.verifyOtp(testPhone, '000000');
    assert(verifyFail.success === false, 'OTP verification rejects invalid code');

    // 5. Aliases management
    const testRunId = Date.now().toString(36);
    const aliasEmail = `alias_${testRunId}.${testPhone}@phonemail.com`;
    const alias = await db.createAlias(user.id, aliasEmail);
    assert(alias.alias_email === aliasEmail, 'Alias creation succeeds');

    const userByAlias = await db.getUserByEmail(aliasEmail);
    assert(userByAlias?.id === user.id, 'User lookup by alias address resolves to owner');

    // 6. Direct Conversation Grouping
    const partnerPhone = '9993334444';
    const partner = await db.getUserByPhone(partnerPhone) || await db.createUser({
      phone_number: partnerPhone,
      display_name: 'Test Partner'
    });

    const msgResult1 = await db.createMessage({
      sender_user_id: user.id,
      to: [partner.email_address],
      subject: `Test Subject ${testRunId}`,
      body_text: 'Hello Partner'
    });
    assert(Boolean(msgResult1.message.id), 'Email message created successfully');

    const msgResult2 = await db.createMessage({
      sender_user_id: partner.id,
      to: [user.email_address],
      subject: `Re: Test Subject ${testRunId}`,
      body_text: 'Hello User'
    });
    assert(msgResult1.conversation.id === msgResult2.conversation.id, '1-to-1 messages group into the exact same canonical conversation thread');

    // 7. Group Conversation creation (2+ recipients)
    const thirdPhone = '9995556666';
    const thirdUser = await db.getUserByPhone(thirdPhone) || await db.createUser({
      phone_number: thirdPhone,
      display_name: 'Third Member'
    });

    const groupResult = await db.createMessage({
      sender_user_id: user.id,
      to: [partner.email_address, thirdUser.email_address],
      subject: `Group Planning ${testRunId}`,
      body_text: 'Hi all'
    });
    assert(groupResult.conversation.type === 'group', 'Composing with 2+ recipients creates a distinct group conversation');
    assert(groupResult.conversation.id !== msgResult1.conversation.id, 'Group conversation is distinct from 1-to-1 conversation');

    // 8. Single-Reply Constraint validation
    // Create a fresh message for reply test
    const freshMessageForReply = await db.createMessage({
      sender_user_id: user.id,
      to: [partner.email_address],
      subject: `Reply Subject ${testRunId}`,
      body_text: 'Message to be replied once'
    });

    const reply1 = await db.createMessage({
      sender_user_id: partner.id,
      conversation_id: freshMessageForReply.conversation.id,
      to: [user.email_address],
      subject: 'Reply to fresh message',
      body_text: 'First reply',
      in_reply_to_id: freshMessageForReply.message.id
    });
    assert(reply1.message.in_reply_to_id === freshMessageForReply.message.id, 'First reply linked successfully to parent message');

    let replyErrorThrown = false;
    try {
      await db.createMessage({
        sender_user_id: partner.id,
        conversation_id: freshMessageForReply.conversation.id,
        to: [user.email_address],
        subject: 'Accidental Duplicate Reply',
        body_text: 'Second duplicate reply',
        in_reply_to_id: freshMessageForReply.message.id // Attempting duplicate reply to same message!
      });
    } catch (err: any) {
      replyErrorThrown = true;
    }
    assert(replyErrorThrown === true, 'Backend enforces single-reply rule (rejects duplicate replies to same message)');

    // 9. Drafts persistence
    const draftResult = await db.createMessage({
      sender_user_id: user.id,
      to: [partner.email_address],
      subject: 'Draft Email',
      body_text: 'Unfinished thought',
      is_draft: true
    });
    assert(draftResult.message.is_draft === true, 'Draft email saved and flagged');

    // 10. Favorites, Spam, Trash states
    const stateTestMsg = await db.createMessage({
      sender_user_id: user.id,
      to: [partner.email_address],
      subject: `Folder State Test ${testRunId}`,
      body_text: 'Folder state test'
    });

    await db.toggleFavorite(user.id, stateTestMsg.message.id, true);
    let convsFav = await db.getUserConversations(user.id, 'favorites');
    assert(convsFav.some(c => c.id === stateTestMsg.conversation.id), 'Favorite filter returns favorited conversation');

    await db.setSpamState(user.id, stateTestMsg.message.id, true);
    let convsSpam = await db.getUserConversations(user.id, 'spam');
    assert(convsSpam.some(c => c.id === stateTestMsg.conversation.id), 'Moving to spam places conversation in spam folder');

    let convsInboxAfterSpam = await db.getUserConversations(user.id, 'inbox');
    assert(!convsInboxAfterSpam.some(c => c.id === stateTestMsg.conversation.id), 'Spam conversation is excluded from normal inbox');

    await db.setSpamState(user.id, stateTestMsg.message.id, false);
    await db.setTrashState(user.id, stateTestMsg.message.id, true);
    let convsTrash = await db.getUserConversations(user.id, 'trash');
    assert(convsTrash.some(c => c.id === stateTestMsg.conversation.id), 'Moving to trash places conversation in trash folder');

    // 11. Restore from trash
    await db.setTrashState(user.id, stateTestMsg.message.id, false);
    const restoredMsgs = await db.getConversationMessages(stateTestMsg.conversation.id, user.id);
    const restoredTarget = restoredMsgs.find(m => m.id === stateTestMsg.message.id);
    assert(restoredTarget?.is_trash === false, 'Restored message clears trash flag on the message');

    // 12. Duplicate account prevention
    let duplicateBlocked = false;
    try {
      await db.createUser({ phone_number: testPhone, display_name: 'Duplicate' });
    } catch {
      duplicateBlocked = true;
    }
    assert(duplicateBlocked, 'Duplicate phone number account creation is rejected');

    // 13. Draft edit
    const draftEdit = await db.createMessage({
      sender_user_id: user.id,
      to: [partner.email_address],
      subject: 'Editable Draft',
      body_text: 'v1',
      is_draft: true
    });
    const updatedDraft = await db.updateDraft(user.id, draftEdit.message.id, {
      subject: 'Editable Draft v2',
      body_text: 'v2 body'
    });
    assert(updatedDraft.subject === 'Editable Draft v2' && updatedDraft.body_text === 'v2 body', 'Draft messages can be edited');

    // 14. SMS deduplication
    const sms1 = await db.logSms({
      recipient_phone: testPhone,
      message_body: 'test',
      sender_email: 'a@b.com',
      subject: 's',
      status: 'simulated',
      provider: 'demo',
      related_message_id: stateTestMsg.message.id
    });
    const sms2 = await db.logSms({
      recipient_phone: testPhone,
      message_body: 'test again',
      sender_email: 'a@b.com',
      subject: 's',
      status: 'simulated',
      provider: 'demo',
      related_message_id: stateTestMsg.message.id
    });
    assert(sms1.id === sms2.id, 'Duplicate SMS for the same message id is prevented');

    // 15. OTP hash storage (plaintext not persisted)
    await db.saveOtp(testPhone, '111222', 5);
    const otpPlainStored = (db.getData().otps.find(o => o.phone_number === testPhone)?.code) === '111222';
    assert(otpPlainStored === false, 'OTP codes are stored hashed, not in plaintext');
    const otpOk = await db.verifyOtp(testPhone, '111222');
    assert(otpOk.success === true, 'Hashed OTP still verifies correctly');

    // 16. Search
    const searchHits = await db.getUserConversations(user.id, 'inbox', testRunId);
    assert(searchHits.length > 0, 'Search finds conversations by subject/content');

    console.log(`\n🏁 Test Suite Complete: ${passed} Passed, ${failed} Failed.`);
    if (failed > 0) {
      process.exit(1);
    }
  } catch (e: unknown) {
    console.error('Fatal test exception:', e);
    process.exit(1);
  }
}

runTests();
