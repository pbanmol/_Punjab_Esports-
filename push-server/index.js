const http = require("http");
const admin = require("firebase-admin");

const DB_URL =
  process.env.FIREBASE_DATABASE_URL ||
  "https://punjab-turnaments-default-rtdb.asia-southeast1.firebasedatabase.app";
const PORT = Number(process.env.PORT || 8080);
const STARTED_AT = Date.now();

function loadServiceAccount() {
  const raw = (process.env.FIREBASE_SERVICE_ACCOUNT || "").trim();
  if (!raw) {
    throw new Error(
      "Missing FIREBASE_SERVICE_ACCOUNT environment variable. Paste your Firebase Service Account JSON."
    );
  }
  try {
    return JSON.parse(raw);
  } catch (_) {
    const decoded = Buffer.from(raw, "base64").toString("utf8");
    return JSON.parse(decoded);
  }
}

const serviceAccount = loadServiceAccount();
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: DB_URL
});

const db = admin.database();
const messaging = admin.messaging();

// In-memory state to prevent duplicate alerts and boot-time replay
const seenNotifIds = new Set();
const seenMailIds = new Set();
const seenDmIds = new Set();
const seenAnnIds = new Set();
const walletBalances = new Map();
const userDiamonds = new Map();
const depositStatuses = new Map();
const withdrawalStatuses = new Map();
const matchResultSnapshots = new Map();
const roomCredSnapshots = new Map();
const recentSentKeys = new Map();

const attachedNotifUids = new Set();
const attachedMailUids = new Set();
const attachedDmUids = new Set();

function fmtRupees(val) {
  const n = Number(val || 0);
  if (Math.abs(n - Math.round(n)) < 0.005) {
    return `₹${Math.round(n)}`;
  }
  return `₹${n.toFixed(2)}`;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function extractTsMs(obj) {
  if (!obj || typeof obj !== "object") return 0;
  const ts = Number(obj.createdAt || obj.timestamp || obj.time || 0);
  if (!Number.isFinite(ts) || ts <= 0) return 0;
  return ts < 100000000000 ? ts * 1000 : ts;
}

function isDuplicateKey(key) {
  if (!key) return false;
  const now = Date.now();
  for (const [k, exp] of recentSentKeys.entries()) {
    if (exp <= now) recentSentKeys.delete(k);
  }
  if (recentSentKeys.has(key)) return true;
  recentSentKeys.set(key, now + 60_000);
  return false;
}

async function hasRecentAdminNotification(uid, regex, windowMs = 10000) {
  try {
    const snap = await db.ref(`notifications/${uid}`).limitToLast(8).once("value");
    const map = snap.val();
    if (!map || typeof map !== "object") return false;
    const cutoff = Date.now() - windowMs;
    return Object.entries(map).some(([id, item]) => {
      if (!item || typeof item !== "object") return false;
      if (item.synthetic === true || id.startsWith("auto_")) return false;
      const tsMs = extractTsMs(item);
      if (tsMs < cutoff) return false;
      const text = `${item.type || ""} ${item.title || ""} ${item.body || item.message || ""}`;
      return regex.test(text);
    });
  } catch (_) {
    return false;
  }
}

async function getUserTokens(uid) {
  try {
    const snap = await db.ref(`users/${uid}`).once("value");
    const user = snap.val();
    if (!user || typeof user !== "object") return [];
    const tokenSet = new Set();
    if (typeof user.fcmToken === "string" && user.fcmToken.trim()) {
      tokenSet.add(user.fcmToken.trim());
    }
    if (user.fcmTokens && typeof user.fcmTokens === "object") {
      Object.values(user.fcmTokens).forEach((entry) => {
        if (entry && typeof entry.token === "string" && entry.token.trim()) {
          tokenSet.add(entry.token.trim());
        }
      });
    }
    return Array.from(tokenSet);
  } catch (err) {
    console.error(`[FCM] Failed reading tokens for ${uid}:`, err.message);
    return [];
  }
}

async function sendToUser(uid, { title, body, target, dedupeKey, tag, extraData }) {
  if (!uid) return;
  if (dedupeKey && isDuplicateKey(dedupeKey)) return;

  const tokens = await getUserTokens(uid);
  if (!tokens.length) return;

  const dataPayload = {
    title: String(title || "Punjab Esports"),
    body: String(body || "You have a new update."),
    target: String(target || "notifications"),
    dedupeKey: String(dedupeKey || "")
  };
  if (extraData && typeof extraData === "object") {
    Object.entries(extraData).forEach(([k, v]) => {
      if (v !== undefined && v !== null) {
        dataPayload[k] = String(v);
      }
    });
  }

  const androidNotif = {
    channelId: "punjab_esports_alerts",
    priority: "high",
    sound: "default",
    defaultVibrateTimings: true,
    visibility: "public"
  };
  if (tag) {
    androidNotif.tag = String(tag);
  }

  try {
    const response = await messaging.sendEachForMulticast({
      tokens,
      notification: {
        title: String(title || "Punjab Esports"),
        body: String(body || "You have a new update.")
      },
      data: dataPayload,
      android: {
        priority: "high",
        notification: androidNotif
      }
    });

    const invalidTokens = [];
    response.responses.forEach((res, idx) => {
      if (!res.success) {
        const code = res.error?.code || "";
        if (
          code === "messaging/registration-token-not-registered" ||
          code === "messaging/invalid-registration-token"
        ) {
          invalidTokens.push(tokens[idx]);
        }
      }
    });

    if (invalidTokens.length) {
      const snap = await db.ref(`users/${uid}/fcmTokens`).once("value");
      const map = snap.val() || {};
      const updates = {};
      Object.entries(map).forEach(([k, v]) => {
        if (v && invalidTokens.includes(v.token)) {
          updates[`users/${uid}/fcmTokens/${k}`] = null;
        }
      });
      if (Object.keys(updates).length) {
        await db.ref().update(updates);
      }
    }
  } catch (err) {
    console.error(`[FCM] Send failed for ${uid}:`, err.message);
  }
}

function attachUserNotifListener(uid, preloadedKeys) {
  if (!uid || attachedNotifUids.has(uid)) return;
  attachedNotifUids.add(uid);
  if (preloadedKeys) {
    preloadedKeys.forEach((k) => seenNotifIds.add(`${uid}:${k}`));
  }

  db.ref(`notifications/${uid}`).on("child_added", async (snap) => {
    const notifId = String(snap.key || "");
    const composite = `${uid}:${notifId}`;
    if (seenNotifIds.has(composite)) return;
    seenNotifIds.add(composite);

    const data = snap.val();
    if (!data || typeof data !== "object") return;
    if (data.read === true || data.type === "announcement") return;
    if (data.synthetic === true || notifId.startsWith("auto_")) return;

    const tsMs = extractTsMs(data);
    if (tsMs > 0 && tsMs < STARTED_AT - 15_000) return;

    const text = `${data.type || ""} ${data.title || ""} ${data.body || data.message || ""}`;
    let tag = `notif_${notifId}`;
    if (/diamond/i.test(text)) {
      tag = "diamonds_update";
    } else if (/wallet|balance|deposit|withdraw|refund|₹/i.test(text)) {
      tag = "wallet_balance";
    }

    await sendToUser(uid, {
      title: data.title || "New Notification",
      body: data.body || data.message || "Tap to view in Punjab Esports.",
      target: "notifications",
      dedupeKey: `notif:${notifId}`,
      tag
    });
  });
}

function attachUserMailboxListener(uid, preloadedKeys) {
  if (!uid || attachedMailUids.has(uid)) return;
  attachedMailUids.add(uid);
  if (preloadedKeys) {
    preloadedKeys.forEach((k) => seenMailIds.add(`${uid}:${k}`));
  }

  db.ref(`users/${uid}/mailbox`).on("child_added", async (snap) => {
    const mailId = String(snap.key || "");
    const composite = `${uid}:${mailId}`;
    if (seenMailIds.has(composite)) return;
    seenMailIds.add(composite);

    if (mailId === "welcome_vip_7d") return;
    const data = snap.val();
    if (!data || typeof data !== "object") return;
    if (data.deleted || data.status !== "unclaimed") return;

    const tsMs = extractTsMs(data);
    if (tsMs > 0 && tsMs < STARTED_AT - 15_000) return;

    await sendToUser(uid, {
      title: "New Gift in Mailbox!",
      body: data.title || "Claim your reward within 7 days before it expires.",
      target: "mailbox",
      dedupeKey: `mail:${mailId}`,
      tag: `mail_${mailId}`
    });
  });
}

function attachUserDmListener(uid, preloadedKeys) {
  if (!uid || attachedDmUids.has(uid)) return;
  attachedDmUids.add(uid);
  if (preloadedKeys) {
    preloadedKeys.forEach((k) => seenDmIds.add(`${uid}:${k}`));
  }

  db.ref(`adminMessages/${uid}`).on("child_added", async (snap) => {
    const msgId = String(snap.key || "");
    const composite = `${uid}:${msgId}`;
    if (seenDmIds.has(composite)) return;
    seenDmIds.add(composite);

    const data = snap.val();
    if (!data || typeof data !== "object") return;
    if (data.deleted || data.from === "user") return;

    const tsMs = extractTsMs(data);
    if (tsMs > 0 && tsMs < STARTED_AT - 15_000) return;

    await sendToUser(uid, {
      title: "Official Admin Reply",
      body: data.text || "Official Admin sent you a reply.",
      target: "admindm",
      dedupeKey: `dm:${msgId}`,
      tag: "admindm"
    });
  });
}

async function handleWalletBalanceChange(uid, afterRaw) {
  if (afterRaw === null || afterRaw === undefined) return;
  const after = Number(afterRaw);
  if (Number.isNaN(after)) return;

  if (!walletBalances.has(uid)) {
    walletBalances.set(uid, after);
    return;
  }

  const before = walletBalances.get(uid);
  walletBalances.set(uid, after);

  const diff = Math.round((after - before) * 100) / 100;
  if (Math.abs(diff) < 0.01) return;

  await sleep(1200);
  const alreadySentByAdmin = await hasRecentAdminNotification(
    uid,
    /wallet|balance|deposit|withdraw|reward|prize|bonus|refund|admin|₹/i,
    10000
  );
  if (alreadySentByAdmin) return;

  const actionLabel =
    diff > 0 ? `+${fmtRupees(diff)} added` : `${fmtRupees(Math.abs(diff))} deducted`;

  await sendToUser(uid, {
    title: "Wallet Balance Updated",
    body: `Your wallet was updated by admin (${actionLabel}). New balance: ${fmtRupees(after)}.`,
    target: "notifications",
    dedupeKey: `fcm_bal:${uid}:${Math.round(after * 100)}:${Math.floor(Date.now() / 10000)}`,
    tag: "wallet_balance",
    extraData: { newBalance: String(after) }
  });
}

async function handleDiamondsChange(uid, afterRaw) {
  if (afterRaw === null || afterRaw === undefined) return;
  const after = Number(afterRaw);
  if (Number.isNaN(after)) return;

  if (!userDiamonds.has(uid)) {
    userDiamonds.set(uid, after);
    return;
  }

  const before = userDiamonds.get(uid);
  userDiamonds.set(uid, after);

  const diff = after - before;
  if (diff === 0) return;

  await sleep(1200);
  const alreadySentByAdmin = await hasRecentAdminNotification(uid, /diamond/i, 10000);
  if (alreadySentByAdmin) return;

  const actionLabel =
    diff > 0 ? `+${diff} Diamonds added` : `${Math.abs(diff)} Diamonds deducted`;

  await sendToUser(uid, {
    title: "Diamonds Updated by Admin",
    body: `Your diamonds were updated by admin (${actionLabel}). Total: ${after} Diamonds.`,
    target: "notifications",
    dedupeKey: `fcm_dia:${uid}:${after}:${Math.floor(Date.now() / 10000)}`,
    tag: "diamonds_update"
  });
}

async function handleRequestStatusChange(type, reqId, req) {
  if (!req || typeof req !== "object" || !req.userId) return;
  const after = String(req.status || "").toLowerCase();
  const map = type === "deposit" ? depositStatuses : withdrawalStatuses;
  const before = map.get(reqId) || "";
  map.set(reqId, after);

  if (!before || before === after || !["approved", "completed", "rejected"].includes(after)) {
    return;
  }

  await sleep(1200);
  const regex = type === "deposit" ? /deposit/i : /withdraw/i;
  const alreadySentByAdmin = await hasRecentAdminNotification(req.userId, regex, 10000);
  if (alreadySentByAdmin) return;

  const approved = after === "approved" || after === "completed";
  const isDep = type === "deposit";
  await sendToUser(req.userId, {
    title: isDep
      ? approved
        ? "Deposit Approved"
        : "Deposit Rejected"
      : approved
      ? "Withdrawal Approved"
      : "Withdrawal Rejected",
    body: isDep
      ? approved
        ? `Your deposit of ${fmtRupees(req.amount)} has been approved and added to your wallet.`
        : `Your deposit of ${fmtRupees(req.amount)} was rejected${req.reason ? ": " + req.reason : "."}`
      : approved
      ? `Your withdrawal of ${fmtRupees(req.amount)} has been processed.`
      : `Your withdrawal of ${fmtRupees(req.amount)} was rejected${req.reason ? ": " + req.reason : "."}`,
    target: "notifications",
    dedupeKey: `req:${type}:${reqId}:${after}`,
    tag: "wallet_balance"
  });
}

async function handleMatchResultChange(matchId, after) {
  const before = matchResultSnapshots.get(matchId) || {};
  matchResultSnapshots.set(matchId, after ? JSON.parse(JSON.stringify(after)) : {});

  if (!after || !after.entries || typeof after.entries !== "object") return;
  const afterStatus = String(after.status || "").toLowerCase();
  const beforeStatus = String(before.status || "").toLowerCase();
  if (afterStatus !== "approved") return;

  const justApproved = beforeStatus !== "approved";
  const matchSnap = await db.ref(`tournaments/${matchId}`).once("value");
  const match = matchSnap.val() || {};
  const matchTitle = match.title || "Tournament Match";

  const beforeEntries =
    before && before.entries && typeof before.entries === "object" ? before.entries : {};

  for (const [uid, entry] of Object.entries(after.entries)) {
    if (!uid || !entry || typeof entry !== "object") continue;
    const prevEntry = beforeEntries[uid];
    const changed =
      justApproved ||
      !prevEntry ||
      Number(prevEntry.rank || 0) !== Number(entry.rank || 0) ||
      Number(prevEntry.kills || 0) !== Number(entry.kills || 0) ||
      Number(prevEntry.reward || 0) !== Number(entry.reward || 0);
    if (!changed) continue;

    const rankNum = Number(entry.rank || 0);
    const killsNum = Number(entry.kills || 0);
    const rewardNum = Number(entry.reward || 0);
    const rankLabel =
      rankNum === 1
        ? "Rank #1"
        : rankNum === 2
        ? "Rank #2"
        : rankNum === 3
        ? "Rank #3"
        : rankNum > 0
        ? `Rank #${rankNum}`
        : "Result Updated";
    const rewardPart = rewardNum > 0 ? ` • Prize: ${fmtRupees(rewardNum)}` : "";

    await sendToUser(uid, {
      title: "Match Result Declared!",
      body: `${matchTitle}: ${rankLabel} • ${killsNum} Kills${rewardPart}`,
      target: "notifications",
      dedupeKey: `result:${matchId}:${uid}:${rankNum}:${killsNum}:${Math.round(rewardNum * 100)}`,
      tag: `result_${matchId}`
    });
  }
}

async function handleRoomCredsChange(matchId, after) {
  const before = roomCredSnapshots.get(matchId) || {};
  const nextObj = {
    roomId: String((after && after.roomId) || ""),
    roomPass: String((after && after.roomPass) || "")
  };
  roomCredSnapshots.set(matchId, nextObj);

  if (!nextObj.roomId && !nextObj.roomPass) return;
  if (before.roomId === nextObj.roomId && before.roomPass === nextObj.roomPass) return;

  const [matchSnap, regSnap] = await Promise.all([
    db.ref(`tournaments/${matchId}`).once("value"),
    db.ref("registrations").orderByChild("matchId").equalTo(matchId).once("value")
  ]);
  const match = matchSnap.val() || {};
  const matchTitle = match.title || "Your Match";
  const regs = regSnap.val();
  if (!regs || typeof regs !== "object") return;

  const uidSet = new Set();
  Object.values(regs).forEach((r) => {
    if (r && r.userId && String(r.status || "confirmed").toLowerCase() !== "cancelled") {
      uidSet.add(r.userId);
    }
  });

  for (const uid of uidSet) {
    await sendToUser(uid, {
      title: "Room ID & Password Live!",
      body: `${matchTitle} — Room ID & Password are now ready. Open Punjab Esports to join!`,
      target: "notifications",
      dedupeKey: `room:${matchId}:${nextObj.roomId}:${nextObj.roomPass}`,
      tag: `room_${matchId}`
    });
  }
}

async function bootstrapWatchers() {
  console.log("[PushServer] Loading initial snapshots from RTDB...");

  const [
    usersSnap,
    walletsSnap,
    notifsSnap,
    dmSnap,
    depSnap,
    wdSnap,
    resSnap,
    roomSnap,
    annSnap
  ] = await Promise.all([
    db.ref("users").once("value"),
    db.ref("wallets").once("value"),
    db.ref("notifications").once("value"),
    db.ref("adminMessages").once("value"),
    db.ref("depositRequests").once("value"),
    db.ref("withdrawalRequests").once("value"),
    db.ref("matchResults").once("value"),
    db.ref("privateRoomCredentials").once("value"),
    db.ref("announcements").once("value")
  ]);

  // 1. Preload users (diamonds + mailbox)
  const usersVal = usersSnap.val() || {};
  Object.entries(usersVal).forEach(([uid, u]) => {
    if (!u || typeof u !== "object") return;
    if (u.diamonds !== undefined && u.diamonds !== null) {
      userDiamonds.set(uid, Number(u.diamonds) || 0);
    }
    const mailKeys = u.mailbox && typeof u.mailbox === "object" ? Object.keys(u.mailbox) : [];
    attachUserMailboxListener(uid, mailKeys);
  });

  // 2. Preload wallets
  const walletsVal = walletsSnap.val() || {};
  Object.entries(walletsVal).forEach(([uid, w]) => {
    if (w && w.balance !== undefined && w.balance !== null) {
      walletBalances.set(uid, Number(w.balance) || 0);
    }
  });

  // 3. Preload notifications
  const notifsVal = notifsSnap.val() || {};
  Object.entries(notifsVal).forEach(([uid, map]) => {
    const keys = map && typeof map === "object" ? Object.keys(map) : [];
    attachUserNotifListener(uid, keys);
  });

  // 4. Preload admin DMs
  const dmVal = dmSnap.val() || {};
  Object.entries(dmVal).forEach(([uid, map]) => {
    const keys = map && typeof map === "object" ? Object.keys(map) : [];
    attachUserDmListener(uid, keys);
  });

  // 5. Preload deposit & withdrawal statuses
  Object.entries(depSnap.val() || {}).forEach(([id, req]) => {
    if (req && req.status) depositStatuses.set(id, String(req.status).toLowerCase());
  });
  Object.entries(wdSnap.val() || {}).forEach(([id, req]) => {
    if (req && req.status) withdrawalStatuses.set(id, String(req.status).toLowerCase());
  });

  // 6. Preload matchResults & room credentials
  Object.entries(resSnap.val() || {}).forEach(([matchId, val]) => {
    matchResultSnapshots.set(matchId, val || {});
  });
  Object.entries(roomSnap.val() || {}).forEach(([matchId, val]) => {
    roomCredSnapshots.set(matchId, {
      roomId: String((val && val.roomId) || ""),
      roomPass: String((val && val.roomPass) || "")
    });
  });

  // 7. Preload announcements
  Object.keys(annSnap.val() || {}).forEach((annId) => seenAnnIds.add(annId));

  // === ATTACH LIVE WATCHERS ===

  // Users: watch new users + diamonds updates
  db.ref("users").on("child_added", (snap) => {
    const uid = snap.key;
    const u = snap.val() || {};
    if (!userDiamonds.has(uid) && u.diamonds !== undefined && u.diamonds !== null) {
      userDiamonds.set(uid, Number(u.diamonds) || 0);
    }
    attachUserMailboxListener(uid, null);
    attachUserNotifListener(uid, null);
    attachUserDmListener(uid, null);
  });
  db.ref("users").on("child_changed", (snap) => {
    const uid = snap.key;
    const u = snap.val() || {};
    if (u.diamonds !== undefined) {
      handleDiamondsChange(uid, u.diamonds);
    }
    attachUserMailboxListener(uid, null);
  });

  // Wallets: watch live balance updates
  db.ref("wallets").on("child_added", (snap) => {
    const uid = snap.key;
    const w = snap.val();
    if (w && w.balance !== undefined) {
      handleWalletBalanceChange(uid, w.balance);
    }
  });
  db.ref("wallets").on("child_changed", (snap) => {
    const uid = snap.key;
    const w = snap.val();
    if (w && w.balance !== undefined) {
      handleWalletBalanceChange(uid, w.balance);
    }
  });

  // Notifications & AdminMessages roots (for brand-new user nodes)
  db.ref("notifications").on("child_added", (snap) => {
    attachUserNotifListener(snap.key, null);
  });
  db.ref("adminMessages").on("child_added", (snap) => {
    attachUserDmListener(snap.key, null);
  });

  // Deposit & Withdrawal Requests
  db.ref("depositRequests").on("child_added", (snap) => {
    const req = snap.val();
    if (req && req.status && !depositStatuses.has(snap.key)) {
      depositStatuses.set(snap.key, String(req.status).toLowerCase());
    }
  });
  db.ref("depositRequests").on("child_changed", (snap) => {
    handleRequestStatusChange("deposit", snap.key, snap.val());
  });

  db.ref("withdrawalRequests").on("child_added", (snap) => {
    const req = snap.val();
    if (req && req.status && !withdrawalStatuses.has(snap.key)) {
      withdrawalStatuses.set(snap.key, String(req.status).toLowerCase());
    }
  });
  db.ref("withdrawalRequests").on("child_changed", (snap) => {
    handleRequestStatusChange("withdrawal", snap.key, snap.val());
  });

  // Match Results
  db.ref("matchResults").on("child_added", (snap) => {
    if (!matchResultSnapshots.has(snap.key)) {
      handleMatchResultChange(snap.key, snap.val());
    }
  });
  db.ref("matchResults").on("child_changed", (snap) => {
    handleMatchResultChange(snap.key, snap.val());
  });

  // Room Credentials
  db.ref("privateRoomCredentials").on("child_added", (snap) => {
    if (!roomCredSnapshots.has(snap.key)) {
      handleRoomCredsChange(snap.key, snap.val());
    }
  });
  db.ref("privateRoomCredentials").on("child_changed", (snap) => {
    handleRoomCredsChange(snap.key, snap.val());
  });

  // Broadcast Announcements
  db.ref("announcements").on("child_added", async (snap) => {
    const annId = String(snap.key || "");
    if (seenAnnIds.has(annId)) return;
    seenAnnIds.add(annId);

    const data = snap.val();
    if (!data || data.active === false) return;
    const tsMs = extractTsMs(data);
    if (tsMs > 0 && tsMs < STARTED_AT - 15_000) return;

    try {
      await messaging.send({
        topic: "all_users",
        notification: {
          title: String(data.title || "Punjab Esports Announcement"),
          body: String(data.body || data.message || data.text || "New announcement available.")
        },
        data: {
          title: String(data.title || "Punjab Esports Announcement"),
          body: String(data.body || data.message || data.text || "New announcement available."),
          target: "notifications",
          dedupeKey: `ann:${annId}`
        },
        android: {
          priority: "high",
          notification: {
            channelId: "punjab_esports_alerts",
            priority: "high",
            sound: "default",
            visibility: "public",
            tag: `ann_${annId}`
          }
        }
      });
    } catch (err) {
      console.error("[FCM] Announcement send failed:", err.message);
    }
  });

  console.log(
    `[PushServer] LIVE! Watching ${Object.keys(usersVal).length} users on ${DB_URL}`
  );
}

// Health check HTTP server (keeps Render.com / UptimeRobot 24x7 awake)
const server = http.createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(
    JSON.stringify({
      ok: true,
      service: "punjab-esports-push-server",
      uptimeSec: Math.floor((Date.now() - STARTED_AT) / 1000)
    })
  );
});

server.listen(PORT, () => {
  console.log(`[PushServer] Health endpoint listening on port ${PORT}`);
  bootstrapWatchers().catch((err) => {
    console.error("[PushServer] Fatal bootstrap error:", err);
    process.exit(1);
  });
});
