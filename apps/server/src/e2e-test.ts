import { io } from "socket.io-client";

const API = process.env.API_URL ?? "http://localhost:4000";

// Sample valid media buffers for testing
const VALID_1X1_PNG = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, // PNG Signature
  0x00, 0x00, 0x00, 0x0d, // IHDR length
  0x49, 0x48, 0x44, 0x52, // "IHDR"
  0x00, 0x00, 0x00, 0x01, // width: 1
  0x00, 0x00, 0x00, 0x01, // height: 1
  0x08, 0x06, 0x00, 0x00, 0x00,
  0x1f, 0x15, 0xc4, 0x89, // CRC
  0x00, 0x00, 0x00, 0x0a, // IDAT length
  0x49, 0x44, 0x41, 0x54, // "IDAT"
  0x78, 0x9c, 0x63, 0x00, 0x01, 0x00, 0x00, 0x05, 0x00, 0x01,
  0x0d, 0x0a, 0x2d, 0xb4, // CRC
  0x00, 0x00, 0x00, 0x00, // IEND length
  0x49, 0x45, 0x4e, 0x44, // "IEND"
  0xae, 0x42, 0x60, 0x82  // CRC
]);

// Valid minimal MP4 structure with ftyp box
const VALID_MIN_MP4 = Buffer.concat([
  Buffer.from([0x00, 0x00, 0x00, 0x20]), // box length 32
  Buffer.from("ftypisom", "ascii"),      // major brand isom
  Buffer.from([0x00, 0x00, 0x02, 0x00]), // minor version
  Buffer.from("isomiso2mp41", "ascii"),  // compatible brands
  Buffer.from([0x00, 0x00, 0x00, 0x08]), // mdat length 8
  Buffer.from("mdat", "ascii")           // mdat box
]);

async function runTest() {
  console.log("====================================================");
  console.log("=== PHASE 1 & PHASE 2 END-TO-END VALIDATION TEST ===");
  console.log("====================================================\n");

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
  console.log("✓ User search verified: found Bob without leaking email");

  // 5. Concurrent conversation requests
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
  console.log("✓ Concurrent requests resolved to one conversation:", conversation.id);

  // 6. Connect authenticated sockets
  console.log("6. Connecting Socket.IO clients for Alice, Bob, and Mallory...");
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
  console.log("✓ Both joined conversation room; unauthorized user rejected");

  // 8. Phase 1 Text message exchange
  console.log("8. Real-time text message exchange...");
  const bobReceivedTextPromise = new Promise<any>((resolve) => {
    socketBob.on("message:new", (m) => {
      if (m.type === "text" && m.text === "Hello Bob, Phase 1 text messaging!") {
        resolve(m);
      }
    });
  });

  socketAlice.emit("message:send", {
    conversationId: conversation.id,
    text: "Hello Bob, Phase 1 text messaging!"
  });

  const bobReceivedText = await bobReceivedTextPromise;
  console.log("✓ Bob received Alice's text message in real time:", bobReceivedText.text);

  // 9. PHASE 2: Image Upload & Real-Time Delivery
  console.log("9. Phase 2: Alice uploads valid PNG image...");
  const bobReceivedImagePromise = new Promise<any>((resolve) => {
    socketBob.on("message:new", (m) => {
      if (m.type === "image") {
        resolve(m);
      }
    });
  });

  const formImage = new FormData();
  formImage.append("file", new Blob([VALID_1X1_PNG], { type: "image/png" }), "test-photo.png");
  formImage.append("caption", "Look at this test photo!");

  const resUploadImage = await fetch(`${API}/api/conversations/${conversation.id}/media`, {
    method: "POST",
    headers: {
      Cookie: cookieAlice
    },
    body: formImage
  });

  if (!resUploadImage.ok) {
    throw new Error(`Image upload failed: ${resUploadImage.status} ${await resUploadImage.text()}`);
  }
  const { message: uploadedImageMsg } = await resUploadImage.json();
  console.log("✓ Image uploaded successfully via HTTP:", uploadedImageMsg.id, "type:", uploadedImageMsg.type);
  if (uploadedImageMsg.type !== "image" || !uploadedImageMsg.mediaAssetId) {
    throw new Error("Image upload did not return correct media type or mediaAssetId");
  }
  if ("storageKey" in uploadedImageMsg || (uploadedImageMsg.media && "storageKey" in uploadedImageMsg.media)) {
    throw new Error("Security breach: Storage key leaked in HTTP response!");
  }

  const bobReceivedImage = await bobReceivedImagePromise;
  console.log("✓ Bob received Alice's image message via Socket.IO in real time!");
  if (bobReceivedImage.id !== uploadedImageMsg.id) {
    throw new Error("Received socket image message ID does not match uploaded message ID");
  }
  if ("storageKey" in bobReceivedImage || (bobReceivedImage.media && "storageKey" in bobReceivedImage.media)) {
    throw new Error("Security breach: Storage key leaked in Socket.IO event payload!");
  }

  // 10. PHASE 2: Video Upload & Real-Time Delivery
  console.log("10. Phase 2: Alice uploads valid MP4 video...");
  const bobReceivedVideoPromise = new Promise<any>((resolve) => {
    socketBob.on("message:new", (m) => {
      if (m.type === "video") {
        resolve(m);
      }
    });
  });

  const formVideo = new FormData();
  formVideo.append("file", new Blob([VALID_MIN_MP4], { type: "video/mp4" }), "test-video.mp4");
  formVideo.append("caption", "Check out this video clip");

  const resUploadVideo = await fetch(`${API}/api/conversations/${conversation.id}/media`, {
    method: "POST",
    headers: {
      Cookie: cookieAlice
    },
    body: formVideo
  });

  if (!resUploadVideo.ok) {
    throw new Error(`Video upload failed: ${resUploadVideo.status} ${await resUploadVideo.text()}`);
  }
  const { message: uploadedVideoMsg } = await resUploadVideo.json();
  console.log("✓ Video uploaded successfully:", uploadedVideoMsg.id, "type:", uploadedVideoMsg.type);

  const bobReceivedVideo = await bobReceivedVideoPromise;
  console.log("✓ Bob received Alice's video message via Socket.IO in real time!");
  if (bobReceivedVideo.type !== "video" || !bobReceivedVideo.mediaAssetId) {
    throw new Error("Video socket message missing type or mediaAssetId");
  }

  // 11. PHASE 2: Authorized Media Retrieval & Content Inspection
  console.log("11. Phase 2: Bob retrieves image media content...");
  const mediaAssetId = uploadedImageMsg.mediaAssetId;
  const resGetMedia = await fetch(`${API}/api/media/${mediaAssetId}`, {
    headers: { Cookie: cookieBob }
  });
  if (!resGetMedia.ok) {
    throw new Error(`Bob could not retrieve media: ${resGetMedia.status}`);
  }
  const mediaBuffer = Buffer.from(await resGetMedia.arrayBuffer());
  const contentType = resGetMedia.headers.get("content-type");
  const nosniff = resGetMedia.headers.get("x-content-type-options");
  const csp = resGetMedia.headers.get("content-security-policy");

  if (!contentType?.includes("image/png")) {
    throw new Error(`Expected content-type image/png, got ${contentType}`);
  }
  if (nosniff !== "nosniff") {
    throw new Error("Missing X-Content-Type-Options: nosniff header");
  }
  if (csp !== "default-src 'none'") {
    throw new Error("Missing safe Content-Security-Policy header");
  }
  console.log("✓ Bob retrieved media successfully with verified headers (CSP, nosniff, Content-Type: image/png)");

  // 12. PHASE 2: HTTP Byte-Range Request Test (Video Seeking)
  console.log("12. Phase 2: Testing HTTP byte-range request for video playback...");
  const videoAssetId = uploadedVideoMsg.mediaAssetId;
  const resRange = await fetch(`${API}/api/media/${videoAssetId}`, {
    headers: {
      Cookie: cookieBob,
      Range: "bytes=0-15"
    }
  });
  if (resRange.status !== 206) {
    throw new Error(`Expected status 206 Partial Content, got ${resRange.status}`);
  }
  const contentRange = resRange.headers.get("content-range");
  const acceptRanges = resRange.headers.get("accept-ranges");
  if (!contentRange?.startsWith("bytes 0-15/")) {
    throw new Error(`Invalid Content-Range header: ${contentRange}`);
  }
  if (acceptRanges !== "bytes") {
    throw new Error(`Invalid Accept-Ranges header: ${acceptRanges}`);
  }
  console.log("✓ HTTP Byte-range request verified (Status 206, Content-Range:", contentRange, ")");

  // 13. PHASE 2: Security & Authorization - Mallory Attempts Unauthorized Upload
  console.log("13. Phase 2: Mallory attempts unauthorized upload to Alice & Bob's conversation...");
  const formMalloryUpload = new FormData();
  formMalloryUpload.append("file", new Blob([VALID_1X1_PNG], { type: "image/png" }), "mallory.png");
  const resMalloryUpload = await fetch(`${API}/api/conversations/${conversation.id}/media`, {
    method: "POST",
    headers: {
      Cookie: cookieMallory
    },
    body: formMalloryUpload
  });
  if (resMalloryUpload.status === 404 || resMalloryUpload.status === 403) {
    console.log(`✓ Unauthorized media upload rejected (Status ${resMalloryUpload.status})`);
  } else {
    throw new Error(`Security breach! Mallory upload succeeded with status ${resMalloryUpload.status}`);
  }

  // 14. PHASE 2: Security & Authorization - Mallory Attempts Unauthorized Media Download
  console.log("14. Phase 2: Mallory attempts to download Alice's private media...");
  const resMalloryDownload = await fetch(`${API}/api/media/${mediaAssetId}`, {
    headers: { Cookie: cookieMallory }
  });
  if (resMalloryDownload.status === 404 || resMalloryDownload.status === 403) {
    console.log(`✓ Unauthorized media download rejected (Status ${resMalloryDownload.status})`);
  } else {
    throw new Error(`Security breach! Mallory downloaded media with status ${resMalloryDownload.status}`);
  }

  // 15. PHASE 2: Security - Invalid/Guessed Media ID
  console.log("15. Phase 2: Non-existent media ID returns safe 404 error...");
  const resNotFound = await fetch(`${API}/api/media/6ac92862c2238ce1f33cc000`, {
    headers: { Cookie: cookieBob }
  });
  if (resNotFound.status === 404) {
    console.log("✓ Safe 404 returned for unknown media ID");
  } else {
    throw new Error(`Expected 404, got ${resNotFound.status}`);
  }

  // 16. PHASE 2: Server-Side Validation - Spoofed File Rejected
  console.log("16. Phase 2: Testing spoofed file signature rejection (HTML disguised as image)...");
  const formSpoofed = new FormData();
  formSpoofed.append(
    "file",
    new Blob([Buffer.from("<html><script>alert(1)</script></html>", "utf-8")], { type: "image/jpeg" }),
    "evil.jpg"
  );
  const resSpoofed = await fetch(`${API}/api/conversations/${conversation.id}/media`, {
    method: "POST",
    headers: {
      Cookie: cookieAlice
    },
    body: formSpoofed
  });
  if (resSpoofed.status === 400) {
    console.log("✓ Spoofed file rejected with status 400");
  } else {
    throw new Error(`Expected status 400 for spoofed file, got ${resSpoofed.status}`);
  }

  // 17. PHASE 2: Server-Side Validation - Unsupported Format Rejected (SVG)
  console.log("17. Phase 2: Testing unsupported format rejection (SVG)...");
  const formSvg = new FormData();
  formSvg.append(
    "file",
    new Blob([Buffer.from("<svg></svg>", "utf-8")], { type: "image/svg+xml" }),
    "vector.svg"
  );
  const resSvg = await fetch(`${API}/api/conversations/${conversation.id}/media`, {
    method: "POST",
    headers: {
      Cookie: cookieAlice
    },
    body: formSvg
  });
  if (resSvg.status === 400) {
    console.log("✓ Disallowed format (SVG) rejected with status 400");
  } else {
    throw new Error(`Expected status 400 for SVG, got ${resSvg.status}`);
  }

  // 18. Message History & Persistence Verification (MongoDB)
  console.log("18. Verifying full message history persistence in MongoDB...");
  const resHistory = await fetch(`${API}/api/conversations/${conversation.id}/messages`, {
    headers: { Cookie: cookieBob }
  });
  const { messages: history } = await resHistory.json();
  console.log("✓ Retrieved", history.length, "persisted messages");
  if (history.length !== 3) {
    throw new Error(`Expected 3 messages in history, got ${history.length}`);
  }
  const [msg1, msg2, msg3] = history;
  if (msg1.type !== "text" || msg2.type !== "image" || msg3.type !== "video") {
    throw new Error(`Unexpected message sequence: [${msg1.type}, ${msg2.type}, ${msg3.type}]`);
  }
  if (!msg2.media || !msg3.media) {
    throw new Error("Persisted media messages missing populated media metadata DTOs");
  }
  console.log("✓ All messages verified in chronological order with correct types (text, image, video)");

  // 19. Conversation List Preview Update
  console.log("19. Verifying conversation list preview...");
  const resConvList = await fetch(`${API}/api/conversations`, {
    headers: { Cookie: cookieBob }
  });
  const { conversations: convList } = await resConvList.json();
  const currentConv = convList.find((c: any) => c.id === conversation.id);
  if (!currentConv?.lastMessage) {
    throw new Error("Conversation missing lastMessage reference");
  }
  if (currentConv.lastMessage.type !== "video") {
    throw new Error(`Expected lastMessage type video, got ${currentConv.lastMessage.type}`);
  }
  console.log("✓ Conversation list correctly reflects latest media message (type: video)");

  // 20. Clean up sockets
  socketAlice.disconnect();
  socketBob.disconnect();
  socketMallory.disconnect();

  console.log("\n========================================================");
  console.log("🎉 ALL PHASE 1 & PHASE 2 E2E TEST REQUIREMENTS VERIFIED!");
  console.log("========================================================");
}

runTest().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
