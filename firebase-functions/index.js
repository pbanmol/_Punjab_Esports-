const { onValueCreated, onValueUpdated, onValueWritten } = require("firebase-functions/v2/database");
const admin = require("firebase-admin");

admin.initializeApp();

const DB_INSTANCE = "punjab-turnaments-default-rtdb";
const REGION = "asia-southeast1";

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

async function hasRecentAdminNotification(uid, regex, windowMs = 10000) {
  try {
    const snap = await admin.database().ref(`notifications/${uid}`).limitToLast(8).once("value");
    const map = snap.val();
    if (!map || typeof map !== "object") return false;
    const cutoff = Date.now() - windowMs;
    return Object.entries(map).some(([id, item]) => {
      if (!item || typeof item !== "object") return false;
      if (item.synthetic === true || id.startsWith("auto_")) return false;
      const ts = Number(item.createdAt || item.timestamp || item.time || 0);
      const tsMs = ts > 0 && ts < 100000000000 ? ts * 1000 : ts;
      if (tsMs < cutoff) return false;
      const text = `${item.type || ""} ${item.title || ""} ${item.body || item.message || ""}`;
      return regex.test(text);
    });
  } catch (e) {
    return false;
  }
}

async function getUserTokens(uid) {
  const snap = await admin.database().ref(`users/${uid}`).once("value");
  const user = snap.val();
  if (!user) return [];
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
}

async function sendToUser(uid, { title, body, target, dedupeKey, tag, extraData }) {
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
    sound: "default",
    defaultVibrateTimings: true,
    visibility: "public"
  };
  if (tag) {
    androidNotif.tag = String(tag);
  }

  const response = await admin.messaging().sendEachForMulticast({
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
    const snap = await admin.database().ref(`users/${uid}/fcmTokens`).once("value");
    const map = snap.val() || {};
    const updates = {};
    Object.entries(map).forEach(([k, v]) => {
      if (v && invalidTokens.includes(v.token)) {
        updates[`users/${uid}/fcmTokens/${k}`] = null;
      }
    });
    if (Object.keys(updates).length) {
      await admin.database().ref().update(updates);
    }
  }
}

exports.onUserNotificationCreated = onValueCreated(
  { ref: "/notifications/{uid}/{notifId}", instance: DB_INSTANCE, region: REGION },
  async (event) => {
    const notifId = String(event.params.notifId || "");
    const data = event.data.val();
    if (!data || data.read === true || data.type === "announcement") return;
    if (data.synthetic === true || notifId.startsWith("auto_")) return;

    const text = `${data.type || ""} ${data.title || ""} ${data.body || data.message || ""}`;
    let tag = `notif_${notifId}`;
    if (/diamond/i.test(text)) {
      tag = "diamonds_update";
    } else if (/wallet|balance|deposit|withdraw|refund|₹/i.test(text)) {
      tag = "wallet_balance";
    }

    await sendToUser(event.params.uid, {
      title: data.title || "New Notification",
      body: data.body || data.message || "Tap to view in Punjab Esports.",
      target: "notifications",
      dedupeKey: `notif:${notifId}`,
      tag
    });
  }
);

exports.onWalletBalanceUpdated = onValueWritten(
  { ref: "/wallets/{uid}/balance", instance: DB_INSTANCE, region: REGION },
  async (event) => {
    const beforeRaw = event.data.before.val();
    const afterRaw = event.data.after.val();
    if (afterRaw === null || afterRaw === undefined) return;
    const before = beforeRaw === null || beforeRaw === undefined ? 0 : Number(beforeRaw);
    const after = Number(afterRaw);
    if (Number.isNaN(before) || Number.isNaN(after)) return;
    if ((beforeRaw === null || beforeRaw === undefined) && after === 0) return;

    const diff = Math.round((after - before) * 100) / 100;
    if (Math.abs(diff) < 0.01) return;

    // Wait briefly so if Admin already wrote an official notification to notifications/{uid},
    // we do NOT send a duplicate second notification.
    await sleep(1200);
    const alreadySentByAdmin = await hasRecentAdminNotification(
      event.params.uid,
      /wallet|balance|deposit|withdraw|reward|prize|bonus|refund|admin|₹/i,
      10000
    );
    if (alreadySentByAdmin) return;

    const actionLabel = diff > 0
      ? `+${fmtRupees(diff)} added`
      : `${fmtRupees(Math.abs(diff))} deducted`;
    await sendToUser(event.params.uid, {
      title: "Wallet Balance Updated",
      body: `Your wallet was updated by admin (${actionLabel}). New balance: ${fmtRupees(after)}.`,
      target: "notifications",
      dedupeKey: `fcm_bal:${event.params.uid}:${Math.round(after * 100)}:${Math.floor(Date.now() / 10000)}`,
      tag: "wallet_balance",
      extraData: { newBalance: String(after) }
    });
  }
);

exports.onUserDiamondsUpdated = onValueWritten(
  { ref: "/users/{uid}/diamonds", instance: DB_INSTANCE, region: REGION },
  async (event) => {
    const beforeRaw = event.data.before.val();
    const afterRaw = event.data.after.val();
    if (afterRaw === null || afterRaw === undefined) return;
    const before = beforeRaw === null || beforeRaw === undefined ? 0 : Number(beforeRaw);
    const after = Number(afterRaw);
    if (Number.isNaN(before) || Number.isNaN(after)) return;
    if ((beforeRaw === null || beforeRaw === undefined) && after === 0) return;

    const diff = after - before;
    if (diff === 0) return;

    await sleep(1200);
    const alreadySentByAdmin = await hasRecentAdminNotification(
      event.params.uid,
      /diamond/i,
      10000
    );
    if (alreadySentByAdmin) return;

    const actionLabel = diff > 0
      ? `+${diff} Diamonds added`
      : `${Math.abs(diff)} Diamonds deducted`;
    await sendToUser(event.params.uid, {
      title: "Diamonds Updated by Admin",
      body: `Your diamonds were updated by admin (${actionLabel}). Total: ${after} Diamonds.`,
      target: "notifications",
      dedupeKey: `fcm_dia:${event.params.uid}:${after}:${Math.floor(Date.now() / 10000)}`,
      tag: "diamonds_update"
    });
  }
);

exports.onDepositStatusUpdated = onValueUpdated(
  { ref: "/depositRequests/{reqId}/status", instance: DB_INSTANCE, region: REGION },
  async (event) => {
    const before = String(event.data.before.val() || "").toLowerCase();
    const after = String(event.data.after.val() || "").toLowerCase();
    if (before === after || !["approved", "completed", "rejected"].includes(after)) return;
    const reqSnap = await admin.database().ref(`depositRequests/${event.params.reqId}`).once("value");
    const req = reqSnap.val();
    if (!req || !req.userId) return;

    await sleep(1200);
    const alreadySentByAdmin = await hasRecentAdminNotification(req.userId, /deposit/i, 10000);
    if (alreadySentByAdmin) return;

    const approved = after === "approved" || after === "completed";
    await sendToUser(req.userId, {
      title: approved ? "Deposit Approved" : "Deposit Rejected",
      body: approved
        ? `Your deposit of ${fmtRupees(req.amount)} has been approved and added to your wallet.`
        : `Your deposit of ${fmtRupees(req.amount)} was rejected${req.reason ? ": " + req.reason : "."}`,
      target: "notifications",
      dedupeKey: `req:depositRequests:${event.params.reqId}:${after}`,
      tag: "wallet_balance"
    });
  }
);

exports.onWithdrawalStatusUpdated = onValueUpdated(
  { ref: "/withdrawalRequests/{reqId}/status", instance: DB_INSTANCE, region: REGION },
  async (event) => {
    const before = String(event.data.before.val() || "").toLowerCase();
    const after = String(event.data.after.val() || "").toLowerCase();
    if (before === after || !["approved", "completed", "rejected"].includes(after)) return;
    const reqSnap = await admin.database().ref(`withdrawalRequests/${event.params.reqId}`).once("value");
    const req = reqSnap.val();
    if (!req || !req.userId) return;

    await sleep(1200);
    const alreadySentByAdmin = await hasRecentAdminNotification(req.userId, /withdraw/i, 10000);
    if (alreadySentByAdmin) return;

    const approved = after === "approved" || after === "completed";
    await sendToUser(req.userId, {
      title: approved ? "Withdrawal Approved" : "Withdrawal Rejected",
      body: approved
        ? `Your withdrawal of ${fmtRupees(req.amount)} has been processed.`
        : `Your withdrawal of ${fmtRupees(req.amount)} was rejected${req.reason ? ": " + req.reason : "."}`,
      target: "notifications",
      dedupeKey: `req:withdrawalRequests:${event.params.reqId}:${after}`,
      tag: "wallet_balance"
    });
  }
);

exports.onMatchResultWritten = onValueWritten(
  { ref: "/matchResults/{matchId}", instance: DB_INSTANCE, region: REGION },
  async (event) => {
    const before = event.data.before.val() || {};
    const after = event.data.after.val();
    if (!after || !after.entries || typeof after.entries !== "object") return;
    const afterStatus = String(after.status || "").toLowerCase();
    const beforeStatus = String(before.status || "").toLowerCase();
    if (afterStatus !== "approved") return;

    const justApproved = beforeStatus !== "approved";
    const matchSnap = await admin.database().ref(`tournaments/${event.params.matchId}`).once("value");
    const match = matchSnap.val() || {};
    const matchTitle = match.title || "Tournament Match";

    const beforeEntries = (before && before.entries && typeof before.entries === "object") ? before.entries : {};
    const entries = Object.entries(after.entries);
    for (const [uid, entry] of entries) {
      if (!uid || !entry || typeof entry !== "object") continue;
      const prevEntry = beforeEntries[uid];
      const changed = justApproved || !prevEntry ||
        Number(prevEntry.rank || 0) !== Number(entry.rank || 0) ||
        Number(prevEntry.kills || 0) !== Number(entry.kills || 0) ||
        Number(prevEntry.reward || 0) !== Number(entry.reward || 0);
      if (!changed) continue;

      const rankNum = Number(entry.rank || 0);
      const killsNum = Number(entry.kills || 0);
      const rewardNum = Number(entry.reward || 0);
      const rankLabel = rankNum === 1 ? "Rank #1"
        : rankNum === 2 ? "Rank #2"
        : rankNum === 3 ? "Rank #3"
        : (rankNum > 0 ? `Rank #${rankNum}` : "Result Updated");
      const rewardPart = rewardNum > 0 ? ` • Prize: ${fmtRupees(rewardNum)}` : "";

      await sendToUser(uid, {
        title: "Match Result Declared!",
        body: `${matchTitle}: ${rankLabel} • ${killsNum} Kills${rewardPart}`,
        target: "notifications",
        dedupeKey: `result:${event.params.matchId}:${uid}:${rankNum}:${killsNum}:${Math.round(rewardNum * 100)}`,
        tag: `result_${event.params.matchId}`
      });
    }
  }
);

exports.onRoomCredentialsWritten = onValueWritten(
  { ref: "/privateRoomCredentials/{matchId}", instance: DB_INSTANCE, region: REGION },
  async (event) => {
    const before = event.data.before.val() || {};
    const after = event.data.after.val();
    if (!after || (!after.roomId && !after.roomPass)) return;
    if (
      String(before.roomId || "") === String(after.roomId || "") &&
      String(before.roomPass || "") === String(after.roomPass || "")
    ) {
      return;
    }

    const [matchSnap, regSnap] = await Promise.all([
      admin.database().ref(`tournaments/${event.params.matchId}`).once("value"),
      admin.database().ref("registrations").orderByChild("matchId").equalTo(event.params.matchId).once("value")
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
        dedupeKey: `room:${event.params.matchId}:${after.roomId || ""}:${after.roomPass || ""}`,
        tag: `room_${event.params.matchId}`
      });
    }
  }
);

exports.onMailboxGiftCreated = onValueCreated(
  { ref: "/users/{uid}/mailbox/{mailId}", instance: DB_INSTANCE, region: REGION },
  async (event) => {
    const mailId = String(event.params.mailId || "");
    if (mailId === "welcome_vip_7d") return;
    const data = event.data.val();
    if (!data || data.deleted || data.status !== "unclaimed") return;
    await sendToUser(event.params.uid, {
      title: "New Gift in Mailbox!",
      body: data.title || "Claim your reward within 7 days before it expires.",
      target: "mailbox",
      dedupeKey: `mail:${mailId}`,
      tag: `mail_${mailId}`
    });
  }
);

exports.onAdminReplyCreated = onValueCreated(
  { ref: "/adminMessages/{uid}/{msgId}", instance: DB_INSTANCE, region: REGION },
  async (event) => {
    const data = event.data.val();
    if (!data || data.deleted || data.from === "user") return;
    await sendToUser(event.params.uid, {
      title: "Official Admin Reply",
      body: data.text || "Official Admin sent you a reply.",
      target: "admindm",
      dedupeKey: `dm:${event.params.msgId}`,
      tag: "admindm"
    });
  }
);

exports.onAnnouncementCreated = onValueCreated(
  { ref: "/announcements/{annId}", instance: DB_INSTANCE, region: REGION },
  async (event) => {
    const data = event.data.val();
    if (!data || data.active === false) return;
    await admin.messaging().send({
      topic: "all_users",
      notification: {
        title: String(data.title || "Punjab Esports Announcement"),
        body: String(data.body || data.message || data.text || "New announcement available.")
      },
      data: {
        title: String(data.title || "Punjab Esports Announcement"),
        body: String(data.body || data.message || data.text || "New announcement available."),
        target: "notifications",
        dedupeKey: `ann:${event.params.annId}`
      },
      android: {
        priority: "high",
        notification: {
          channelId: "punjab_esports_alerts",
          sound: "default",
          visibility: "public",
          tag: `ann_${event.params.annId}`
        }
      }
    });
  }
);
