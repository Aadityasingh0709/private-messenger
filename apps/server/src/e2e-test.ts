import { io } from "socket.io-client";

const API = "http://localhost:4000";

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
  console.log("✓ User search verified: found Bob");

  // 5. Create Conversation: Alice starts conversation with Bob
  console.log("5. Alice starting conversation with Bob...");
  const resConv = await fetch(`${API}/api/conversations`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookieAlice },
    body: JSON.stringify({ userId: bob.id })
  });
  const { conversation } = await resConv.json();
  console.log("✓ Conversation created:", conversation.id);

  // 6. Connect Sockets for Alice and Bob
  console.log("6. Connecting Socket.IO clients for Alice and Bob...");
  const socketAlice = io(API, {
    auth: { token: tokenAlice },
    extraHeaders: { Cookie: cookieAlice }
  });
  const socketBob = io(API, {
    auth: { token: tokenBob },
    extraHeaders: { Cookie: cookieBob }
  });

  await new Promise<void>((resolve) => {
    let connected = 0;
    const check = () => { if (++connected === 2) resolve(); };
    socketAlice.on("connect", check);
    socketBob.on("connect", check);
  });
  console.log("✓ Both Socket.IO clients connected and authenticated");

  // 7. Join conversation rooms
  await new Promise<void>((resolve) => {
    socketAlice.emit("conversation:join", conversation.id, () => {
      socketBob.emit("conversation:join", conversation.id, () => {
        resolve();
      });
    });
  });
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

  console.log("\n==========================================");
  console.log("🎉 ALL PHASE 1 CORE REQUIREMENTS VERIFIED!");
  console.log("==========================================");
}

runTest().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
