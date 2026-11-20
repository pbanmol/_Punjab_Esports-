const { onValueCreated, onValueUpdated } = require("firebase-functions/v2/database");
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

async function sendToUser(uid, { title, body, target, dedupeKey }) {
  const tokens = await getUserTokens(uid);
  if (!tokens.length) return;

  const response = await admin.messaging().sendEachForMulticast({
    tokens,
    notification: {
      title: String(title || "Punjab Esports"),
      body: String(body || "You have a new update.")
    },
    data: {
      title: String(title || "Punjab Esports"),
      body: String(body || "You have a new update."),
      target: String(target || "notifications"),
      dedupeKey: String(dedupeKey || "")
    },
    android: {
      priority: "high",
      notification: {
        channelId: "punjab_esports_alerts",
        sound: "default",
        defaultVibrateTimings: true,
        visibility: "public"
      }
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
    const data = event.data.val();
    if (!data || data.read === true || data.type === "announcement") return;
    await sendToUser(event.params.uid, {
      title: data.title || "New Notification",
      body: data.body || data.message || "Tap to view in Punjab Esports.",
      target: "notifications",
      dedupeKey: `notif:${event.params.notifId}`
    });
  }
);

exports.onWalletBalanceUpdated = onValueUpdated(
  { ref: "/wallets/{uid}/balance", instance: DB_INSTANCE, region: REGION },
  async (event) => {
    const before = Number(event.data.before.val() || 0);
    const after = Number(event.data.after.val() || 0);
    const diff = Math.round((after - before) * 100) / 100;
    if (Math.abs(diff) < 0.01) return;
    const actionLabel = diff > 0
      ? `+${fmtRupees(diff)} added`
      : `${fmtRupees(Math.abs(diff))} deducted`;
    await sendToUser(event.params.uid, {
      title: "Wallet Balance Updated",
      body: `Your wallet was updated (${actionLabel}). New balance: ${fmtRupees(after)}.`,
      target: "notifications",
      dedupeKey: `fcm_bal:${event.params.uid}:${Math.round(after * 100)}:${Math.floor(Date.now() / 5000)}`
    });
  }
);

exports.onUserDiamondsUpdated = onValueUpdated(
  { ref: "/users/{uid}/diamonds", instance: DB_INSTANCE, region: REGION },
  async (event) => {
    const before = Number(event.data.before.val() || 0);
    const after = Number(event.data.after.val() || 0);
    const diff = after - before;
    if (diff === 0) return;
    const actionLabel = diff > 0
      ? `+${diff} Diamonds added`
      : `${Math.abs(diff)} Diamonds deducted`;
    await sendToUser(event.params.uid, {
      title: "Diamonds Updated",
      body: `Your diamonds were updated (${actionLabel}). Total: ${after} Diamonds.`,
      target: "notifications",
      dedupeKey: `fcm_dia:${event.params.uid}:${after}:${Math.floor(Date.now() / 5000)}`
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
    const approved = after === "approved" || after === "completed";
    await sendToUser(req.userId, {
      title: approved ? "Deposit Approved" : "Deposit Rejected",
      body: approved
        ? `Your deposit of ${fmtRupees(req.amount)} has been approved and added to your wallet.`
        : `Your deposit of ${fmtRupees(req.amount)} was rejected${req.reason ? ": " + req.reason : "."}`,
      target: "notifications",
      dedupeKey: `req:depositRequests:${event.params.reqId}:${after}`
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
    const approved = after === "approved" || after === "completed";
    await sendToUser(req.userId, {
      title: approved ? "Withdrawal Approved" : "Withdrawal Rejected",
      body: approved
        ? `Your withdrawal of ${fmtRupees(req.amount)} has been processed.`
        : `Your withdrawal of ${fmtRupees(req.amount)} was rejected${req.reason ? ": " + req.reason : "."}`,
      target: "notifications",
      dedupeKey: `req:withdrawalRequests:${event.params.reqId}:${after}`
    });
  }
);

exports.onMailboxGiftCreated = onValueCreated(
  { ref: "/users/{uid}/mailbox/{mailId}", instance: DB_INSTANCE, region: REGION },
  async (event) => {
    const data = event.data.val();
    if (!data || data.deleted || data.status !== "unclaimed") return;
    await sendToUser(event.params.uid, {
      title: "New Gift in Mailbox!",
      body: data.title || "Claim your reward within 7 days before it expires.",
      target: "mailbox",
      dedupeKey: `mail:${event.params.mailId}`
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
      dedupeKey: `dm:${event.params.msgId}`
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
          visibility: "public"
        }
      }
    });
  }
);
