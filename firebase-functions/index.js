const { onValueCreated } = require("firebase-functions/v2/database");
const admin = require("firebase-admin");

admin.initializeApp();

const DB_INSTANCE = "punjab-turnaments-default-rtdb";
const REGION = "asia-southeast1";

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

  // Clean up expired/invalid tokens automatically
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
