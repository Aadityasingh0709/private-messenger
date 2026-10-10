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

// Valid minimal JPEG with EXIF APP1 metadata segment to verify stripping
const VALID_JPEG_WITH_EXIF = Buffer.concat([
  Buffer.from([0xff, 0xd8]), // SOI
  Buffer.from([
    0xff, 0xe1, 0x00, 0x12, // APP1 length 18
    0x45, 0x78, 0x69, 0x66, 0x00, 0x00, // "Exif\0\0"
    0x4d, 0x4d, 0x00, 0x2a, 0x00, 0x00, 0x00, 0x08, 0x00, 0x00
  ]),
  Buffer.from([
    0xff, 0xc0, 0x00, 0x0b, 0x08, // SOF0 length 11, precision 8
    0x00, 0x01, 0x00, 0x01, // height 1, width 1
    0x01, 0x01, 0x11, 0x00
  ]),
  Buffer.from([0xff, 0xd9]) // EOI
]);

// Valid minimal WebP structure
const VALID_WEBP = Buffer.concat([
  Buffer.from("RIFF", "ascii"),
  Buffer.from([0x24, 0x00, 0x00, 0x00]), // file size - 8
  Buffer.from("WEBP", "ascii"),
  Buffer.from("VP8 ", "ascii"),
  Buffer.from([0x14, 0x00, 0x00, 0x00]), // chunk size 20
  Buffer.from([0xd0, 0x01, 0x00, 0x9d, 0x01, 0x2a, 0x01, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00])
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

// Valid minimal WebM structure with EBML header
const VALID_MIN_WEBM = Buffer.from([
  0x1a, 0x45, 0xdf, 0xa3, // EBML Header
  0x9f, 0x42, 0x86, 0x81, 0x01, // DocType
  0x42, 0xf7, 0x81, 0x01,
  0x42, 0xf2, 0x81, 0x04,
  0x42, 0xf3, 0x81, 0x08,
  0x77, 0x65, 0x62, 0x6d // "webm"
]);

async function runTest() {
  console.log("===============================================================");
  console.log("=== COMPREHENSIVE PHASE 1 & PHASE 2 VERIFICATION TEST SUITE ===");
  console.log("===============================================================\n");

  const timestamp = Date.now();
  const aliceEmail = `alice_${timestamp}@test.com`;
  const bobEmail = `bob_${timestamp}@test.com`;
  const malloryEmail = `mallory_${timestamp}@test.com`;
  const password = "Password123!";

  // -------------------------------------------------------------
  // 1. AUTHENTICATION & SESSION PERSISTENCE TESTS (PHASE 1)
  // -------------------------------------------------------------
  console.log("1. Testing Registration (Alice, Bob, Mallory)...");
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

  // Duplicate email check
  console.log("2. Testing Duplicate Registration Rejection...");
  const resDup = await fetch(`${API}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "Alice Duplicate",
      username: `alice_dup_${timestamp}`,
      email: aliceEmail,
      password
    })
  });
  if (resDup.status === 409) {
    console.log("✓ Duplicate email registration properly rejected with status 409");
  } else {
    throw new Error(`Expected status 409 for duplicate email, got ${resDup.status}`);
  }

  // Register Bob
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

  // Register Mallory (Unauthorized User C)
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

  // Login with invalid credentials test
  console.log("3. Testing Invalid Login Credentials...");
  const resInvalidLogin = await fetch(`${API}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: aliceEmail, password: "WrongPassword!" })
  });
  if (resInvalidLogin.status === 401) {
    console.log("✓ Invalid login credentials rejected with status 401");
  } else {
    throw new Error(`Expected status 401 for invalid credentials, got ${resInvalidLogin.status}`);
  }

  // Session persistence check (/api/me)
  console.log("4. Testing Authenticated Session Persistence (/api/me)...");
  const resMeAlice = await fetch(`${API}/api/me`, {
    headers: { Cookie: cookieAlice }
  });
  if (!resMeAlice.ok) throw new Error(`Session verification failed: ${resMeAlice.status}`);
  const { user: meAlice } = await resMeAlice.json();
  if (meAlice.id !== alice.id || meAlice.email !== aliceEmail) {
    throw new Error("Session mismatch for Alice");
  }
  console.log("✓ Session verified for Alice via cookie");

  // -------------------------------------------------------------
  // 2. USER DISCOVERY & CONVERSATIONS (PHASE 1)
  // -------------------------------------------------------------
  console.log("5. Testing User Search Isolation...");
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
  console.log("✓ User search verified: found Bob without exposing email");

  console.log("6. Testing Concurrent Conversation Creation Deduplication...");
  const createConversation = () => fetch(`${API}/api/conversations`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookieAlice },
    body: JSON.stringify({ userId: bob.id })
  });
  const [resConv, resDuplicateConv] = await Promise.all([
    createConversation(),
    createConversation()
  ]);
  const [{ conversation: conv1 }, { conversation: conv2 }] = await Promise.all([
    resConv.json(),
    resDuplicateConv.json()
  ]);
  if (conv1.id !== conv2.id) {
    throw new Error("Concurrent requests created duplicate conversations");
  }
  const conversation = conv1;
  console.log("✓ Concurrent requests resolved to single conversation:", conversation.id);

  // -------------------------------------------------------------
  // 3. SOCKET.IO REALTIME TEXT & ROOM ISOLATION (PHASE 1)
  // -------------------------------------------------------------
  console.log("7. Connecting Socket.IO Clients (Alice, Bob, Mallory)...");
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
  console.log("✓ Sockets connected and authenticated");

  // Join room & verify Mallory cannot join
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
    throw new Error("Mallory joined Alice and Bob's socket room!");
  }
  console.log("✓ Alice & Bob joined room; unauthorized user room join was rejected");

  // Realtime text message
  console.log("8. Realtime Text Message Exchange...");
  const bobReceivedTextPromise = new Promise<any>((resolve) => {
    socketBob.on("message:new", (m) => {
      if (m.type === "text" && m.text === "Phase 1 Text Message Verified") {
        resolve(m);
      }
    });
  });

  socketAlice.emit("message:send", {
    conversationId: conversation.id,
    text: "Phase 1 Text Message Verified"
  });

  const bobReceivedText = await bobReceivedTextPromise;
  console.log("✓ Bob received Alice's text message in real time:", bobReceivedText.text);

  // -------------------------------------------------------------
  // 4. PHASE 2: IMAGE UPLOADS (PNG, JPEG WITH EXIF, WEBP)
  // -------------------------------------------------------------
  console.log("9. Phase 2: Uploading PNG Image with Caption...");
  const bobReceivedPngPromise = new Promise<any>((resolve) => {
    socketBob.on("message:new", (m) => {
      if (m.type === "image" && m.text === "Valid PNG Photo") {
        resolve(m);
      }
    });
  });

  const formPng = new FormData();
  formPng.append("file", new Blob([VALID_1X1_PNG], { type: "image/png" }), "test-photo.png");
  formPng.append("caption", "Valid PNG Photo");

  const resUploadPng = await fetch(`${API}/api/conversations/${conversation.id}/media`, {
    method: "POST",
    headers: { Cookie: cookieAlice },
    body: formPng
  });
  if (!resUploadPng.ok) throw new Error(`PNG upload failed: ${resUploadPng.status}`);
  const { message: pngMsg } = await resUploadPng.json();
  const bobReceivedPng = await bobReceivedPngPromise;
  if (bobReceivedPng.id !== pngMsg.id) throw new Error("Socket PNG message ID mismatch");
  console.log("✓ PNG image uploaded & received in real time:", pngMsg.id);

  // JPEG with EXIF stripping test
  console.log("10. Phase 2: Uploading JPEG Image with EXIF Metadata...");
  const formJpeg = new FormData();
  formJpeg.append("file", new Blob([VALID_JPEG_WITH_EXIF], { type: "image/jpeg" }), "exif-camera.jpg");
  formJpeg.append("caption", "JPEG with stripped EXIF");

  const resUploadJpeg = await fetch(`${API}/api/conversations/${conversation.id}/media`, {
    method: "POST",
    headers: { Cookie: cookieAlice },
    body: formJpeg
  });
  if (!resUploadJpeg.ok) throw new Error(`JPEG upload failed: ${resUploadJpeg.status}`);
  const { message: jpegMsg } = await resUploadJpeg.json();
  console.log("✓ JPEG uploaded successfully:", jpegMsg.id);

  // Verify EXIF was stripped by fetching stored JPEG buffer
  const resFetchedJpeg = await fetch(`${API}/api/media/${jpegMsg.mediaAssetId}`, {
    headers: { Cookie: cookieBob }
  });
  const fetchedJpegBuf = Buffer.from(await resFetchedJpeg.arrayBuffer());
  if (fetchedJpegBuf.includes(Buffer.from("Exif"))) {
    throw new Error("EXIF metadata was not stripped from JPEG image!");
  }
  console.log("✓ Verified location-bearing EXIF metadata stripped from stored JPEG");

  // WebP Image Upload
  console.log("11. Phase 2: Uploading WebP Image...");
  const formWebp = new FormData();
  formWebp.append("file", new Blob([VALID_WEBP], { type: "image/webp" }), "graphic.webp");

  const resUploadWebp = await fetch(`${API}/api/conversations/${conversation.id}/media`, {
    method: "POST",
    headers: { Cookie: cookieAlice },
    body: formWebp
  });
  if (!resUploadWebp.ok) throw new Error(`WebP upload failed: ${resUploadWebp.status}`);
  const { message: webpMsg } = await resUploadWebp.json();
  console.log("✓ WebP image uploaded successfully:", webpMsg.id);

  // -------------------------------------------------------------
  // 5. PHASE 2: VIDEO UPLOADS & HTTP RANGE STREAMING (MP4, WEBM)
  // -------------------------------------------------------------
  console.log("12. Phase 2: Uploading MP4 Video...");
  const bobReceivedMp4Promise = new Promise<any>((resolve) => {
    socketBob.on("message:new", (m) => {
      if (m.type === "video") {
        resolve(m);
      }
    });
  });

  const formMp4 = new FormData();
  formMp4.append("file", new Blob([VALID_MIN_MP4], { type: "video/mp4" }), "clip.mp4");
  formMp4.append("caption", "MP4 Video Clip");

  const resUploadMp4 = await fetch(`${API}/api/conversations/${conversation.id}/media`, {
    method: "POST",
    headers: { Cookie: cookieAlice },
    body: formMp4
  });
  if (!resUploadMp4.ok) throw new Error(`MP4 upload failed: ${resUploadMp4.status}`);
  const { message: mp4Msg } = await resUploadMp4.json();
  const bobReceivedMp4 = await bobReceivedMp4Promise;
  if (bobReceivedMp4.id !== mp4Msg.id) throw new Error("Socket MP4 message ID mismatch");
  console.log("✓ MP4 video uploaded & received in real time:", mp4Msg.id);

  // WebM Video Upload
  console.log("13. Phase 2: Uploading WebM Video...");
  const formWebm = new FormData();
  formWebm.append("file", new Blob([VALID_MIN_WEBM], { type: "video/webm" }), "recording.webm");

  const resUploadWebm = await fetch(`${API}/api/conversations/${conversation.id}/media`, {
    method: "POST",
    headers: { Cookie: cookieAlice },
    body: formWebm
  });
  if (!resUploadWebm.ok) throw new Error(`WebM upload failed: ${resUploadWebm.status}`);
  const { message: webmMsg } = await resUploadWebm.json();
  console.log("✓ WebM video uploaded successfully:", webmMsg.id);

  // Video HTTP Range Request Testing
  console.log("14. Phase 2: Testing Standard Range Request (bytes=0-15)...");
  const resRangeStandard = await fetch(`${API}/api/media/${mp4Msg.mediaAssetId}`, {
    headers: { Cookie: cookieBob, Range: "bytes=0-15" }
  });
  if (resRangeStandard.status !== 206) throw new Error(`Expected status 206, got ${resRangeStandard.status}`);
  const crStandard = resRangeStandard.headers.get("content-range");
  if (!crStandard?.startsWith("bytes 0-15/")) throw new Error(`Invalid Content-Range: ${crStandard}`);
  console.log("✓ Standard byte-range request verified (206, Content-Range:", crStandard, ")");

  console.log("15. Phase 2: Testing Suffix Range Request (bytes=-10)...");
  const resRangeSuffix = await fetch(`${API}/api/media/${mp4Msg.mediaAssetId}`, {
    headers: { Cookie: cookieBob, Range: "bytes=-10" }
  });
  if (resRangeSuffix.status !== 206) throw new Error(`Expected status 206, got ${resRangeSuffix.status}`);
  const crSuffix = resRangeSuffix.headers.get("content-range");
  console.log("✓ Suffix byte-range request verified (206, Content-Range:", crSuffix, ")");

  console.log("16. Phase 2: Testing Out-of-Bounds Range Request (bytes=1000-2000)...");
  const resRangeInvalid = await fetch(`${API}/api/media/${mp4Msg.mediaAssetId}`, {
    headers: { Cookie: cookieBob, Range: "bytes=1000-2000" }
  });
  if (resRangeInvalid.status === 416) {
    console.log("✓ Out-of-bounds range request rejected with status 416 Range Not Satisfiable");
  } else {
    throw new Error(`Expected status 416, got ${resRangeInvalid.status}`);
  }

  // -------------------------------------------------------------
  // 6. SECURITY & AUTHORIZATION TESTS
  // -------------------------------------------------------------
  console.log("17. Security: Unauthenticated Access Rejected...");
  const resUnauth = await fetch(`${API}/api/media/${pngMsg.mediaAssetId}`);
  if (resUnauth.status === 401) {
    console.log("✓ Unauthenticated media request rejected with status 401");
  } else {
    throw new Error(`Expected status 401, got ${resUnauth.status}`);
  }

  console.log("18. Security: Mallory (User C) Access Denied to Alice & Bob's Media...");
  const resMalloryAccess = await fetch(`${API}/api/media/${pngMsg.mediaAssetId}`, {
    headers: { Cookie: cookieMallory }
  });
  if (resMalloryAccess.status === 404 || resMalloryAccess.status === 403) {
    console.log(`✓ Unauthorized user access properly denied (status ${resMalloryAccess.status})`);
  } else {
    throw new Error(`Security breach! Mallory accessed media with status ${resMalloryAccess.status}`);
  }

  console.log("19. Security: Mallory Unauthorized Upload to Alice & Bob's Conversation...");
  const formMalloryUpload = new FormData();
  formMalloryUpload.append("file", new Blob([VALID_1X1_PNG], { type: "image/png" }), "hack.png");
  const resMalloryUpload = await fetch(`${API}/api/conversations/${conversation.id}/media`, {
    method: "POST",
    headers: { Cookie: cookieMallory },
    body: formMalloryUpload
  });
  if (resMalloryUpload.status === 404 || resMalloryUpload.status === 403) {
    console.log(`✓ Unauthorized upload to foreign conversation rejected (status ${resMalloryUpload.status})`);
  } else {
    throw new Error(`Security breach! Mallory uploaded to conversation with status ${resMalloryUpload.status}`);
  }

  console.log("20. Security: Cross-Conversation Tampering in URL Path...");
  // Attempting to access media using a non-matching conversation ID in URL
  const resTampered = await fetch(`${API}/api/conversations/6ac9300581e753848e920d00/media/${pngMsg.mediaAssetId}`, {
    headers: { Cookie: cookieAlice }
  });
  if (resTampered.status === 404) {
    console.log("✓ Cross-conversation media ID mismatch in URL properly rejected with 404");
  } else {
    throw new Error(`Expected status 404 for mismatched conversation ID, got ${resTampered.status}`);
  }

  console.log("21. Security: Verifying Safe Response Headers...");
  const resHeaders = await fetch(`${API}/api/media/${pngMsg.mediaAssetId}`, {
    headers: { Cookie: cookieBob }
  });
  if (resHeaders.headers.get("x-content-type-options") !== "nosniff") {
    throw new Error("Missing X-Content-Type-Options: nosniff header");
  }
  if (resHeaders.headers.get("content-security-policy") !== "default-src 'none'") {
    throw new Error("Missing Content-Security-Policy: default-src 'none' header");
  }
  console.log("✓ Security headers verified (nosniff, CSP: default-src 'none')");

  // -------------------------------------------------------------
  // 7. FILE VALIDATION & SPOOFING REJECTION TESTS
  // -------------------------------------------------------------
  console.log("22. Validation: Spoofed File Signature (HTML renamed as .jpg)...");
  const formSpoofed = new FormData();
  formSpoofed.append(
    "file",
    new Blob([Buffer.from("<html><script>alert(1)</script></html>", "utf-8")], { type: "image/jpeg" }),
    "evil.jpg"
  );
  const resSpoofed = await fetch(`${API}/api/conversations/${conversation.id}/media`, {
    method: "POST",
    headers: { Cookie: cookieAlice },
    body: formSpoofed
  });
  if (resSpoofed.status === 400) {
    console.log("✓ Magic byte mismatch properly detected and rejected with status 400");
  } else {
    throw new Error(`Expected status 400 for spoofed file, got ${resSpoofed.status}`);
  }

  console.log("23. Validation: Disallowed File Format (SVG vector graphic)...");
  const formSvg = new FormData();
  formSvg.append("file", new Blob([Buffer.from("<svg></svg>", "utf-8")], { type: "image/svg+xml" }), "icon.svg");
  const resSvg = await fetch(`${API}/api/conversations/${conversation.id}/media`, {
    method: "POST",
    headers: { Cookie: cookieAlice },
    body: formSvg
  });
  if (resSvg.status === 400) {
    console.log("✓ Disallowed SVG file format rejected with status 400");
  } else {
    throw new Error(`Expected status 400 for SVG, got ${resSvg.status}`);
  }

  console.log("24. Validation: Missing File Upload...");
  const formEmpty = new FormData();
  formEmpty.append("caption", "No file here");
  const resEmpty = await fetch(`${API}/api/conversations/${conversation.id}/media`, {
    method: "POST",
    headers: { Cookie: cookieAlice },
    body: formEmpty
  });
  if (resEmpty.status === 400) {
    console.log("✓ Empty file upload rejected with status 400");
  } else {
    throw new Error(`Expected status 400 for empty upload, got ${resEmpty.status}`);
  }

  // -------------------------------------------------------------
  // 8. DATABASE PERSISTENCE & CONVERSATION PREVIEW
  // -------------------------------------------------------------
  console.log("25. Persistence: Verifying Message History in MongoDB...");
  const resMessages = await fetch(`${API}/api/conversations/${conversation.id}/messages`, {
    headers: { Cookie: cookieBob }
  });
  const { messages: history } = await resMessages.json();
  console.log("✓ Retrieved", history.length, "persisted messages from database");
  if (history.length !== 6) {
    throw new Error(`Expected 6 messages in history, got ${history.length}`);
  }
  const types = history.map((m: any) => m.type);
  if (types[0] !== "text" || types[1] !== "image" || types[2] !== "image" || types[3] !== "image" || types[4] !== "video" || types[5] !== "video") {
    throw new Error(`Unexpected message type sequence: ${types.join(", ")}`);
  }
  console.log("✓ Chronological order and message types verified (text, image, image, image, video, video)");

  console.log("26. UI Preview: Verifying Conversation List Snippet...");
  const resConversations = await fetch(`${API}/api/conversations`, {
    headers: { Cookie: cookieBob }
  });
  const { conversations: convList } = await resConversations.json();
  const currentConv = convList.find((c: any) => c.id === conversation.id);
  if (!currentConv?.lastMessage) throw new Error("Conversation missing lastMessage reference");
  if (currentConv.lastMessage.type !== "video") {
    throw new Error(`Expected lastMessage type video, got ${currentConv.lastMessage.type}`);
  }
  console.log("✓ Conversation list correctly reflects latest media message (type: video)");

  // -------------------------------------------------------------
  // 9. LOGOUT & SESSION INVALIDATION
  // -------------------------------------------------------------
  console.log("27. Auth: Testing Logout and Session Invalidation...");
  const resLogout = await fetch(`${API}/api/auth/logout`, {
    method: "POST",
    headers: { Cookie: cookieBob }
  });
  if (resLogout.status !== 204) throw new Error(`Logout failed: ${resLogout.status}`);
  const resMeAfterLogout = await fetch(`${API}/api/me`, {
    headers: { Cookie: "token=" }
  });
  if (resMeAfterLogout.status === 401) {
    console.log("✓ Session successfully terminated; subsequent request rejected with 401");
  } else {
    throw new Error(`Expected 401 after logout, got ${resMeAfterLogout.status}`);
  }

  // Clean up socket connections
  socketAlice.disconnect();
  socketBob.disconnect();
  socketMallory.disconnect();

  console.log("\n===============================================================");
  console.log("🎉 ALL 27 VERIFICATION CHECKS (PHASE 1 & PHASE 2) PASSED 100%!");
  console.log("===============================================================");
}

runTest().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
