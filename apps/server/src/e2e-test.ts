import { io } from "socket.io-client";

const API = process.env.API_URL ?? "http://localhost:4000";

async function runTest() {
  console.log("=== PHASE 1 END-TO-END VALIDATION TEST ===");

  const timestamp = Date.now();
  const aliceEmail = `alice_${timestamp}@test.com`;
  const bobEmail = `bob_${timestamp}@test.com`;
  const malloryEmail = `mallory_${timestamp}@test.com`;
  const password = "Password123!";

  // 1. Register Alice
  console.log("1. Registering Alice...");
  const resAlice = await fetch(`${API}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "Alice Smith",
      username: `alice_${timestamp}`,
      email: aliceEmail,
      password
    })
  });
  if (!resAlice.ok) throw new Error(`Alice register failed: ${await resAlice.text()}`);
  const cookieAlice = resAlice.headers.get("set-cookie")?.split(";")[0] ?? "";
  const tokenAlice = cookieAlice.replace("token=", "");
  const { user: alice } = await resAlice.json();
  console.log("✓ Alice registered:", alice.id, alice.name);
  if (!alice.email) throw new Error("Registration did not return the account email");

  // 2. Register Bob
  console.log("2. Registering Bob...");
  const resBob = await fetch(`${API}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "Bob Jones",
      username: `bob_${timestamp}`,
      email: bobEmail,
      password
    })
  });
  if (!resBob.ok) throw new Error(`Bob register failed: ${await resBob.text()}`);
  const cookieBob = resBob.headers.get("set-cookie")?.split(";")[0] ?? "";
  const tokenBob = cookieBob.replace("token=", "");
  const { user: bob } = await resBob.json();
  console.log("✓ Bob registered:", bob.id, bob.name);

  // 3. Register Mallory (Attacker)
  console.log("3. Registering Mallory (Unauthorized test)...");
  const resMallory = await fetch(`${API}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "Mallory Eve",
      username: `mallory_${timestamp}`,
      email: malloryEmail,
      password
    })
  });
  const cookieMallory = resMallory.headers.get("set-cookie")?.split(";")[0] ?? "";
  const { user: mallory } = await resMallory.json();
  console.log("✓ Mallory registered:", mallory.id);

  // 4. User Search: Alice searches for Bob
  console.log("4. Alice searching for Bob...");
  const resSearch = await fetch(`${API}/api/users?q=bob_${timestamp}`, {
    headers: { Cookie: cookieAlice }
  });
  const { users: foundUsers } = await resSearch.json();
  if (!foundUsers.some((u: any) => u.id === bob.id)) {
    throw new Error("Search did not return Bob");
  }
  if (foundUsers.some((u: any) => "email" in u)) {
    throw new Error("User search exposed an account email address");
  }
  console.log("✓ User search verified: found Bob");

  // 5. Concurrent conversation requests must resolve to the same conversation
  console.log("5. Alice starting conversation with Bob...");
  const createConversation = () => fetch(`${API}/api/conversations`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookieAlice },
    body: JSON.stringify({ userId: bob.id })
  });
  const [resConv, resDuplicateConv] = await Promise.all([
    createConversation(),
    createConversation()
  ]);
  if (!resConv.ok || !resDuplicateConv.ok) {
    throw new Error(`Conversation creation failed: ${resConv.status}, ${resDuplicateConv.status}`);
  }
  const [{ conversation }, { conversation: duplicateConversation }] = await Promise.all([
    resConv.json(),
    resDuplicateConv.json()
  ]);
  if (conversation.id !== duplicateConversation.id) {
    throw new Error("Concurrent requests created duplicate conversations");
  }
  if (conversation.participants.some((participant: any) => "email" in participant)) {
    throw new Error("Conversation participant data exposed an account email address");
  }
  console.log("✓ Concurrent requests resolved to one conversation:", conversation.id);

  // 6. Connect authenticated sockets for Alice, Bob, and Mallory
  console.log("6. Connecting Socket.IO clients for Alice and Bob...");
  const socketAlice = io(API, {
    auth: { token: tokenAlice },
    extraHeaders: { Cookie: cookieAlice }
  });
  const socketBob = io(API, {
    auth: { token: tokenBob },
    extraHeaders: { Cookie: cookieBob }
  });
  const socketMallory = io(API, {
    auth: { token: cookieMallory.replace("token=", "") },
    extraHeaders: { Cookie: cookieMallory }
  });

  await Promise.all([socketAlice, socketBob, socketMallory].map((socket) =>
    new Promise<void>((resolve, reject) => {
      socket.once("connect", resolve);
      socket.once("connect_error", reject);
    })
  ));
  console.log("✓ All three Socket.IO clients connected and authenticated");

  // 7. Join conversation rooms
  await new Promise<void>((resolve) => {
    socketAlice.emit("conversation:join", conversation.id, () => {
      socketBob.emit("conversation:join", conversation.id, () => {
        resolve();
      });
    });
  });
  const unauthorizedJoin = await new Promise<any>((resolve) => {
    socketMallory.emit("conversation:join", conversation.id, resolve);
  });
  if (!unauthorizedJoin?.error) {
    throw new Error("Unauthorized user joined a conversation socket room");
  }
  console.log("✓ Both joined conversation room");

  // 8. Real-time messaging: Alice sends to Bob
  console.log("8. Real-time message exchange...");
  const bobReceivedPromise = new Promise<any>((resolve) => {
    socketBob.on("message:new", (m) => {
      if (m.text === "Hello Bob, this is a secure Phase 1 message!") {
        resolve(m);
      }
    });
  });

  socketAlice.emit("message:send", {
    conversationId: conversation.id,
    text: "Hello Bob, this is a secure Phase 1 message!"
  });

  const bobReceived = await bobReceivedPromise;
  console.log("✓ Bob received Alice's message in real time:", bobReceived.text);

  const unauthorizedSend = await new Promise<any>((resolve) => {
    socketMallory.emit("message:send", {
      conversationId: conversation.id,
      text: "Unauthorized message"
    }, resolve);
  });
  if (!unauthorizedSend?.error) {
    throw new Error("Unauthorized user sent a message to a conversation");
  }
  console.log("✓ Unauthorized socket room join and message send were rejected");

  // 9. Typing indicator test
  console.log("9. Testing typing indicator...");
  const typingPromise = new Promise<any>((resolve) => {
    socketBob.on("typing:update", (payload) => {
      if (payload.conversationId === conversation.id && payload.isTyping === true) {
        resolve(payload);
      }
    });
  });
  socketAlice.emit("typing", { conversationId: conversation.id, isTyping: true });
  const typingPayload = await typingPromise;
  console.log("✓ Bob received Alice's typing indicator:", typingPayload);

  // 10. Persistence & History check over HTTP
  console.log("10. Checking persistence & message history over HTTP...");
  const resMessages = await fetch(`${API}/api/conversations/${conversation.id}/messages`, {
    headers: { Cookie: cookieBob }
  });
  const { messages: history } = await resMessages.json();
  if (history.length !== 1 || history[0].text !== "Hello Bob, this is a secure Phase 1 message!") {
    throw new Error("Message history check failed");
  }
  console.log("✓ Message history verified from MongoDB:", history.length, "messages");

  // 11. Security & Authorization check: Mallory attempts to access Alice and Bob's conversation
  console.log("11. Verifying authorization (Mallory attempts access)...");
  const resMalloryAccess = await fetch(`${API}/api/conversations/${conversation.id}/messages`, {
    headers: { Cookie: cookieMallory }
  });
  if (resMalloryAccess.status === 404 || resMalloryAccess.status === 403) {
    console.log(`✓ Access properly denied to unauthorized user (status ${resMalloryAccess.status})`);
  } else {
    throw new Error(`Security breach! Mallory got status: ${resMalloryAccess.status}`);
  }

  // Clean up sockets
  socketAlice.disconnect();
  socketBob.disconnect();
  socketMallory.disconnect();

  console.log("\n==========================================");
  console.log("🎉 ALL PHASE 1 CORE REQUIREMENTS VERIFIED!");
  console.log("==========================================");
}

runTest().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
