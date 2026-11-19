import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { GoogleAuthProvider, createUserWithEmailAndPassword, fetchSignInMethodsForEmail, getAuth, onAuthStateChanged, sendPasswordResetEmail, signInWithEmailAndPassword, signInWithPopup, signOut, updateProfile } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { equalTo, get, getDatabase, limitToLast, off, onValue, orderByChild, push, query, ref, remove, runTransaction, set, update } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";
// \0vite/modulepreload-polyfill.js
(function polyfill() {
	const relList = document.createElement("link").relList;
	if (relList && relList.supports && relList.supports("modulepreload")) return;
	for (const link of document.querySelectorAll("link[rel=\"modulepreload\"]")) processPreload(link);
	new MutationObserver((mutations) => {
		for (const mutation of mutations) {
			if (mutation.type !== "childList") continue;
			for (const node of mutation.addedNodes) if (node.tagName === "LINK" && node.rel === "modulepreload") processPreload(node);
		}
	}).observe(document, {
		childList: true,
		subtree: true
	});
	function getFetchOpts(link) {
		const fetchOpts = {};
		if (link.integrity) fetchOpts.integrity = link.integrity;
		if (link.referrerPolicy) fetchOpts.referrerPolicy = link.referrerPolicy;
		if (link.crossOrigin === "use-credentials") fetchOpts.credentials = "include";
		else if (link.crossOrigin === "anonymous") fetchOpts.credentials = "omit";
		else fetchOpts.credentials = "same-origin";
		return fetchOpts;
	}
	function processPreload(link) {
		if (link.ep) return;
		link.ep = true;
		const fetchOpts = getFetchOpts(link);
		fetch(link.href, fetchOpts);
	}
})();
// index.html?html-proxy&index=1.js
var firebaseConfig = {
	apiKey: "AIzaSyBTLfhI3c2UBrA5re2UHHj_p1XamO5KWe4",
	authDomain: "punjab-turnaments.firebaseapp.com",
	databaseURL: "https://punjab-turnaments-default-rtdb.asia-southeast1.firebasedatabase.app",
	projectId: "punjab-turnaments",
	storageBucket: "punjab-turnaments.firebasestorage.app",
	messagingSenderId: "923158197845",
	appId: "1:923158197845:web:674a90ea877471281286dc"
};
var app = initializeApp(firebaseConfig);
var auth = getAuth(app);
var db = getDatabase(app);
var cachedSupportConfig = {
	whatsapp: "+919876543210",
	telegram: "PunjabEsports",
	instagram: "punjab_esports",
	youtube: "https://www.youtube.com/@PunjabEsports",
	gmail: "pbanmol025@gmail.com"
};
try {
	const rawSup = localStorage.getItem("pe_support_config");
	if (rawSup) {
		const parsed = JSON.parse(rawSup);
		if (parsed && typeof parsed === "object") cachedSupportConfig = {
			...cachedSupportConfig,
			...parsed
		};
	}
} catch (e) {}
var State = {
	user: null,
	profile: null,
	wallet: {
		balance: 0,
		reserved: 0
	},
	tournaments: [],
	myRegistrations: [],
	transactions: [],
	notifications: [],
	rawNotifications: [],
	chatMessages: [],
	mailbox: [],
	localDeletedMails: JSON.parse(localStorage.getItem("deleted_mails") || "[]"),
	shownWelcomeVipModal: false,
	chatWallpaper: null,
	matchResultsCache: {},
	settings: {},
	currentPage: "home",
	vipSettings: {},
	filters: {
		status: "upcoming",
		mode: "",
		type: "all",
		search: ""
	},
	listeners: [],
	lastNotifTs: 0,
	notifInitialized: false,
	notifSeenIds: /* @__PURE__ */ new Set(),
	lastKnownBalance: null,
	localWalletActionTs: 0,
	cleanupDays: 7,
	retentionMs: 6048e5,
	shownStartupNotification: false,
	supportConfig: cachedSupportConfig,
	localDeletedChats: JSON.parse(localStorage.getItem("deleted_chats") || "[]"),
	localDeletedTxs: JSON.parse(localStorage.getItem("deleted_txs") || "[]"),
	referrals: [],
	dmListener: null,
	myTeam: null,
	teamRole: null,
	myTeamInvites: [],
	teamWalletData: null,
	myTab: "matches",
	lbTab: "solo",
	allUsers: null,
	lbCache: {
		data: null,
		ts: 0
	}
};
var TEAM_PASS_PRICE = 5;
var TEAM_TRIAL_DURATION_MS = 6048e5;
var TEAM_PASS_DURATION_MS = 2592e6;
var TEAM_MAX_MEMBERS = 4;
var DEFAULT_REFERRAL_MSG = `🎮 Join Punjab Esports & Win Real Cash!

Use my code: *{code}*
Get {signupBonus} signup bonus + I earn {referralBonus}!

Download: {downloadLink}

Play Free Fire tournaments, earn diamonds & withdraw to UPI! 💰`;
function isVipActive() {
	if (!State.profile || !State.profile.vipExpiry) return false;
	return Date.now() < State.profile.vipExpiry;
}
var $ = (s, p = document) => p.querySelector(s);
var $$ = (s, p = document) => Array.from(p.querySelectorAll(s));
var esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({
	"&": "&amp;",
	"<": "&lt;",
	">": "&gt;",
	"\"": "&quot;",
	"'": "&#39;"
})[c]);
var isObj = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
var toTimestampMs = (ts) => {
	if (ts === null || ts === void 0 || ts === "") return 0;
	if (typeof ts === "number" && !isNaN(ts)) return ts > 0 && ts < 0xe8d4a51000 ? ts * 1e3 : ts;
	const raw = String(ts).trim();
	if (!raw) return 0;
	if (/^\d+(\.\d+)?$/.test(raw)) {
		const n = Number(raw);
		return n > 0 && n < 0xe8d4a51000 ? n * 1e3 : n;
	}
	const parsed = Date.parse(raw);
	return isNaN(parsed) ? 0 : parsed;
};
var isWithinRetention = (ts) => {
	const ms = toTimestampMs(ts);
	if (State.cleanupDays === 0) return false;
	return !ms || Date.now() - ms <= State.retentionMs;
};
var fmtMoney = (rupees) => "₹" + (Number(rupees) || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 });
var fmtDate = (ts) => {
	const ms = toTimestampMs(ts);
	return ms ? new Date(ms).toLocaleDateString("en-IN", {
		day: "2-digit",
		month: "short",
		year: "numeric"
	}) : "—";
};
var fmtDateTime = (ts) => {
	const ms = toTimestampMs(ts);
	if (!ms) return "—";
	const d = new Date(ms);
	if (isNaN(d.getTime())) return "—";
	return d.toLocaleString("en-IN", {
		day: "2-digit",
		month: "short",
		hour: "2-digit",
		minute: "2-digit",
		hour12: true
	});
};
var fmtTimeOnly = (ts) => {
	const ms = toTimestampMs(ts);
	if (!ms) return "";
	return new Date(ms).toLocaleTimeString("en-IN", {
		hour: "2-digit",
		minute: "2-digit",
		hour12: true
	});
};
function processImageFileToDataURL(file, maxDim = 512, quality = .85) {
	return new Promise((resolve, reject) => {
		if (!file) return reject(/* @__PURE__ */ new Error("No image selected"));
		const fallbackRead = () => {
			const reader = new FileReader();
			reader.onload = (ev) => resolve(ev.target.result);
			reader.onerror = () => reject(/* @__PURE__ */ new Error("Unable to read image file"));
			reader.readAsDataURL(file);
		};
		const objectUrl = window.URL && URL.createObjectURL ? URL.createObjectURL(file) : null;
		if (!objectUrl) {
			fallbackRead();
			return;
		}
		const img = new Image();
		img.onload = () => {
			try {
				let w = img.naturalWidth || img.width || maxDim;
				let h = img.naturalHeight || img.height || maxDim;
				if (w > maxDim || h > maxDim) {
					if (w >= h) {
						h = Math.max(1, Math.round(h * maxDim / w));
						w = maxDim;
					} else {
						w = Math.max(1, Math.round(w * maxDim / h));
						h = maxDim;
					}
				}
				const canvas = document.createElement("canvas");
				canvas.width = w;
				canvas.height = h;
				const ctx = canvas.getContext("2d");
				if (!ctx) {
					URL.revokeObjectURL(objectUrl);
					fallbackRead();
					return;
				}
				ctx.drawImage(img, 0, 0, w, h);
				const outUrl = canvas.toDataURL("image/jpeg", quality);
				URL.revokeObjectURL(objectUrl);
				resolve(outUrl);
			} catch (err) {
				try {
					URL.revokeObjectURL(objectUrl);
				} catch (e) {}
				fallbackRead();
			}
		};
		img.onerror = () => {
			try {
				URL.revokeObjectURL(objectUrl);
			} catch (e) {}
			fallbackRead();
		};
		img.src = objectUrl;
	});
}
function getAvatarHTML(photoUrl, emoji, name, sizeClass = "member-avatar") {
	const photo = String(photoUrl || "").trim();
	if (photo && (/^data:image\/(png|jpe?g|gif|webp);base64,/i.test(photo) || /^https:\/\//i.test(photo))) return `<img src="${esc(photo)}" alt="${esc(name || "Player")}" loading="lazy" style="width:100%;height:100%;object-fit:cover;" onerror="this.style.display='none'">`;
	if (emoji) return `<span style="font-size:1.2rem;line-height:1">${esc(emoji)}</span>`;
	return esc((name || "P").charAt(0).toUpperCase());
}
function formatTime12h(timeStr) {
	if (!timeStr) return "—";
	const parts = String(timeStr).split(":");
	const hh = Number(parts[0]);
	const mm = Number(parts[1] || 0);
	if (isNaN(hh)) return timeStr;
	const period = hh >= 12 ? "PM" : "AM";
	return `${hh % 12 || 12}:${String(mm).padStart(2, "0")} ${period}`;
}
function formatMatchDateTime(dateStr, timeStr) {
	if (!dateStr) return "TBD";
	try {
		const d = /* @__PURE__ */ new Date(dateStr + "T" + (timeStr || "00:00"));
		if (isNaN(d.getTime())) return `${dateStr} · ${formatTime12h(timeStr)}`;
		return `${d.toLocaleDateString("en-IN", {
			day: "2-digit",
			month: "short",
			year: "numeric"
		})} · ${d.toLocaleTimeString("en-IN", {
			hour: "2-digit",
			minute: "2-digit",
			hour12: true
		})}`;
	} catch (e) {
		return `${dateStr} · ${formatTime12h(timeStr)}`;
	}
}
function fmtRelativeTime(ts) {
	const ms = toTimestampMs(ts);
	if (!ms) return "";
	const diff = Math.max(0, Date.now() - ms);
	const s = Math.floor(diff / 1e3);
	if (s < 60) return "Just now";
	const m = Math.floor(s / 60);
	if (m < 60) return `${m} min ago`;
	const h = Math.floor(m / 60);
	if (h < 24) return `${h} hr ago`;
	const d = Math.floor(h / 24);
	if (d < 7) return `${d} day${d > 1 ? "s" : ""} ago`;
	return fmtDate(ms);
}
var audioCtx = null;
var audioUnlocked = false;
function getAudioCtx() {
	if (!audioCtx) try {
		audioCtx = new (window.AudioContext || window.webkitAudioContext)();
	} catch (e) {
		return null;
	}
	return audioCtx;
}
function withAudioReady(fn) {
	const ctx = getAudioCtx();
	if (!ctx) return;
	if (ctx.state === "suspended") ctx.resume().then(() => {
		try {
			fn(ctx);
		} catch (e) {}
	}).catch(() => {});
	else try {
		fn(ctx);
	} catch (e) {}
}
function unlockAudio() {
	const ctx = getAudioCtx();
	if (!ctx) return;
	if (ctx.state === "suspended") ctx.resume().catch(() => {});
	if (audioUnlocked) return;
	try {
		const buf = ctx.createBuffer(1, 1, 22050);
		const src = ctx.createBufferSource();
		src.buffer = buf;
		src.connect(ctx.destination);
		src.start(0);
		audioUnlocked = true;
	} catch (e) {}
}
[
	"click",
	"touchstart",
	"touchend",
	"keydown",
	"pointerdown"
].forEach((ev) => {
	document.addEventListener(ev, unlockAudio, {
		once: false,
		passive: true,
		capture: true
	});
});
function playNotifSound() {
	withAudioReady((ctx) => {
		const now = ctx.currentTime;
		const notes = [
			{
				f: 783.99,
				t: 0,
				d: .35,
				v: .28
			},
			{
				f: 987.77,
				t: .16,
				d: .4,
				v: .3
			},
			{
				f: 1318.51,
				t: .34,
				d: .85,
				v: .25
			}
		];
		const master = ctx.createGain();
		master.gain.setValueAtTime(.9, now);
		master.connect(ctx.destination);
		notes.forEach((n) => {
			const osc1 = ctx.createOscillator();
			const g1 = ctx.createGain();
			osc1.type = "sine";
			osc1.frequency.setValueAtTime(n.f, now + n.t);
			osc1.frequency.exponentialRampToValueAtTime(n.f * .995, now + n.t + n.d);
			g1.gain.setValueAtTime(1e-4, now + n.t);
			g1.gain.exponentialRampToValueAtTime(n.v, now + n.t + .018);
			g1.gain.exponentialRampToValueAtTime(1e-4, now + n.t + n.d);
			osc1.connect(g1);
			g1.connect(master);
			osc1.start(now + n.t);
			osc1.stop(now + n.t + n.d + .08);
		});
		if (navigator.vibrate) try {
			navigator.vibrate([
				90,
				50,
				90
			]);
		} catch (e) {}
	});
}
function playWarningSound() {
	withAudioReady((ctx) => {
		const now = ctx.currentTime;
		[{
			f1: 540,
			f2: 460,
			t: 0,
			d: .09
		}, {
			f1: 420,
			f2: 340,
			t: .1,
			d: .13
		}].forEach((n) => {
			const osc = ctx.createOscillator();
			const gain = ctx.createGain();
			osc.type = "triangle";
			osc.frequency.setValueAtTime(n.f1, now + n.t);
			osc.frequency.exponentialRampToValueAtTime(n.f2, now + n.t + n.d);
			gain.gain.setValueAtTime(1e-4, now + n.t);
			gain.gain.exponentialRampToValueAtTime(.24, now + n.t + .012);
			gain.gain.exponentialRampToValueAtTime(1e-4, now + n.t + n.d);
			osc.connect(gain);
			gain.connect(ctx.destination);
			osc.start(now + n.t);
			osc.stop(now + n.t + n.d + .02);
		});
	});
	if (navigator.vibrate) try {
		navigator.vibrate(45);
	} catch (e) {}
}
function isClickSoundEnabled() {
	try {
		return localStorage.getItem("pe_click_sound") !== "off";
	} catch (e) {
		return true;
	}
}
function playClickSound() {
	if (!isClickSoundEnabled()) return;
	withAudioReady((ctx) => {
		const now = ctx.currentTime;
		const osc = ctx.createOscillator();
		const gain = ctx.createGain();
		osc.type = "triangle";
		osc.frequency.setValueAtTime(860, now);
		osc.frequency.exponentialRampToValueAtTime(460, now + .045);
		gain.gain.setValueAtTime(1e-4, now);
		gain.gain.exponentialRampToValueAtTime(.24, now + .005);
		gain.gain.exponentialRampToValueAtTime(1e-4, now + .055);
		osc.connect(gain);
		gain.connect(ctx.destination);
		osc.start(now);
		osc.stop(now + .06);
	});
}
var PE_TAP_SELECTOR = "button, .btn, .bn-item, .nav-item, .filter-chip, .pe-account-row, [role=\"button\"], .theme-swatch, .vip-plan-card, .vip-ctab, a.channel-btn, a.share-btn, .bc-btn, .copy-btn, .icon-btn, .match-card, .notif-item, .earn-card, #profileVipCard";
document.addEventListener("click", (e) => {
	const target = e.target.closest(PE_TAP_SELECTOR);
	if (target && !target.disabled && target.id !== "clickSoundToggle") playClickSound();
}, true);
async function copyTextToClipboard(value) {
	const text = String(value ?? "");
	if (!text) {
		toast("error", "Nothing to copy", "This value is empty.");
		return false;
	}
	try {
		if (navigator.clipboard && window.isSecureContext) await navigator.clipboard.writeText(text);
		else {
			const field = document.createElement("textarea");
			field.value = text;
			field.setAttribute("readonly", "");
			field.style.position = "fixed";
			field.style.opacity = "0";
			field.style.pointerEvents = "none";
			document.body.appendChild(field);
			field.select();
			field.setSelectionRange(0, field.value.length);
			const copied = document.execCommand("copy");
			field.remove();
			if (!copied) throw new Error("Clipboard access was blocked");
		}
		toast("success", "Copied", text);
		return true;
	} catch (err) {
		toast("error", "Copy failed", "Your browser or app blocked clipboard access. Please allow clipboard permission and try again.");
		return false;
	}
}
function toast(type, title, msg, timeout = 3600) {
	const host = $("#toastHost");
	const el = document.createElement("div");
	el.className = `toast ${type}`;
	el.style.setProperty("--t-dur", timeout / 1e3 + "s");
	const icons = {
		success: "fa-circle-check",
		error: "fa-circle-exclamation",
		warning: "fa-crown",
		info: "fa-bell"
	};
	el.innerHTML = `<div class="t-icon-wrap"><i class="fa-solid ${icons[type] || icons.info}"></i></div><div class="t-body"><div class="t-title">${esc(title)}</div>${msg ? `<div class="t-msg">${esc(msg)}</div>` : ""}</div><button class="t-close" aria-label="Close"><i class="fa-solid fa-xmark"></i></button>`;
	host.appendChild(el);
	const close = () => {
		el.style.opacity = "0";
		el.style.transform = "translateY(-10px) scale(.97)";
		setTimeout(() => el.remove(), 220);
	};
	el.querySelector(".t-close").onclick = close;
	setTimeout(close, timeout);
}
function openModal({ title, bodyHTML, footerHTML, onMount = null, onClose = null, extraClass = "" }) {
	const wrap = document.createElement("div");
	wrap.className = "mb " + extraClass;
	wrap.innerHTML = `<div class="modal" role="dialog"><div class="mh"><h3>${title}</h3><button class="close-x"><i class="fa-solid fa-xmark"></i></button></div><div class="mbody">${bodyHTML}</div>${footerHTML ? `<div class="mfoot">${footerHTML}</div>` : ""}</div>`;
	$("#modalHost").appendChild(wrap);
	let closed = false;
	const close = (reason = "dismiss") => {
		if (closed) return;
		closed = true;
		wrap.remove();
		document.removeEventListener("keydown", escFn);
		if (extraClass.includes("dm-modal") && State.dmListener) {
			State.dmListener();
			State.dmListener = null;
		}
		if (onClose) onClose(reason);
	};
	wrap.querySelector(".close-x").onclick = () => close("dismiss");
	wrap.addEventListener("click", (e) => {
		if (e.target === wrap) close("dismiss");
	});
	const escFn = (e) => {
		if (e.key === "Escape") close("dismiss");
	};
	document.addEventListener("keydown", escFn);
	if (onMount) onMount(wrap, close);
	return {
		el: wrap,
		close
	};
}
function confirmDialog(title, message, danger = false) {
	return new Promise((resolve) => {
		openModal({
			title,
			bodyHTML: `<p>${esc(message)}</p>`,
			footerHTML: `<button class="btn btn-ghost" data-x="c">Cancel</button><button class="btn ${danger ? "btn-danger" : "btn-primary"}" data-x="ok">Confirm</button>`,
			onMount: (el, close) => {
				el.querySelector("[data-x=\"c\"]").onclick = () => {
					close();
					resolve(false);
				};
				el.querySelector("[data-x=\"ok\"]").onclick = () => {
					close();
					resolve(true);
				};
			}
		});
	});
}
var THEME_DEFS = [
	{
		id: "mono",
		name: "Stealth B&W",
		dots: [
			"#000000",
			"#71717a",
			"#ffffff"
		]
	},
	{
		id: "gold",
		name: "Royal Gold",
		dots: [
			"#0a0803",
			"#d4af37",
			"#f0cf6b"
		]
	},
	{
		id: "amoled",
		name: "AMOLED",
		dots: [
			"#000",
			"#8b5cf6",
			"#22c55e"
		]
	},
	{
		id: "cyber",
		name: "Cyber Blue",
		dots: [
			"#04070f",
			"#00a3ff",
			"#38bdf8"
		]
	},
	{
		id: "fire",
		name: "Fire Red",
		dots: [
			"#0f0504",
			"#ff4d2e",
			"#fbbf24"
		]
	},
	{
		id: "neon",
		name: "Neon Purple",
		dots: [
			"#06010d",
			"#c026d3",
			"#e879f9"
		]
	},
	{
		id: "emerald",
		name: "Emerald",
		dots: [
			"#020c08",
			"#10b981",
			"#34d399"
		]
	},
	{
		id: "ocean",
		name: "Ocean Glass",
		dots: [
			"#02121c",
			"#06b6d4",
			"#67e8f9"
		]
	},
	{
		id: "light",
		name: "Pure Light",
		dots: [
			"#f4f5f9",
			"#6d28d9",
			"#7c3aed"
		]
	},
	{
		id: "sunset",
		name: "Sunset Rose",
		dots: [
			"#1f0610",
			"#f43f5e",
			"#fb923c"
		]
	}
];
var themeState = {
	mode: "user",
	globalTheme: "mono",
	default: "mono",
	enabled: {},
	userTheme: null,
	darkMode: true
};
var SPLASH_THEME_COLORS = {
	amoled: ["#8b5cf6", "#a78bfa"],
	cyber: ["#00a3ff", "#4dc4ff"],
	fire: ["#ff4d2e", "#ff8566"],
	neon: ["#c026d3", "#e879f9"],
	emerald: ["#10b981", "#34d399"],
	gold: ["#d4af37", "#f0cf6b"],
	ocean: ["#06b6d4", "#67e8f9"],
	light: ["#6d28d9", "#7c3aed"],
	mono: ["#111111", "#3f3f46"],
	sunset: ["#f43f5e", "#fb923c"]
};
function updateSplashAccent(id) {
	const isDark = document.documentElement.getAttribute("data-bg") === "dark";
	const colors = id === "mono" && isDark ? ["#ffffff", "#d4d4d8"] : SPLASH_THEME_COLORS[id] || SPLASH_THEME_COLORS.mono;
	document.documentElement.style.setProperty("--splash-ac", colors[0]);
	document.documentElement.style.setProperty("--splash-ac2", colors[1]);
}
function applyTheme(id) {
	if (!THEME_DEFS.find((t) => t.id === id)) id = "mono";
	document.documentElement.setAttribute("data-theme", id);
	updateSplashAccent(id);
	try {
		localStorage.setItem("pe_theme", id);
	} catch (e) {}
}
function applyBgMode(isDark) {
	document.documentElement.setAttribute("data-bg", isDark ? "dark" : "light");
	try {
		localStorage.setItem("pe_bg", isDark ? "dark" : "light");
	} catch (e) {}
	updateSplashAccent(document.documentElement.getAttribute("data-theme") || "mono");
	const toggle = $("#darkModeToggle");
	const knob = $("#darkModeKnob");
	if (toggle && knob) {
		if (isDark) {
			knob.style.left = "24px";
			knob.style.background = "var(--ac)";
			toggle.style.background = "var(--sf2)";
		} else {
			knob.style.left = "2px";
			knob.style.background = "var(--txm)";
			toggle.style.background = "var(--sf3)";
		}
	}
	const meta = document.getElementById("appThemeColor") || document.querySelector("meta[name=\"theme-color\"]");
	const color = isDark ? "#000000" : "#ffffff";
	if (meta) meta.setAttribute("content", color);
	document.documentElement.style.backgroundColor = color;
	document.body.style.backgroundColor = color;
	if (window.AndroidInterface && typeof window.AndroidInterface.updateSystemBars === "function") try {
		window.AndroidInterface.updateSystemBars(isDark, color);
	} catch (e) {}
}
var __initialTheme = "mono";
var __initialBg = "light";
try {
	__initialTheme = localStorage.getItem("pe_theme") || "mono";
	__initialBg = localStorage.getItem("pe_bg") || "light";
} catch (e) {}
applyTheme(__initialTheme);
applyBgMode(__initialBg === "dark");
function computeActiveTheme() {
	if (themeState.mode === "global") return themeState.globalTheme || themeState.default || "mono";
	if (State.profile && !isVipActive()) return "mono";
	const userPick = themeState.userTheme;
	if (userPick && THEME_DEFS.find((t) => t.id === userPick)) {
		if (themeState.enabled[userPick] !== false) return userPick;
	}
	return "mono";
}
function refreshTheme() {
	applyTheme(computeActiveTheme());
}
async function loadThemeSettings() {
	try {
		const snap = await get(ref(db, "themeSettings"));
		const cfg = snap.exists() ? snap.val() : {};
		themeState.mode = cfg.mode || "user";
		themeState.globalTheme = cfg.globalTheme || "mono";
		themeState.default = cfg.default && cfg.default !== "gold" ? cfg.default : "mono";
		themeState.enabled = cfg.enabled || {};
	} catch (e) {}
}
async function loadUserTheme() {
	if (!State.user) {
		refreshTheme();
		return;
	}
	try {
		const snap = await get(ref(db, "users/" + State.user.uid + "/theme"));
		if (snap.exists()) themeState.userTheme = snap.val();
	} catch (e) {}
	refreshTheme();
}
var splashEl = $("#splash");
function isNativeAndroidApp() {
	return !!(window.Capacitor?.isNativePlatform?.() || window.Capacitor?.Plugins?.NativeGoogleAuth);
}
function promptMediaPermissionDialog(force = false, onGranted = null) {
	if (isNativeAndroidApp()) {
		try {
			localStorage.setItem("pe_media_permission", "granted");
		} catch (e) {}
		if (onGranted) onGranted();
		return;
	}
	const currentStatus = localStorage.getItem("pe_media_permission");
	if (!force && currentStatus) {
		if (onGranted && currentStatus === "granted") onGranted();
		return;
	}
	if (document.getElementById("mediaPermModal")) return;
	const div = document.createElement("div");
	div.id = "mediaPermModal";
	div.className = "perm-modal-backdrop";
	div.innerHTML = `
    <div class="perm-modal-card">
      <div class="perm-icon-bubble">
        <i class="fa-solid fa-images"></i>
      </div>
      <h3 class="perm-title">Allow Punjab Esports to access photos and media on your device?</h3>
      <p class="perm-desc">Punjab Esports needs photo access so you can upload your profile picture, team logo, and match proof screenshots.</p>
      <div class="perm-actions-col">
        <button type="button" class="perm-btn perm-btn-allow" id="btnAllowMedia">Allow</button>
        <button type="button" class="perm-btn perm-btn-deny" id="btnDenyMedia">Don't allow</button>
      </div>
    </div>
  `;
	document.body.appendChild(div);
	const btnAllow = div.querySelector("#btnAllowMedia");
	const btnDeny = div.querySelector("#btnDenyMedia");
	btnAllow.onclick = () => {
		try {
			localStorage.setItem("pe_media_permission", "granted");
		} catch (e) {}
		div.remove();
		toast("success", "Permission Granted", "Photos & media access allowed.");
		if (onGranted) onGranted();
	};
	btnDeny.onclick = () => {
		try {
			localStorage.setItem("pe_media_permission", "denied");
		} catch (e) {}
		div.remove();
		toast("info", "Permission Denied", "Media permission is required to upload photos.");
	};
}
if (!isNativeAndroidApp()) setTimeout(() => {
	if (!localStorage.getItem("pe_media_permission")) promptMediaPermissionDialog(false);
}, 500);
else try {
	localStorage.setItem("pe_media_permission", "granted");
} catch (e) {}
function hideSplash() {
	if (!splashEl || splashEl.dataset.hiding === "1") return;
	splashEl.dataset.hiding = "1";
	splashEl.classList.add("hide");
	setTimeout(() => {
		splashEl.style.display = "none";
	}, 190);
}
setTimeout(() => {
	if (splashEl && !splashEl.classList.contains("hide")) hideSplash();
}, 4e3);
var KNOWN_DEVICE_EMAILS = ["pbanmol025@gmail.com", "anmolpreetsingh47902@gmail.com"];
try {
	const saved = localStorage.getItem("pe_saved_email");
	if (saved && !KNOWN_DEVICE_EMAILS.includes(saved)) KNOWN_DEVICE_EMAILS.unshift(saved);
} catch (e) {}
function setupEmailAutocomplete(inputEl, suggestBoxEl) {
	if (!inputEl || !suggestBoxEl) return;
	const renderSuggestions = (val) => {
		const q = val.trim().toLowerCase();
		if (!q) {
			suggestBoxEl.classList.remove("show");
			return;
		}
		let matches = [];
		if (!q.includes("@")) {
			KNOWN_DEVICE_EMAILS.forEach((em) => {
				if (em.toLowerCase().includes(q)) matches.push(em);
			});
			[
				"@gmail.com",
				"@yahoo.com",
				"@outlook.com"
			].forEach((dom) => {
				matches.push(q + dom);
			});
		} else {
			const parts = q.split("@");
			const prefix = parts[0];
			const suffix = parts[1] || "";
			[
				"gmail.com",
				"yahoo.com",
				"outlook.com",
				"hotmail.com"
			].forEach((d) => {
				if (d.startsWith(suffix)) matches.push(prefix + "@" + d);
			});
			KNOWN_DEVICE_EMAILS.forEach((em) => {
				if (em.toLowerCase().startsWith(q) && !matches.includes(em)) matches.push(em);
			});
		}
		const unique = [...new Set(matches)].slice(0, 4);
		if (!unique.length) {
			suggestBoxEl.classList.remove("show");
			return;
		}
		suggestBoxEl.innerHTML = unique.map((em) => `
      <div class="email-suggest-item" data-val="${esc(em)}">
        <i class="fa-solid fa-envelope"></i> <span>${esc(em)}</span>
      </div>
    `).join("");
		suggestBoxEl.classList.add("show");
		suggestBoxEl.querySelectorAll(".email-suggest-item").forEach((item) => {
			item.onmousedown = (e) => {
				e.preventDefault();
				inputEl.value = item.dataset.val;
				suggestBoxEl.classList.remove("show");
				inputEl.focus();
			};
		});
	};
	inputEl.addEventListener("input", () => renderSuggestions(inputEl.value));
	inputEl.addEventListener("focus", () => {
		if (inputEl.value) renderSuggestions(inputEl.value);
	});
	inputEl.addEventListener("blur", () => setTimeout(() => suggestBoxEl.classList.remove("show"), 200));
}
var pendingAuthAction = null;
function ensureTermsAgreed(actionCallback) {
	const termsCheck = document.getElementById("authTermsAgree");
	const termsContainer = document.getElementById("authTermsContainer");
	const errBox = document.getElementById("authTermsError");
	if (termsCheck && termsCheck.checked) {
		if (termsContainer) termsContainer.classList.remove("highlight-req");
		if (errBox) errBox.style.display = "none";
		pendingAuthAction = null;
		if (typeof actionCallback === "function") actionCallback();
		return true;
	}
	if (typeof actionCallback === "function") pendingAuthAction = actionCallback;
	if (termsContainer) {
		termsContainer.classList.remove("highlight-req");
		termsContainer.offsetWidth;
		termsContainer.classList.add("highlight-req");
	}
	if (errBox) {
		errBox.style.display = "block";
		errBox.scrollIntoView({
			behavior: "smooth",
			block: "nearest"
		});
	}
	playWarningSound();
	toast("warning", "Terms Required", "Please accept the Terms of Use and Privacy Policy to continue.");
	return false;
}
var googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: "select_account" });
googleProvider.addScope("email");
googleProvider.addScope("profile");
function handleContinueWithGoogle() {
	if (!ensureTermsAgreed(() => openGoogleAccountBottomSheet())) return;
	openGoogleAccountBottomSheet();
}
function getCachedAvatarForEmail(email) {
	const clean = String(email || "").trim().toLowerCase();
	if (!clean) return "";
	try {
		const direct = localStorage.getItem("pe_avatar_" + clean);
		if (direct && (direct.startsWith("data:image") || /^https?:\/\//i.test(direct))) return direct;
	} catch (e) {}
	return "";
}
function saveAccountAvatarCache(email, photoUrl) {
	const clean = String(email || "").trim().toLowerCase();
	const pic = String(photoUrl || "").trim();
	if (!clean || !pic || !pic.startsWith("data:image") && !/^https?:\/\//i.test(pic)) return;
	try {
		localStorage.setItem("pe_avatar_" + clean, pic);
		let list = JSON.parse(localStorage.getItem("pe_verified_google_accounts") || "[]");
		if (!Array.isArray(list)) list = [];
		const idx = list.findIndex((a) => String(a?.email || "").toLowerCase() === clean);
		if (idx >= 0) {
			list[idx].photoUrl = pic;
			localStorage.setItem("pe_verified_google_accounts", JSON.stringify(list));
		}
	} catch (e) {}
}
async function openGoogleAccountBottomSheet() {
	const existingSheet = document.getElementById("peAccountSheetBackdrop");
	if (existingSheet) existingSheet.remove();
	const googlePalette = [
		"#1565c0",
		"#7b1fa2",
		"#00897b",
		"#ef6c00",
		"#2e7d32",
		"#6a1b9a",
		"#1976d2",
		"#388e3c"
	];
	let savedAccounts = [];
	try {
		const raw = localStorage.getItem("pe_verified_google_accounts");
		if (raw) savedAccounts = JSON.parse(raw);
	} catch (e) {}
	if (!Array.isArray(savedAccounts)) savedAccounts = [];
	let deviceAccounts = [];
	const nativeGoogleAuth = window.Capacitor?.Plugins?.NativeGoogleAuth;
	if (nativeGoogleAuth && typeof nativeGoogleAuth.getDeviceAccounts === "function") try {
		const devRes = await Promise.race([nativeGoogleAuth.getDeviceAccounts(), new Promise((res) => setTimeout(() => res({ accounts: [] }), 450))]);
		if (devRes && Array.isArray(devRes.accounts)) deviceAccounts = devRes.accounts;
	} catch (e) {}
	const mergedMap = /* @__PURE__ */ new Map();
	const addCandidate = (email, name, color, photoUrl) => {
		const clean = String(email || "").trim().toLowerCase();
		if (!clean || !clean.includes("@")) return;
		const cachedPhoto = photoUrl || getCachedAvatarForEmail(clean);
		if (!mergedMap.has(clean)) mergedMap.set(clean, {
			email: clean,
			name: name && name.trim() ? name.trim() : clean.split("@")[0],
			color: color || googlePalette[mergedMap.size % googlePalette.length],
			photoUrl: cachedPhoto || ""
		});
		else if (cachedPhoto && !mergedMap.get(clean).photoUrl) mergedMap.get(clean).photoUrl = cachedPhoto;
	};
	deviceAccounts.forEach((a, i) => addCandidate(a?.email, a?.name, googlePalette[i % googlePalette.length], a?.photoUrl));
	savedAccounts.forEach((a, i) => addCandidate(a?.email, a?.name, a?.color || googlePalette[i % googlePalette.length], a?.photoUrl));
	try {
		const savedMail = (localStorage.getItem("pe_saved_email") || "").trim();
		if (savedMail) addCandidate(savedMail, savedMail.split("@")[0]);
	} catch (e) {}
	const accounts = Array.from(mergedMap.values());
	const backdrop = document.createElement("div");
	backdrop.id = "peAccountSheetBackdrop";
	backdrop.className = "pe-account-sheet-backdrop";
	backdrop.innerHTML = `
    <div class="pe-account-sheet">
      <div class="pe-sheet-handle"></div>
      <svg class="pe-sheet-google-mark" viewBox="0 0 24 24" aria-hidden="true">
        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
      </svg>
      <h2 class="pe-sheet-title">Choose your account</h2>
      <div class="pe-sheet-brand-divider">
        <span class="pe-sheet-brand-line"></span>
        <span class="pe-sheet-brand-pill">
          <img src="assets/aistudio/41120_logo_black.png" alt="Punjab Esports">
          <span>Punjab Esports</span>
        </span>
        <span class="pe-sheet-brand-line"></span>
      </div>

      <div class="pe-accounts-container">
        ${accounts.map((acc, i) => {
		const initial = esc((acc.email || acc.name || "G").charAt(0).toUpperCase());
		const bg = acc.color && !String(acc.color).includes("gradient") ? acc.color : googlePalette[i % googlePalette.length];
		const hasPhoto = acc.photoUrl && (acc.photoUrl.startsWith("data:image") || /^https?:\/\//i.test(acc.photoUrl));
		const avatarInner = hasPhoto ? `<img src="${esc(acc.photoUrl)}" alt="${initial}">` : initial;
		return `
      <div class="pe-account-row" data-saved-email="${esc(acc.email)}" data-saved-name="${esc(acc.name || "")}">
        <div class="pe-account-avatar" style="background:${hasPhoto ? "#f1f5f9" : bg};">
          ${avatarInner}
        </div>
        <div class="pe-account-info">
          <div class="pe-account-email">${esc(acc.email)}</div>
        </div>
        <div class="pe-account-radio"></div>
      </div>
    `;
	}).join("")}
        ${`
    <div class="pe-account-row" id="peTriggerRealGoogle">
      <div class="pe-account-avatar" style="background:#f1f5f9;color:#111827;border:1px solid #e2e8f0;font-size:1.05rem;">
        <i class="fa-solid fa-user-plus" style="font-size:0.85rem;"></i>
      </div>
      <div class="pe-account-info">
        <div class="pe-account-email" style="font-weight:600;">${accounts.length ? "Use another Google account" : "Select Google account"}</div>
        ${!accounts.length ? "<div class=\"pe-account-sub\">Pick from device or sign in with Gmail</div>" : ""}
      </div>
      <div class="pe-account-radio"></div>
    </div>
  `}
      </div>

      <button type="button" class="pe-sheet-cancel-btn" id="peSheetCancelBtn">Cancel</button>
    </div>
  `;
	document.body.appendChild(backdrop);
	const closeSheet = () => {
		backdrop.style.opacity = "0";
		setTimeout(() => backdrop.remove(), 180);
	};
	backdrop.querySelector("#peSheetCancelBtn").onclick = closeSheet;
	backdrop.onclick = (e) => {
		if (e.target === backdrop) closeSheet();
	};
	backdrop.querySelector("#peTriggerRealGoogle").onclick = async () => {
		closeSheet();
		await executeGoogleOAuthFlow();
	};
	backdrop.querySelectorAll(".pe-account-row[data-saved-email]").forEach((row) => {
		row.onclick = async () => {
			row.classList.add("selected");
			const email = row.dataset.savedEmail;
			const name = row.dataset.savedName;
			setTimeout(async () => {
				closeSheet();
				await onGoogleUserAuthenticated(null, email, name);
			}, 90);
		};
	});
}
var isGoogleAuthInProgress = false;
async function executeGoogleOAuthFlow() {
	if (isGoogleAuthInProgress) return;
	isGoogleAuthInProgress = true;
	const nativeGoogleAuth = window.Capacitor?.Plugins?.NativeGoogleAuth;
	const isNativeAndroid = !!(window.Capacitor?.isNativePlatform?.() || nativeGoogleAuth);
	if (nativeGoogleAuth && typeof nativeGoogleAuth.pickAccount === "function") try {
		const res = await nativeGoogleAuth.pickAccount();
		if (res && res.email) {
			const cleanEmail = res.email.trim().toLowerCase();
			const fallbackName = cleanEmail.split("@")[0];
			addVerifiedDeviceGoogleAccount(cleanEmail, fallbackName);
			await onGoogleUserAuthenticated(null, cleanEmail, fallbackName);
		}
		return;
	} catch (nativeErr) {
		console.warn("NativeGoogleAuth error:", nativeErr);
		promptGoogleEmailFallback();
		return;
	} finally {
		setTimeout(() => {
			isGoogleAuthInProgress = false;
		}, 400);
	}
	if (isNativeAndroid) {
		isGoogleAuthInProgress = false;
		promptGoogleEmailFallback();
		return;
	}
	try {
		const cred = await signInWithPopup(auth, googleProvider);
		if (cred && cred.user) {
			addVerifiedDeviceGoogleAccount(cred.user.email, cred.user.displayName, cred.user.photoURL || "");
			await onGoogleUserAuthenticated(cred.user);
			return;
		}
	} catch (err) {
		console.warn("Google signInWithPopup error:", err);
		const code = err?.code || "";
		if (code.includes("popup-closed-by-user") || code.includes("cancelled")) return;
		if (code.includes("unauthorized-domain") || code.includes("operation-not-supported")) {
			promptGoogleEmailFallback();
			return;
		}
		if (code.includes("operation-not-allowed")) {
			toast("warning", "Firebase Setup Notice", "Enable Google provider in Firebase Console > Authentication > Sign-in method.");
			return;
		}
		toast("error", "Google Sign-In", mapAuthError(err) || "Unable to complete Google Sign-In. Please try again.");
	} finally {
		setTimeout(() => {
			isGoogleAuthInProgress = false;
		}, 600);
	}
}
function promptGoogleEmailFallback() {
	openModal({
		title: "Google Account",
		bodyHTML: `
      <div style="text-align:center;margin-bottom:14px;">
        <svg class="google-svg" viewBox="0 0 24 24" style="width:36px;height:36px;margin:0 auto 8px;display:block;">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
        </svg>
        <h3 style="font-size:1.15rem;font-weight:700;margin-bottom:4px;color:var(--tx,#0f172a);">Google Account</h3>
        <p style="font-size:.82rem;color:var(--txm,#64748b);margin:0;">Enter your Google email to sign in or complete profile.</p>
      </div>
      <form id="googleDirectForm" novalidate>
        <div class="field" style="position:relative;">
          <label>Google Email <span class="req">*</span></label>
          <div class="ig">
            <i class="fa-solid fa-envelope igi"></i>
            <input type="email" id="directGoogleEmail" class="input" placeholder="example@gmail.com" autocomplete="email" required autofocus>
          </div>
          <small class="field-error" id="errDirectGoogleEmail"></small>
        </div>
        <button type="submit" class="btn btn-primary btn-block" id="btnDirectGoogleSubmit">
          <i class="fa-solid fa-arrow-right"></i> Continue
        </button>
      </form>
    `,
		footerHTML: "<button class=\"btn btn-ghost w-100\" data-x=\"c\">Cancel</button>",
		onMount: (el, close) => {
			el.querySelector("[data-x=\"c\"]").onclick = close;
			const emailInput = el.querySelector("#directGoogleEmail");
			const errBox = el.querySelector("#errDirectGoogleEmail");
			try {
				const saved = localStorage.getItem("pe_saved_email");
				if (saved) emailInput.value = saved;
			} catch (e) {}
			el.querySelector("#googleDirectForm").onsubmit = async (e) => {
				e.preventDefault();
				const email = emailInput.value.trim().toLowerCase();
				if (!email.includes("@") || !email.includes(".")) {
					errBox.textContent = "Enter a valid Google email address";
					return;
				}
				close();
				addVerifiedDeviceGoogleAccount(email, email.split("@")[0]);
				await onGoogleUserAuthenticated(null, email, email.split("@")[0]);
			};
		}
	});
}
function addVerifiedDeviceGoogleAccount(email, name, photoUrl = "") {
	if (!email) return;
	try {
		const clean = email.trim().toLowerCase();
		let list = JSON.parse(localStorage.getItem("pe_verified_google_accounts") || "[]");
		if (!Array.isArray(list)) list = [];
		const idx = list.findIndex((a) => String(a?.email || "").toLowerCase() === clean);
		const cached = photoUrl || getCachedAvatarForEmail(clean);
		if (idx < 0) {
			const avatarColors = [
				"#1565c0",
				"#7b1fa2",
				"#00897b",
				"#ef6c00",
				"#2e7d32",
				"#6a1b9a"
			];
			list.push({
				name: name || clean.split("@")[0],
				email: clean,
				color: avatarColors[list.length % avatarColors.length],
				photoUrl: cached || ""
			});
		} else {
			if (name) list[idx].name = name;
			if (cached) list[idx].photoUrl = cached;
		}
		localStorage.setItem("pe_verified_google_accounts", JSON.stringify(list));
		if (cached) localStorage.setItem("pe_avatar_" + clean, cached);
	} catch (e) {}
}
async function onGoogleUserAuthenticated(user, explicitEmail = null, explicitName = null) {
	const email = (explicitEmail || user?.email || "").trim().toLowerCase();
	const displayName = explicitName || user?.displayName || email.split("@")[0];
	if (!user && email) {
		let savedPwd = "";
		try {
			savedPwd = localStorage.getItem("pe_pwd_" + email) || "";
		} catch (e) {}
		if (savedPwd) try {
			const cred = await signInWithEmailAndPassword(auth, email, savedPwd);
			if (cred?.user) user = cred.user;
		} catch (e) {}
	}
	const uid = user?.uid || auth.currentUser?.uid || "g_" + btoa(email).replace(/=/g, "");
	let existingUser = null;
	try {
		const userSnap = await get(ref(db, "users/" + uid));
		if (userSnap.exists() && userSnap.val().freeFireUid) existingUser = userSnap.val();
	} catch (e) {}
	if (!existingUser) try {
		const snapByEmail = await get(query(ref(db, "users"), orderByChild("email"), equalTo(email)));
		if (snapByEmail.exists()) snapByEmail.forEach((c) => {
			const val = c.val();
			if (val && val.freeFireUid) existingUser = {
				uid: c.key,
				...val
			};
		});
	} catch (e) {}
	if (!existingUser && (user || auth.currentUser)) try {
		const allSnap = await get(ref(db, "users"));
		if (allSnap.exists()) allSnap.forEach((c) => {
			const val = c.val();
			if (val && val.freeFireUid && String(val.email || "").trim().toLowerCase() === email) existingUser = {
				uid: c.key,
				...val
			};
		});
	} catch (e) {}
	if (existingUser && existingUser.freeFireUid) {
		State.user = user || auth.currentUser || {
			uid: existingUser.uid,
			email: existingUser.email,
			displayName: existingUser.displayName
		};
		State.profile = existingUser;
		addVerifiedDeviceGoogleAccount(email, existingUser.displayName || displayName, existingUser.photoUrl || user?.photoURL || "");
		try {
			localStorage.setItem("pe_saved_email", email);
		} catch (e) {}
		$("#authScreen").style.display = "none";
		$("#appShell").classList.add("active");
		await initApp();
		toast("success", "Logged In!", `Welcome back, ${existingUser.freeFireUsername || existingUser.displayName || "Player"}!`);
		return;
	}
	if (!user && !auth.currentUser && email) try {
		const methods = await fetchSignInMethodsForEmail(auth, email);
		if (Array.isArray(methods) && methods.length > 0) {
			openPasswordLoginModal(email, true);
			return;
		}
	} catch (e) {}
	openGoogleRegistrationModal(email, displayName, user);
}
function openGoogleRegistrationModal(email, defaultName, authUser) {
	let registrationCompleted = false;
	const returnToFirstAuthScreen = async () => {
		if (registrationCompleted) return;
		try {
			await signOut(auth);
		} catch (e) {}
		State.user = null;
		State.profile = null;
		$("#appShell").classList.remove("active");
		$("#authScreen").style.display = "flex";
		hideSplash();
	};
	$("#appShell").classList.remove("active");
	$("#authScreen").style.display = "flex";
	openModal({
		title: "Complete Profile / Register",
		bodyHTML: `
      <div id="gRegModalAlert"></div>
      <div style="text-align:center;margin-bottom:16px;">
        <span class="pe-theme-logo" style="width:52px;height:52px;margin:0 auto 8px;display:block;" role="img" aria-label="Punjab Esports"></span>
        <h3 style="font-size:1.25rem;font-weight:700;margin-bottom:2px;color:var(--tx,#0f172a);">Complete Profile / Register</h3>
        <p style="font-size:.82rem;color:var(--txm,#64748b);margin:0;">Fill in your Free Fire details to finish setup</p>
      </div>

      <form id="googleRegForm" novalidate>
        <!-- 1. Google Email: Non-editable / Read-only -->
        <div class="field">
          <label>Google Email <span style="font-size:.72rem;color:var(--txm);font-weight:normal;">(Auto-filled from Google, Non-editable)</span></label>
          <div class="ig">
            <i class="fa-solid fa-envelope igi"></i>
            <input type="email" id="gRegEmail" class="input" value="${esc(email)}" readonly disabled style="background:var(--sf2,#f1f5f9);cursor:not-allowed;color:var(--txd,#475569);font-weight:600;">
          </div>
        </div>

        <!-- 2. Free Fire Username (Required) -->
        <div class="field">
          <label>Free Fire Username <span class="req">*</span></label>
          <div class="ig">
            <i class="fa-solid fa-gamepad igi"></i>
            <input type="text" id="gRegFfName" class="input" placeholder="In-Game Free Fire Name" maxlength="30" value="${esc(defaultName && defaultName !== email.split("@")[0] ? defaultName : "")}" required autofocus>
          </div>
          <small class="field-error" id="errGRegFfName"></small>
        </div>

        <!-- 3. Free Fire UID (Required) -->
        <div class="field">
          <label>Free Fire UID <span class="req">*</span></label>
          <div class="ig">
            <i class="fa-solid fa-id-card igi"></i>
            <input type="text" id="gRegFfUid" class="input" placeholder="Enter 6-16 digit UID (Numbers only)" maxlength="18" required>
          </div>
          <small class="field-error" id="errGRegFfUid"></small>
        </div>

        <!-- 4. Password (Set Password) -->
        <div class="field">
          <label>Password <span class="req">*</span> <span style="font-size:.72rem;color:var(--txm);font-weight:normal;">(Set Password)</span></label>
          <div class="ig">
            <i class="fa-solid fa-lock igi"></i>
            <input type="password" id="gRegPass" class="input" placeholder="At least 6 characters" autocomplete="new-password" required>
            <button type="button" class="igt" id="gRegPassToggle"><i class="fa-solid fa-eye"></i></button>
          </div>
          <small class="field-error" id="errGRegPass"></small>
        </div>

        <!-- 5. Referral Code (Optional) -->
        <div class="field">
          <label>Referral Code (Optional)</label>
          <div class="ig">
            <i class="fa-solid fa-gift igi"></i>
            <input type="text" id="gRegRefCode" class="input" placeholder="Enter friend's referral code (Optional)" style="text-transform:uppercase;">
          </div>
          <small class="field-hint" style="color:var(--txm);font-size:.72rem;">Get welcome bonus balance if valid code entered!</small>
        </div>

        <button type="submit" class="btn btn-primary btn-block" id="gRegSubmitBtn" style="margin-top:16px;">
          <i class="fa-solid fa-check"></i> Complete Registration
        </button>
        <p class="tc mt-3" style="margin-bottom:0;">
          <a href="#" id="gRegSwitchToLogin" style="font-size:.82rem;font-weight:600;">Already have an account? Sign In with Password</a>
        </p>
      </form>
    `,
		footerHTML: `<button class="btn btn-ghost w-100" data-x="c">Cancel</button>`,
		onClose: (reason) => {
			if (reason !== "complete") returnToFirstAuthScreen();
		},
		onMount: (el, close) => {
			el.querySelector("[data-x=\"c\"]").onclick = () => close("cancel");
			el._markRegistrationComplete = () => {
				registrationCompleted = true;
			};
			const switchLoginLink = el.querySelector("#gRegSwitchToLogin");
			if (switchLoginLink) switchLoginLink.onclick = (ev) => {
				ev.preventDefault();
				registrationCompleted = true;
				close("complete");
				openPasswordLoginModal(email, true);
			};
			const passInput = el.querySelector("#gRegPass");
			const passToggle = el.querySelector("#gRegPassToggle");
			passToggle.onclick = () => {
				const show = passInput.type === "password";
				passInput.type = show ? "text" : "password";
				passToggle.querySelector("i").className = show ? "fa-solid fa-eye-slash" : "fa-solid fa-eye";
			};
			el.querySelector("#googleRegForm").onsubmit = async (e) => {
				e.preventDefault();
				const alertBox = el.querySelector("#gRegModalAlert");
				alertBox.innerHTML = "";
				const ffName = el.querySelector("#gRegFfName").value.trim();
				const ffUid = el.querySelector("#gRegFfUid").value.trim();
				const pass = passInput.value;
				const refCodeInput = el.querySelector("#gRegRefCode").value.trim().toUpperCase();
				const errFfName = el.querySelector("#errGRegFfName");
				const errFfUid = el.querySelector("#errGRegFfUid");
				const errPass = el.querySelector("#errGRegPass");
				errFfName.textContent = "";
				errFfUid.textContent = "";
				errPass.textContent = "";
				let ok = true;
				if (ffName.length < 2) {
					errFfName.textContent = "Enter Free Fire Username";
					ok = false;
				}
				if (!/^\d{6,16}$/.test(ffUid)) {
					errFfUid.textContent = "UID must be 6-16 digits";
					ok = false;
				}
				if (pass.length < 6) {
					errPass.textContent = "Min 6 characters required";
					ok = false;
				}
				if (!ok) return;
				const btn = el.querySelector("#gRegSubmitBtn");
				btn.disabled = true;
				btn.innerHTML = "<i class=\"fa-solid fa-circle-notch spin\"></i> Creating account...";
				try {
					let currentAuthUser = authUser || auth.currentUser;
					let uid = currentAuthUser?.uid;
					if (!currentAuthUser) try {
						const cred = await createUserWithEmailAndPassword(auth, email, pass);
						currentAuthUser = cred.user;
						uid = cred.user.uid;
					} catch (createErr) {
						if (createErr?.code?.includes("email-already-in-use")) try {
							const cred = await signInWithEmailAndPassword(auth, email, pass);
							currentAuthUser = cred.user;
							uid = cred.user.uid;
							const existSnap = await get(ref(db, "users/" + uid)).catch(() => null);
							if (existSnap && existSnap.exists() && existSnap.val()?.freeFireUid) {
								const existingProf = existSnap.val();
								try {
									localStorage.setItem("pe_saved_email", email);
									localStorage.setItem("pe_pwd_" + email, pass);
								} catch (e) {}
								State.user = currentAuthUser;
								State.profile = existingProf;
								registrationCompleted = true;
								close("complete");
								$("#authScreen").style.display = "none";
								$("#appShell").classList.add("active");
								await initApp();
								toast("success", "Existing Account Loaded!", `Welcome back, ${existingProf.freeFireUsername || existingProf.displayName || "Player"}!`);
								return;
							}
						} catch (signErr) {
							playWarningSound();
							alertBox.innerHTML = `
                    <div class="alert error" style="flex-direction:column;align-items:flex-start;gap:8px;">
                      <div><i class="fa-solid fa-circle-exclamation"></i> <b>Account already exists</b> for ${esc(email)}. Duplicate registration is not allowed.</div>
                      <button type="button" class="btn btn-primary btn-sm" id="btnExistingGoLogin">Sign In with Password instead</button>
                    </div>`;
							const goLoginBtn = alertBox.querySelector("#btnExistingGoLogin");
							if (goLoginBtn) goLoginBtn.onclick = () => {
								registrationCompleted = true;
								close("complete");
								openPasswordLoginModal(email, true);
							};
							btn.disabled = false;
							btn.innerHTML = "<i class=\"fa-solid fa-check\"></i> Complete Registration";
							return;
						}
						else throw createErr;
					}
					if (currentAuthUser) try {
						await updateProfile(currentAuthUser, { displayName: ffName });
					} catch (e) {}
					if (uid) {
						const doubleCheckSnap = await get(ref(db, "users/" + uid)).catch(() => null);
						if (doubleCheckSnap && doubleCheckSnap.exists() && doubleCheckSnap.val()?.freeFireUid) {
							const existingProf = doubleCheckSnap.val();
							State.user = currentAuthUser;
							State.profile = existingProf;
							registrationCompleted = true;
							close("complete");
							$("#authScreen").style.display = "none";
							$("#appShell").classList.add("active");
							await initApp();
							toast("success", "Logged In!", `Welcome back, ${existingProf.freeFireUsername || existingProf.displayName || "Player"}!`);
							return;
						}
					}
					const now = Date.now();
					const refCode = "PE" + uid.slice(0, 5).toUpperCase() + Math.random().toString(36).slice(2, 5).toUpperCase();
					let startingBalance = 0;
					let referredByUid = null;
					if (refCodeInput) try {
						const rSnap = await get(query(ref(db, "users"), orderByChild("referralCode"), equalTo(refCodeInput)));
						if (rSnap.exists()) rSnap.forEach((c) => {
							if (c.val().referralCode === refCodeInput && c.key !== uid) referredByUid = c.key;
						});
					} catch (e) {}
					let signupBonus = 2;
					try {
						const rSet = await get(ref(db, "appSettings/referralLinks"));
						if (rSet.exists()) {
							const rv = rSet.val();
							signupBonus = Number(rv.signupBonus) || 2;
							Number(rv.referralBonus);
						}
					} catch (e) {}
					if (referredByUid) startingBalance = signupBonus;
					const newProfile = {
						uid,
						displayName: ffName,
						email,
						freeFireUsername: ffName,
						freeFireUid: ffUid,
						status: "active",
						referralCode: refCode,
						referredBy: referredByUid || null,
						createdAt: now,
						updatedAt: now,
						photoUrl: currentAuthUser?.photoURL || "",
						balance: startingBalance,
						coins: 0,
						diamonds: 0,
						hasUsedTeamTrial: false
					};
					await set(ref(db, "users/" + uid), newProfile);
					await set(ref(db, "wallets/" + uid), {
						balance: startingBalance,
						reserved: 0,
						updatedAt: now
					});
					await set(ref(db, "publicProfiles/" + uid), {
						uid,
						displayName: ffName,
						freeFireUsername: ffName,
						freeFireUid: ffUid,
						photoUrl: currentAuthUser?.photoURL || "",
						createdAt: now
					});
					if (referredByUid && startingBalance > 0) try {
						const txRef = push(ref(db, "walletTransactions"));
						await set(txRef, {
							id: txRef.key,
							userId: uid,
							type: "referral_bonus",
							amount: startingBalance,
							status: "completed",
							createdAt: now
						});
					} catch (e) {}
					try {
						localStorage.setItem("pe_saved_email", email);
						localStorage.setItem("pe_pwd_" + email, pass);
					} catch (e) {}
					addVerifiedDeviceGoogleAccount(email, ffName, currentAuthUser?.photoURL || "");
					State.user = currentAuthUser || {
						uid,
						email,
						displayName: ffName
					};
					State.profile = newProfile;
					registrationCompleted = true;
					close("complete");
					$("#authScreen").style.display = "none";
					$("#appShell").classList.add("active");
					await initApp();
					toast("success", "Registration Complete!", `Welcome to Punjab Esports, ${ffName}!`);
				} catch (err) {
					console.error("Registration error:", err);
					alertBox.innerHTML = `<div class="alert error"><i class="fa-solid fa-circle-exclamation"></i><span>${esc(err?.message || "Registration failed. Try again.")}</span></div>`;
					btn.disabled = false;
					btn.innerHTML = "<i class=\"fa-solid fa-check\"></i> Complete Registration";
				}
			};
		}
	});
}
function openPasswordLoginModal(prefilledEmail = "", isExistingNotice = false) {
	openModal({
		title: "Sign In with Password",
		bodyHTML: `
      <div id="pwdModalAlert">${isExistingNotice ? `<div class="alert info" style="margin-bottom:12px;"><i class="fa-solid fa-circle-info"></i><span>Account found for <b>${esc(prefilledEmail)}</b>. Enter your password to sign in.</span></div>` : ""}</div>
      <form id="pwdLoginForm" novalidate>
        <div class="field" style="position:relative;">
          <label>Email <span class="req">*</span></label>
          <div class="ig">
            <i class="fa-solid fa-envelope igi"></i>
            <input type="email" id="modalLoginEmail" class="input" placeholder="you@example.com" autocomplete="email" required>
          </div>
          <div class="email-suggest-box" id="modalLoginEmailSuggest"></div>
          <small class="field-error" id="errModalLoginEmail"></small>
        </div>

        <div class="field">
          <label>Password <span class="req">*</span></label>
          <div class="ig">
            <i class="fa-solid fa-lock igi"></i>
            <input type="password" id="modalLoginPass" class="input" placeholder="Enter password" autocomplete="current-password" required>
            <button type="button" class="igt" id="modalLoginPassToggle"><i class="fa-solid fa-eye"></i></button>
          </div>
          <small class="field-error" id="errModalLoginPass"></small>
        </div>

        <button type="submit" class="btn btn-primary btn-block" id="modalLoginBtn">
          <i class="fa-solid fa-right-to-bracket"></i> Sign In
        </button>
        <p class="tc mt-3"><a href="#" id="modalForgotLink" style="font-size:.82rem;">Forgot password?</a></p>
      </form>
    `,
		footerHTML: `<button class="btn btn-ghost w-100" data-x="c">Close</button>`,
		onMount: (el, close) => {
			el.querySelector("[data-x=\"c\"]").onclick = close;
			const emailInput = el.querySelector("#modalLoginEmail");
			setupEmailAutocomplete(emailInput, el.querySelector("#modalLoginEmailSuggest"));
			try {
				const saved = prefilledEmail || localStorage.getItem("pe_saved_email");
				if (saved) emailInput.value = saved;
			} catch (e) {}
			const passInput = el.querySelector("#modalLoginPass");
			const passToggle = el.querySelector("#modalLoginPassToggle");
			passToggle.onclick = () => {
				const show = passInput.type === "password";
				passInput.type = show ? "text" : "password";
				passToggle.querySelector("i").className = show ? "fa-solid fa-eye-slash" : "fa-solid fa-eye";
			};
			el.querySelector("#modalForgotLink").onclick = async (e) => {
				e.preventDefault();
				const em = emailInput.value.trim();
				if (!/^\S+@\S+\.\S+$/.test(em)) {
					toast("warning", "Enter Email", "Please enter your registered email address.");
					return;
				}
				try {
					await sendPasswordResetEmail(auth, em);
					toast("success", "Reset Link Sent", "Check your email inbox.");
				} catch (err) {
					toast("error", "Error", mapAuthError(err));
				}
			};
			el.querySelector("#pwdLoginForm").onsubmit = async (e) => {
				e.preventDefault();
				const email = emailInput.value.trim();
				const pass = passInput.value;
				const errEmail = el.querySelector("#errModalLoginEmail");
				const errPass = el.querySelector("#errModalLoginPass");
				const alertBox = el.querySelector("#pwdModalAlert");
				errEmail.textContent = "";
				errPass.textContent = "";
				alertBox.innerHTML = "";
				let ok = true;
				if (!/^\S+@\S+\.\S+$/.test(email)) {
					errEmail.textContent = "Enter a valid email";
					ok = false;
				}
				if (pass.length < 6) {
					errPass.textContent = "Min 6 characters";
					ok = false;
				}
				if (!ok) return;
				const btn = el.querySelector("#modalLoginBtn");
				btn.disabled = true;
				btn.innerHTML = "<i class=\"fa-solid fa-circle-notch spin\"></i> Signing in...";
				try {
					try {
						localStorage.setItem("pe_saved_email", email);
						localStorage.setItem("pe_pwd_" + email, pass);
					} catch (e) {}
					await signInWithEmailAndPassword(auth, email, pass);
					close();
					toast("success", "Welcome Back!", "");
				} catch (err) {
					alertBox.innerHTML = `<div class="alert error"><i class="fa-solid fa-circle-exclamation"></i><span>${esc(mapAuthError(err))}</span></div>`;
				} finally {
					btn.disabled = false;
					btn.innerHTML = "<i class=\"fa-solid fa-right-to-bracket\"></i> Sign In";
				}
			};
		}
	});
}
async function fetchSupportConfig() {
	try {
		const [supSnap, linksSnap] = await Promise.all([get(ref(db, "appSettings/supportiveLinks")).catch(() => null), get(ref(db, "appSettings/support")).catch(() => null)]);
		const v1 = supSnap?.exists() ? supSnap.val() : {};
		const v2 = linksSnap?.exists() ? linksSnap.val() : {};
		const cfg = {
			telegram: v1.telegram || v2.telegram || State.supportConfig.telegram || "PunjabEsports",
			whatsapp: v1.whatsapp || v2.whatsapp || State.supportConfig.whatsapp || "+919876543210",
			instagram: v1.instagram || v2.instagram || State.supportConfig.instagram || "punjab_esports",
			youtube: v1.youtube || State.supportConfig.youtube || "https://www.youtube.com/@PunjabEsports",
			gmail: v1.gmail || v2.gmail || v2.email || State.supportConfig.gmail || "pbanmol025@gmail.com"
		};
		State.supportConfig = cfg;
		try {
			localStorage.setItem("pe_support_config", JSON.stringify(cfg));
		} catch (e) {}
		return cfg;
	} catch (e) {
		return State.supportConfig;
	}
}
function buildSupportLinksHTML(cfg, compact = false) {
	const c = cfg || State.supportConfig;
	const mb = compact ? "margin-bottom:0" : "";
	const waNum = String(c.whatsapp || "").trim();
	const tgUser = String(c.telegram || "").trim();
	const igUser = String(c.instagram || "").trim();
	const ytLink = String(c.youtube || "").trim();
	const email = String(c.gmail || "").trim();
	let html = "";
	if (waNum) {
		const cleanWa = waNum.replace(/[^0-9]/g, "");
		const link = waNum.startsWith("http") ? waNum : `https://wa.me/${cleanWa}`;
		html += `<a href="${esc(link)}" target="_blank" rel="noopener" class="channel-btn whatsapp" style="${mb}"><div class="channel-btn-icon"><i class="fa-brands fa-whatsapp"></i></div><div class="cb-text"><b>${compact ? "WhatsApp Support" : "WhatsApp"}</b><small>${compact ? "Direct chat with Punjab Esports team" : "Get updates & chat directly on WhatsApp"}</small></div><i class="fa-solid fa-arrow-right"></i></a>`;
	}
	if (tgUser) {
		const cleanTg = tgUser.replace(/^@/, "").replace(/^https?:\/\/t\.me\//, "").replace(/\/$/, "");
		const link = tgUser.startsWith("http") ? tgUser : `https://t.me/${cleanTg}`;
		html += `<a href="${esc(link)}" target="_blank" rel="noopener" class="channel-btn telegram" style="${mb}"><div class="channel-btn-icon"><i class="fa-brands fa-telegram"></i></div><div class="cb-text"><b>${compact ? "Telegram Channel" : "Telegram"}</b><small>Join official channel for announcements</small></div><i class="fa-solid fa-arrow-right"></i></a>`;
	}
	if (igUser) {
		const cleanIg = igUser.replace(/^@/, "").replace(/^https?:\/\/(www\.)?instagram\.com\//, "").replace(/\/$/, "");
		const link = igUser.startsWith("http") ? igUser : `https://instagram.com/${cleanIg}`;
		html += `<a href="${esc(link)}" target="_blank" rel="noopener" class="channel-btn instagram" style="${mb}"><div class="channel-btn-icon"><i class="fa-brands fa-instagram"></i></div><div class="cb-text"><b>Instagram</b><small>Follow for highlights & updates</small></div><i class="fa-solid fa-arrow-right"></i></a>`;
	}
	if (ytLink) {
		const ytUrl = ytLink.startsWith("http") ? ytLink : "https://www.youtube.com/" + (ytLink.startsWith("@") ? ytLink : "@" + ytLink);
		html += `<a href="${esc(ytUrl)}" target="_blank" rel="noopener" class="channel-btn youtube" style="${mb}"><div class="channel-btn-icon"><i class="fa-brands fa-youtube"></i></div><div class="cb-text"><b>${compact ? "YouTube Channel" : "YouTube"}</b><small>Live tournament streams & gameplay</small></div><i class="fa-solid fa-arrow-right"></i></a>`;
	}
	if (email) html += `<a href="mailto:${esc(email)}?subject=${encodeURIComponent("Punjab Esports Support")}" class="channel-btn email" style="${mb}"><div class="channel-btn-icon"><i class="fa-solid fa-envelope"></i></div><div class="cb-text"><b>Email Support</b><small>${esc(email)}</small></div><i class="fa-solid fa-arrow-right"></i></a>`;
	return html;
}
fetchSupportConfig();
function openContactUsModal() {
	openModal({
		title: "Contact Us & Official Channels",
		bodyHTML: `<div id="contactChannelsWrap" style="display:flex;flex-direction:column;gap:10px;">${buildSupportLinksHTML(State.supportConfig, true)}</div>`,
		footerHTML: "<button class=\"btn btn-primary w-100\" data-x=\"close\">Close</button>",
		onMount: (el, close) => {
			el.querySelector("[data-x=\"close\"]").onclick = close;
			fetchSupportConfig().then((cfg) => {
				const wrap = el.querySelector("#contactChannelsWrap");
				if (wrap) wrap.innerHTML = buildSupportLinksHTML(cfg, true);
			});
		}
	});
}
function bindAuthScreenEvents() {
	const btnGoogle = document.getElementById("btnContinueGoogle");
	if (btnGoogle) btnGoogle.onclick = (e) => {
		e.preventDefault();
		handleContinueWithGoogle();
	};
	const btnPassword = document.getElementById("btnContinuePassword");
	if (btnPassword) btnPassword.onclick = (e) => {
		e.preventDefault();
		if (!ensureTermsAgreed(() => openPasswordLoginModal())) return;
		openPasswordLoginModal();
	};
	const btnSignup = document.getElementById("btnOpenSignup");
	if (btnSignup) btnSignup.onclick = (e) => {
		e.preventDefault();
		handleContinueWithGoogle();
	};
	const termsCheck = document.getElementById("authTermsAgree");
	if (termsCheck) termsCheck.onchange = () => {
		if (termsCheck.checked) {
			const termsContainer = document.getElementById("authTermsContainer");
			if (termsContainer) termsContainer.classList.remove("highlight-req");
			const errBox = document.getElementById("authTermsError");
			if (errBox) errBox.style.display = "none";
			if (typeof pendingAuthAction === "function") {
				const action = pendingAuthAction;
				pendingAuthAction = null;
				toast("success", "Terms Accepted", "Continuing...");
				setTimeout(() => {
					action();
				}, 150);
			}
		}
	};
	const contactBtn = document.getElementById("authContactBtn");
	if (contactBtn) contactBtn.onclick = (e) => {
		e.preventDefault();
		openContactUsModal();
	};
	const termsLink = document.getElementById("authLinkTerms");
	if (termsLink) termsLink.onclick = (e) => {
		e.preventDefault();
		openRules();
	};
	const privacyLink = document.getElementById("authLinkPrivacy");
	if (privacyLink) privacyLink.onclick = (e) => {
		e.preventDefault();
		openRules();
	};
}
bindAuthScreenEvents();
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", bindAuthScreenEvents);
window.addEventListener("load", bindAuthScreenEvents);
function mapAuthError(err) {
	const c = err?.code || "";
	if (c.includes("email-already-in-use")) return "Email already registered.";
	if (c.includes("invalid-credential") || c.includes("wrong-password") || c.includes("user-not-found")) return "Invalid email or password.";
	if (c.includes("weak-password")) return "Password too weak.";
	if (c.includes("invalid-email")) return "Invalid email.";
	if (c.includes("too-many-requests")) return "Too many attempts.";
	if (c.includes("network")) return "Network error.";
	return err?.message || "Something went wrong.";
}
onAuthStateChanged(auth, async (user) => {
	detachAll();
	if (!user) {
		State.user = null;
		State.profile = null;
		clearNativeNotificationSession();
		$("#appShell").classList.remove("active");
		$("#authScreen").style.display = "flex";
		hideSplash();
		return;
	}
	let snap = await get(ref(db, "users/" + user.uid)).catch(() => null);
	if ((!snap || !snap.exists() || !snap.val()?.freeFireUid) && user.email) try {
		const emailQuerySnap = await get(query(ref(db, "users"), orderByChild("email"), equalTo(user.email)));
		if (emailQuerySnap.exists()) emailQuerySnap.forEach((c) => {
			if (c.val() && c.val().freeFireUid) snap = c;
		});
	} catch (e) {}
	if (!snap || !snap.exists() || !snap.val()?.freeFireUid) {
		openGoogleRegistrationModal(user.email || "", user.displayName || "", user);
		hideSplash();
		return;
	}
	State.profile = snap.val();
	if (State.profile.status === "suspended" || State.profile.status === "banned") {
		await signOut(auth);
		$("#authAlert").innerHTML = `<div class="alert error"><i class="fa-solid fa-ban"></i><span>Your account is ${esc(State.profile.status)}. Contact support.</span></div>`;
		hideSplash();
		return;
	}
	State.user = user;
	$("#authScreen").style.display = "none";
	$("#appShell").classList.add("active");
	hideSplash();
	initApp();
	syncNativeNotificationSession(user);
	ensureWelcomeVipMailbox(user.uid);
});
function trackListener(r, cb) {
	onValue(r, cb, (e) => console.warn("listen err", e));
	State.listeners.push({
		ref: r,
		cb
	});
}
function detachAll() {
	State.listeners.forEach(({ ref, cb }) => {
		try {
			off(ref, "value", cb);
		} catch {}
	});
	State.listeners = [];
	if (State.dmListener) {
		State.dmListener();
		State.dmListener = null;
	}
	State.lastNotifTs = 0;
	State.notifInitialized = false;
	State.notifSeenIds = /* @__PURE__ */ new Set();
	State.rawNotifications = [];
	State.mailbox = [];
	State.shownWelcomeVipModal = false;
	State.lastKnownBalance = null;
}
async function initApp() {
	updateGreeting();
	loadProfileUI();
	attachListeners();
	navigate("home");
	Promise.all([
		loadThemeSettings().then(() => loadUserTheme()).then(() => {
			applyTheme(computeActiveTheme());
			if (State.currentPage === "profile") renderThemeGrid();
		}).catch(() => {}),
		loadCleanupSettings().catch(() => {}),
		loadVipSettings().catch(() => {}),
		loadReferralSettings().catch(() => {}),
		loadChannels().catch(() => {})
	]);
}
async function loadVipSettings() {
	try {
		const snap = await get(ref(db, "vipSettings"));
		if (snap.exists()) State.vipSettings = snap.val();
		else State.vipSettings = { plans: {
			p1: {
				days: 1,
				rupees: 10,
				diamonds: 100
			},
			p7: {
				days: 7,
				rupees: 49,
				diamonds: 500
			},
			p15: {
				days: 15,
				rupees: 99,
				diamonds: 1e3
			},
			p30: {
				days: 30,
				rupees: 149,
				diamonds: 1800
			}
		} };
	} catch (e) {}
}
async function loadReferralSettings() {
	try {
		const snap = await get(ref(db, "appSettings/referralLinks"));
		if (snap.exists()) State.referralSettings = snap.val();
	} catch (e) {}
	if (State.user) try {
		const rSnap = await get(query(ref(db, "referrals"), orderByChild("referrerId"), equalTo(State.user.uid)));
		const arr = [];
		rSnap.forEach((c) => {
			const v = c.val();
			if (isObj(v) && isWithinRetention(v.createdAt)) {
				v.id = c.key;
				arr.push(v);
			}
		});
		State.referrals = arr;
	} catch (e) {}
}
async function loadCleanupSettings() {
	try {
		const snap = await get(ref(db, "appSettings/cleanup"));
		if (snap.exists()) {
			const c = snap.val();
			State.cleanupDays = typeof c.days !== "undefined" ? Number(c.days) : 7;
			State.retentionMs = State.cleanupDays * 24 * 60 * 60 * 1e3;
			recomputeNotificationsFromState();
		}
	} catch (e) {}
}
function updateGreeting() {
	const n = State.profile?.displayName || "Player";
	const h = (/* @__PURE__ */ new Date()).getHours();
	const greet = h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
	$("#userGreeting").innerHTML = `${greet}, ${n} <span id="topBlueTick"></span>`;
	if (isVipActive()) {
		$("#topBlueTick").innerHTML = "<i class=\"fa-solid fa-circle-check blue-tick\"></i>";
		if ($("#profBlueTick")) $("#profBlueTick").innerHTML = "<i class=\"fa-solid fa-circle-check blue-tick\"></i>";
	} else {
		$("#topBlueTick").innerHTML = "";
		if ($("#profBlueTick")) $("#profBlueTick").innerHTML = "";
	}
}
function loadProfileUI() {
	const p = State.profile || {};
	$("#profileName").innerHTML = `${p.displayName || "Player"} <span id="profBlueTick"></span>`;
	$("#profileEmail").textContent = p.email || "";
	$("#profileFfUid").textContent = p.freeFireUid || "Set FF UID";
	$("#profileJoined").textContent = fmtDate(p.createdAt);
	$("#refCode").textContent = p.referralCode || "—";
	const av = $("#profileAvatar");
	if (p.photoUrl && (p.photoUrl.startsWith("data:image") || /^https?:\/\//i.test(p.photoUrl))) {
		av.innerHTML = `<img src="${esc(p.photoUrl)}" style="width:100%;height:100%;object-fit:cover;">`;
		if (p.email) saveAccountAvatarCache(p.email, p.photoUrl);
	} else if (p.profileEmoji) {
		av.innerHTML = `<span style="font-size:2.2rem; line-height:1;">${p.profileEmoji}</span>`;
		av.style.background = "linear-gradient(135deg,var(--sf3),var(--sf2))";
	} else {
		av.textContent = (p.displayName || "P").charAt(0).toUpperCase();
		av.style.background = "linear-gradient(135deg,var(--ac),var(--ac2))";
	}
	const diamonds = Number(p.diamonds || 0);
	const walletD = $("#walletDiamonds");
	if (walletD) walletD.textContent = diamonds.toLocaleString("en-IN");
	const homeBuyVipBtn = $("#homeBuyVipBtn");
	const vipExpiryText = $("#vipExpiryText");
	const vipCardSubText = $("#vipCardSubText");
	if (homeBuyVipBtn && vipExpiryText) {
		if (isVipActive()) {
			homeBuyVipBtn.innerHTML = "<i class=\"fa-solid fa-crown\"></i> Extend VIP";
			homeBuyVipBtn.style.display = "flex";
			vipExpiryText.style.display = "block";
			const now = Date.now();
			const expiry = p.vipExpiry;
			const diffMs = expiry - now;
			const diffDays = Math.floor(diffMs / 864e5);
			let timeText = "";
			if (diffDays >= 1) timeText = `Expires in ${diffDays} Day${diffDays > 1 ? "s" : ""}`;
			else {
				const diffHours = Math.ceil(diffMs / 36e5);
				timeText = `Expires in ${diffHours} Hour${diffHours > 1 ? "s" : ""}`;
			}
			vipExpiryText.innerHTML = `<i class="fa-solid fa-crown"></i> VIP Active<br><span style="color:var(--txm); font-size:0.68rem; font-weight:500;">${timeText}</span>`;
			if (vipCardSubText) vipCardSubText.textContent = `VIP Active till ${fmtDate(expiry)}. Click to Extend.`;
		} else {
			homeBuyVipBtn.innerHTML = "<i class=\"fa-solid fa-crown\"></i> Buy VIP";
			homeBuyVipBtn.style.display = "flex";
			vipExpiryText.style.display = "none";
			if (vipCardSubText) vipCardSubText.textContent = `Blue Tick, 9 Themes, Chat Wallpapers, World Chat, Admin DM & Team Logo`;
		}
	}
	refreshTheme();
	renderThemeGrid();
	updateGreeting();
	applyChatWallpaperToOpenChats();
}
async function loadChannels() {
	try {
		const cfg = await fetchSupportConfig();
		const card = $("#channelsCard");
		const host = $("#channelsHost");
		if (host) host.innerHTML = buildSupportLinksHTML(cfg, false);
		if (card) card.hidden = false;
	} catch (e) {
		const card = $("#channelsCard");
		if (card) card.hidden = false;
	}
}
function triggerBellRing(shouldOpenModal = false) {
	playNotifSound();
	const bell = $("#notifBtn");
	if (bell) {
		bell.classList.remove("bell-ring");
		bell.offsetWidth;
		bell.classList.add("bell-ring");
	}
	const existingModal = $(".notif-modal");
	if (existingModal) {
		existingModal.remove();
		openNotifications();
	} else if (shouldOpenModal) openNotifications();
}
async function ensureSyntheticNotification(uid, key, payload) {
	if (!uid || !key) return;
	try {
		const targetRef = ref(db, `notifications/${uid}/${key}`);
		const snap = await get(targetRef).catch(() => null);
		if (snap && snap.exists()) return;
		await set(targetRef, {
			id: key,
			...payload,
			read: false,
			createdAt: payload.createdAt || Date.now()
		});
	} catch (e) {}
}
var nativeNotifListenersBound = false;
function getNativeNotifPlugin() {
	return window.Capacitor?.Plugins?.NativeNotifications || null;
}
function sanitizeFcmTokenKey(token) {
	const cleaned = String(token || "").replace(/[^a-zA-Z0-9_-]/g, "_");
	if (cleaned.length > 48) return cleaned.slice(0, 24) + "_" + cleaned.slice(-20);
	return cleaned || "device";
}
async function saveFcmTokenToDb(uid, token) {
	if (!uid || !token) return;
	try {
		const tokenKey = sanitizeFcmTokenKey(token);
		const now = Date.now();
		await update(ref(db, "users/" + uid), {
			fcmToken: token,
			fcmUpdatedAt: now
		});
		await set(ref(db, `users/${uid}/fcmTokens/${tokenKey}`), {
			token,
			platform: "android",
			updatedAt: now
		});
	} catch (e) {}
}
function handleNativeNotifTarget(target) {
	if (!target || !State.user) return;
	const clean = String(target).toLowerCase().trim();
	setTimeout(() => {
		if (clean === "mailbox") openMailbox();
		else if (clean === "admindm") openAdminDM();
		else openNotifications();
	}, 260);
}
function markNativeNotifKeysSeen(keys) {
	const plugin = getNativeNotifPlugin();
	if (!plugin || !Array.isArray(keys) || !keys.length) return;
	try {
		plugin.markSeenKeys({ keys: keys.filter(Boolean) }).catch(() => {});
	} catch (e) {}
}
function postNativeSystemNotification(dedupeKey, title, body, target = "notifications") {
	const plugin = getNativeNotifPlugin();
	if (!plugin) return;
	try {
		plugin.showLocalNotification({
			dedupeKey: String(dedupeKey || ""),
			title: String(title || "Punjab Esports"),
			body: String(body || "You have a new update."),
			target: String(target || "notifications")
		}).catch(() => {});
	} catch (e) {}
}
async function syncNativeNotificationSession(user) {
	const plugin = getNativeNotifPlugin();
	if (!plugin || !user) return;
	try {
		if (!nativeNotifListenersBound && typeof plugin.addListener === "function") {
			nativeNotifListenersBound = true;
			plugin.addListener("notificationTap", (data) => {
				if (data?.target) handleNativeNotifTarget(data.target);
			});
			plugin.addListener("fcmToken", (data) => {
				if (data?.token && State.user?.uid) saveFcmTokenToDb(State.user.uid, data.token);
			});
		}
		const idToken = await user.getIdToken().catch(() => "");
		const refreshToken = user.refreshToken || user.stsTokenManager?.refreshToken || "";
		const res = await plugin.syncSession({
			uid: user.uid,
			databaseUrl: firebaseConfig.databaseURL,
			apiKey: firebaseConfig.apiKey,
			idToken: idToken || "",
			refreshToken: refreshToken || ""
		}).catch(() => null);
		if (res?.fcmToken) saveFcmTokenToDb(user.uid, res.fcmToken);
		const pending = await plugin.consumePendingTarget().catch(() => null);
		if (pending?.target) handleNativeNotifTarget(pending.target);
	} catch (e) {}
}
function clearNativeNotificationSession() {
	const plugin = getNativeNotifPlugin();
	if (!plugin) return;
	try {
		plugin.clearSession().catch(() => {});
	} catch (e) {}
}
function recomputeNotificationsFromState() {
	const filteredArr = (State.rawNotifications || []).filter((n) => {
		if (n.type === "announcement") return false;
		if (!n.read) return true;
		return isWithinRetention(n.createdAt || n.timestamp || n.time);
	});
	State.notifications = filteredArr;
	const unread = filteredArr.filter((n) => !n.read).length;
	const dot = $("#notifDot");
	if (dot) {
		if (unread > 0) {
			dot.hidden = false;
			dot.textContent = unread > 99 ? "99+" : unread;
		} else dot.hidden = true;
	}
	let maxTs = 0;
	filteredArr.forEach((n) => {
		const ts = toTimestampMs(n.createdAt || n.timestamp || n.time);
		if (ts > maxTs) maxTs = ts;
	});
	const newlyArrivedUnread = [];
	filteredArr.forEach((n) => {
		if (!State.notifSeenIds.has(n.id)) {
			State.notifSeenIds.add(n.id);
			if (!n.read) newlyArrivedUnread.push(n);
		}
	});
	if (!State.notifInitialized) {
		State.notifInitialized = true;
		State.lastNotifTs = maxTs;
		markNativeNotifKeysSeen(filteredArr.map((n) => "notif:" + n.id));
		if (unread > 0 && !State.shownStartupNotification) {
			State.shownStartupNotification = true;
			triggerBellRing(true);
		}
	} else if (newlyArrivedUnread.length > 0) {
		const newest = newlyArrivedUnread[0];
		toast("info", newest.title || "New Notification", newest.body || "");
		postNativeSystemNotification("notif:" + newest.id, newest.title || "New Notification", newest.body || "", "notifications");
		triggerBellRing(true);
	}
	if (maxTs > State.lastNotifTs) State.lastNotifTs = maxTs;
}
function attachListeners() {
	const uid = State.user.uid;
	const balStorageKey = "pe_last_bal_" + uid;
	const depStorageKey = "pe_seen_dep_" + uid;
	const wdStorageKey = "pe_seen_wd_" + uid;
	const txStorageKey = "pe_seen_tx_" + uid;
	let savedBal = null;
	try {
		const rawB = localStorage.getItem(balStorageKey);
		if (rawB !== null && !isNaN(Number(rawB))) savedBal = Number(rawB);
	} catch (e) {}
	State.lastKnownBalance = savedBal;
	trackListener(ref(db, "users/" + uid), (snap) => {
		if (snap.exists()) {
			State.profile = snap.val();
			if (State.profile.chatWallpaper) {
				State.chatWallpaper = State.profile.chatWallpaper;
				try {
					localStorage.setItem("pe_chat_wp_" + uid, JSON.stringify(State.profile.chatWallpaper));
				} catch (e) {}
			}
			loadProfileUI();
		}
	});
	let mailInit = false;
	const seenMailIds = /* @__PURE__ */ new Set();
	trackListener(ref(db, "users/" + uid + "/mailbox"), (snap) => {
		const arr = [];
		const nowTs = Date.now();
		if (snap.exists()) snap.forEach((c) => {
			const v = c.val();
			if (!isObj(v) || v.deleted) return;
			const item = {
				id: c.key,
				...v
			};
			if (item.status === "unclaimed" && isMailExpired(item, nowTs)) {
				purgeExpiredMailFromDb(uid, item);
				return;
			}
			arr.push(item);
		});
		arr.sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0));
		State.mailbox = arr;
		updateMailboxBadge();
		if (!mailInit) markNativeNotifKeysSeen(arr.map((m) => "mail:" + m.id));
		arr.forEach((m) => {
			if (!seenMailIds.has(m.id)) {
				seenMailIds.add(m.id);
				if (mailInit && m.status === "unclaimed") {
					toast("warning", "New Gift in Mailbox!", m.title || "Claim within 7 days before it expires.");
					postNativeSystemNotification("mail:" + m.id, "New Gift in Mailbox!", m.title || "Claim within 7 days before it expires.", "mailbox");
					playNotifSound();
				}
			}
		});
		mailInit = true;
	});
	trackListener(ref(db, "wallets/" + uid), (snap) => {
		const w = snap.val() || {
			balance: 0,
			reserved: 0
		};
		State.wallet = isObj(w) ? w : {
			balance: 0,
			reserved: 0
		};
		const newBal = Number(State.wallet.balance || 0);
		const balanceStr = fmtMoney(newBal);
		$("#homeBalance").textContent = balanceStr;
		$("#walletBalance").textContent = balanceStr;
		const prevBal = State.lastKnownBalance;
		State.lastKnownBalance = newBal;
		try {
			localStorage.setItem(balStorageKey, String(newBal));
		} catch (e) {}
		if (prevBal !== null && Math.abs(newBal - prevBal) >= .01) {
			if (!(Date.now() - (State.localWalletActionTs || 0) < 4500)) {
				const diff = Math.round((newBal - prevBal) * 100) / 100;
				const notifCheckTs = Date.now() - 4e3;
				setTimeout(() => {
					if (!(State.rawNotifications || []).some((n) => Number(n.createdAt || 0) >= notifCheckTs && /balance|deposit|withdraw|reward|prize|bonus|admin|refund/i.test(`${n.type || ""} ${n.title || ""} ${n.body || ""}`))) {
						const actionLabel = diff > 0 ? `+${fmtMoney(diff)} added` : `${fmtMoney(Math.abs(diff))} deducted`;
						ensureSyntheticNotification(uid, "auto_bal_" + Math.floor(Date.now() / 3e3), {
							type: "admin_set",
							title: "Wallet Balance Updated",
							body: `Your wallet was updated by admin (${actionLabel}). New balance: ${fmtMoney(newBal)}.`,
							createdAt: Date.now()
						});
					}
				}, 1200);
			}
		}
	});
	trackListener(query(ref(db, "worldChat"), orderByChild("createdAt"), limitToLast(50)), (snap) => {
		const arr = [];
		snap.forEach((c) => {
			const v = c.val();
			if (!isObj(v)) return;
			if (v.deleted) return;
			arr.push(v);
		});
		State.chatMessages = arr.filter((m) => !State.localDeletedChats.includes(m.id));
		if ($("#chatMessages") && $("#chatMessages").parentElement) renderChatMessages();
	});
	trackListener(ref(db, "tournaments"), (snap) => {
		const newTours = [];
		snap.forEach((c) => {
			const v = c.val();
			if (!isObj(v)) return;
			v.id = c.key;
			newTours.push(v);
		});
		State.tournaments = newTours;
		State.tournaments.sort((a, b) => {
			return (/* @__PURE__ */ new Date((a.matchDate || "2099-01-01") + "T" + (a.matchTime || "00:00"))).getTime() - (/* @__PURE__ */ new Date((b.matchDate || "2099-01-01") + "T" + (b.matchTime || "00:00"))).getTime();
		});
		State.tournaments.filter((t) => t.status === "cancelled" || t.status === "canceled").forEach((m) => processRefundIfNeeded(m.id, m));
		renderHomeMatches();
		renderTourList();
		renderMyMatches();
	});
	trackListener(ref(db, "matchResults"), (snap) => {
		State.matchResultsCache = {};
		if (snap.exists()) snap.forEach((c) => {
			const v = c.val();
			if (isObj(v)) State.matchResultsCache[c.key] = v;
		});
		renderMyMatches();
		recomputeNotificationsFromState();
		if (State.currentPage === "mymatches" && State.myTab === "leaderboard") {
			State.lbCache = {
				data: null,
				ts: 0
			};
			loadLeaderboardData();
		}
	});
	trackListener(query(ref(db, "registrations"), orderByChild("userId"), equalTo(uid)), (snap) => {
		State.myRegistrations = [];
		snap.forEach((c) => {
			const v = c.val();
			if (!isObj(v)) return;
			if (isWithinRetention(v.createdAt)) {
				v.id = c.key;
				State.myRegistrations.push(v);
			}
		});
		State.myRegistrations.forEach((reg) => {
			const m = State.tournaments.find((t) => t.id === reg.matchId);
			if (m && (m.status === "cancelled" || m.status === "canceled")) processRefundIfNeeded(m.id, m);
		});
		renderMyMatches();
		updateStats();
		updateWalletStats();
	});
	let seenTxMap = {};
	try {
		seenTxMap = JSON.parse(localStorage.getItem(txStorageKey) || "{}") || {};
	} catch (e) {}
	let txFirstLoad = Object.keys(seenTxMap).length === 0;
	trackListener(query(ref(db, "walletTransactions"), orderByChild("userId"), equalTo(uid)), (snap) => {
		const arr = [];
		snap.forEach((c) => {
			const v = c.val();
			if (!isObj(v)) return;
			v.id = v.id || c.key;
			if (isWithinRetention(v.createdAt)) arr.push(v);
		});
		arr.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
		State.transactions = arr;
		renderTransactions();
		updateWalletStats();
		const adminTxTypes = /* @__PURE__ */ new Set([
			"admin_set",
			"admin_diamond_gift",
			"admin_diamond_set",
			"deposit",
			"match_reward",
			"prize",
			"kill_reward",
			"referral",
			"withdrawal_refund"
		]);
		arr.forEach((tx) => {
			const prevStatus = seenTxMap[tx.id];
			const curStatus = tx.status || "completed";
			const isNewOrUpdated = !prevStatus || prevStatus !== curStatus;
			seenTxMap[tx.id] = curStatus;
			if (!txFirstLoad && isNewOrUpdated && adminTxTypes.has(tx.type)) {
				const snapCheckTs = Date.now() - 5e3;
				setTimeout(() => {
					if (!(State.rawNotifications || []).some((n) => Number(n.createdAt || 0) >= snapCheckTs && (n.relatedId === tx.id || /balance|deposit|withdraw|reward|prize|diamond|admin|refund/i.test(`${n.type || ""} ${n.title || ""} ${n.body || ""}`)))) {
						const amt = Number(tx.diamonds || tx.amount || 0);
						const valStr = tx.currency === "DIAMONDS" || String(tx.type || "").includes("diamond") ? `${Math.abs(amt)} Diamonds` : fmtMoney(Math.abs(amt));
						let title = "Wallet Updated by Admin";
						let body = `${valStr} updated in your account.`;
						if (tx.type === "deposit") {
							title = "Deposit Approved";
							body = `Your deposit of ${valStr} has been credited to your wallet.`;
						} else if (tx.type === "admin_set") {
							title = "Balance Updated by Admin";
							body = `Admin ${amt >= 0 ? "added" : "deducted"} ${valStr}.`;
						} else if (tx.type === "admin_diamond_gift" || tx.type === "admin_diamond_set") {
							title = "Diamonds Updated by Admin";
							body = `Admin ${amt >= 0 ? "credited" : "deducted"} ${valStr}.`;
						} else if (tx.type === "withdrawal_refund") {
							title = "Withdrawal Refunded";
							body = `${valStr} has been refunded to your wallet.`;
						} else if (tx.type === "match_reward" || tx.type === "prize" || tx.type === "kill_reward") {
							title = "Match Reward Credited";
							body = `${valStr} credited for ${tx.matchTitle || "your match"}.`;
						}
						ensureSyntheticNotification(uid, `auto_tx_${tx.id}_${curStatus}`, {
							type: tx.type,
							title,
							body,
							createdAt: Number(tx.updatedAt || tx.createdAt || Date.now())
						});
					}
				}, 1200);
			}
		});
		txFirstLoad = false;
		try {
			localStorage.setItem(txStorageKey, JSON.stringify(seenTxMap));
		} catch (e) {}
	});
	let seenDepMap = {};
	try {
		seenDepMap = JSON.parse(localStorage.getItem(depStorageKey) || "{}") || {};
	} catch (e) {}
	trackListener(query(ref(db, "depositRequests"), orderByChild("userId"), equalTo(uid)), (snap) => {
		snap.forEach((c) => {
			const d = c.val();
			if (!isObj(d)) return;
			const id = c.key;
			const st = String(d.status || "pending").toLowerCase();
			const prevSt = seenDepMap[id];
			seenDepMap[id] = st;
			if ((st === "approved" || st === "completed" || st === "rejected") && prevSt && prevSt !== st) {
				const snapCheckTs = Date.now() - 5e3;
				setTimeout(() => {
					if (!(State.rawNotifications || []).some((n) => Number(n.createdAt || 0) >= snapCheckTs && /deposit/i.test(`${n.type || ""} ${n.title || ""} ${n.body || ""}`))) {
						const approved = st === "approved" || st === "completed";
						ensureSyntheticNotification(uid, `auto_dep_${id}_${st}`, {
							type: approved ? "deposit" : "deposit_rejected",
							title: approved ? "Deposit Approved" : "Deposit Rejected",
							body: approved ? `Your deposit request of ${fmtMoney(d.amount || 0)} has been approved and added to your wallet.` : `Your deposit request of ${fmtMoney(d.amount || 0)} was rejected${d.reason ? ": " + d.reason : "."}`,
							createdAt: Date.now()
						});
					}
				}, 1200);
			}
		});
		try {
			localStorage.setItem(depStorageKey, JSON.stringify(seenDepMap));
		} catch (e) {}
	});
	let seenWdMap = {};
	try {
		seenWdMap = JSON.parse(localStorage.getItem(wdStorageKey) || "{}") || {};
	} catch (e) {}
	trackListener(query(ref(db, "withdrawalRequests"), orderByChild("userId"), equalTo(uid)), (snap) => {
		snap.forEach((c) => {
			const w = c.val();
			if (!isObj(w)) return;
			const id = c.key;
			const st = String(w.status || "pending").toLowerCase();
			const prevSt = seenWdMap[id];
			seenWdMap[id] = st;
			if ((st === "approved" || st === "completed" || st === "rejected") && prevSt && prevSt !== st) {
				const snapCheckTs = Date.now() - 5e3;
				setTimeout(() => {
					if (!(State.rawNotifications || []).some((n) => Number(n.createdAt || 0) >= snapCheckTs && /withdraw/i.test(`${n.type || ""} ${n.title || ""} ${n.body || ""}`))) {
						const approved = st === "approved" || st === "completed";
						ensureSyntheticNotification(uid, `auto_wd_${id}_${st}`, {
							type: approved ? "withdraw" : "withdraw_rejected",
							title: approved ? "Withdrawal Approved" : "Withdrawal Rejected",
							body: approved ? `Your withdrawal of ${fmtMoney(w.amount || 0)} has been processed to ${w.payoutDetail || "your UPI"}.` : `Your withdrawal request of ${fmtMoney(w.amount || 0)} was rejected${w.reason ? ": " + w.reason : "."}`,
							createdAt: Date.now()
						});
					}
				}, 1200);
			}
		});
		try {
			localStorage.setItem(wdStorageKey, JSON.stringify(seenWdMap));
		} catch (e) {}
	});
	trackListener(ref(db, "notifications/" + uid), (snap) => {
		const arr = [];
		snap.forEach((c) => {
			const v = c.val();
			if (!isObj(v)) return;
			const item = {
				...v,
				id: c.key
			};
			item._ts = toTimestampMs(v.createdAt || v.timestamp || v.time);
			arr.push(item);
		});
		arr.sort((a, b) => (b._ts || 0) - (a._ts || 0));
		State.rawNotifications = arr.slice(0, 80);
		recomputeNotificationsFromState();
	});
	let annInit = false;
	const seenAnnKeys = /* @__PURE__ */ new Set();
	trackListener(query(ref(db, "announcements"), orderByChild("createdAt"), limitToLast(5)), (snap) => {
		const arr = [];
		const keys = [];
		snap.forEach((c) => {
			const v = c.val();
			if (!isObj(v)) return;
			if (v.active !== false) {
				arr.push({
					...v,
					_key: c.key
				});
				keys.push("ann:" + c.key);
			}
		});
		arr.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
		if (!annInit) {
			markNativeNotifKeysSeen(keys);
			arr.forEach((a) => seenAnnKeys.add(a._key));
			annInit = true;
		} else arr.forEach((a) => {
			if (!seenAnnKeys.has(a._key)) {
				seenAnnKeys.add(a._key);
				postNativeSystemNotification("ann:" + a._key, a.title || "Punjab Esports Announcement", a.body || a.message || a.text || "New announcement available.", "notifications");
			}
		});
		renderAnnouncements(arr);
	});
	let dmAlertInit = false;
	const seenAdminDmIds = /* @__PURE__ */ new Set();
	trackListener(ref(db, "adminMessages/" + uid), (snap) => {
		const adminMsgs = [];
		if (snap.exists()) snap.forEach((c) => {
			const v = c.val();
			if (!isObj(v) || v.deleted || v.from === "user") return;
			adminMsgs.push({
				id: c.key,
				...v
			});
		});
		if (!dmAlertInit) {
			markNativeNotifKeysSeen(adminMsgs.map((m) => "dm:" + m.id));
			adminMsgs.forEach((m) => seenAdminDmIds.add(m.id));
			dmAlertInit = true;
			return;
		}
		adminMsgs.forEach((m) => {
			if (!seenAdminDmIds.has(m.id)) {
				seenAdminDmIds.add(m.id);
				const bodyTxt = m.text || "Official Admin sent you a reply.";
				if (!$(".dm-modal")) {
					toast("info", "Official Admin Reply", bodyTxt);
					playNotifSound();
				}
				postNativeSystemNotification("dm:" + m.id, "Official Admin Reply", bodyTxt, "admindm");
			}
		});
	});
	trackListener(ref(db, "themeSettings"), (snap) => {
		const cfg = snap.exists() ? snap.val() : {};
		themeState.mode = cfg.mode || "user";
		themeState.globalTheme = cfg.globalTheme || "mono";
		themeState.default = cfg.default && cfg.default !== "gold" ? cfg.default : "mono";
		themeState.enabled = cfg.enabled || {};
		refreshTheme();
		if (State.currentPage === "profile") renderThemeGrid();
	});
	trackListener(ref(db, "appSettings/cleanup"), (snap) => {
		if (snap.exists()) {
			const c = snap.val();
			State.cleanupDays = typeof c.days !== "undefined" ? Number(c.days) : 7;
			State.retentionMs = State.cleanupDays * 24 * 60 * 60 * 1e3;
			renderTransactions();
			renderMyMatches();
			recomputeNotificationsFromState();
		}
	});
	trackListener(ref(db, "vipSettings"), (snap) => {
		if (snap.exists()) State.vipSettings = snap.val();
	});
	trackListener(query(ref(db, "referrals"), orderByChild("referrerId"), equalTo(uid)), (snap) => {
		const arr = [];
		snap.forEach((c) => {
			const v = c.val();
			if (isObj(v) && isWithinRetention(v.createdAt)) {
				v.id = c.key;
				arr.push(v);
			}
		});
		State.referrals = arr;
		renderReferralStats();
	});
	trackListener(ref(db, "appSettings/supportiveLinks"), () => loadChannels());
	trackListener(ref(db, "appSettings/support"), () => loadChannels());
	trackListener(ref(db, "userTeams/" + uid), async (snap) => {
		if (snap.exists()) {
			const { teamId, role } = snap.val();
			const teamSnap = await get(ref(db, "teams/" + teamId)).catch(() => null);
			if (teamSnap && teamSnap.exists()) {
				State.myTeam = {
					...teamSnap.val(),
					teamId
				};
				State.teamRole = role;
				trackListener(ref(db, "teamWallets/" + teamId), (walletSnap) => {
					State.teamWalletData = walletSnap.exists() ? walletSnap.val() : {
						balance: 0,
						transactions: {},
						matchHistory: {}
					};
					if (State.currentPage === "mymatches" && State.myTab === "team") renderMyTeam();
				});
			} else {
				State.myTeam = null;
				State.teamRole = null;
				State.teamWalletData = null;
			}
		} else {
			State.myTeam = null;
			State.teamRole = null;
			State.teamWalletData = null;
		}
		if (State.currentPage === "mymatches") renderMyTeam();
	});
	trackListener(ref(db, "teamInvites/" + uid), (snap) => {
		const arr = [];
		snap.forEach((c) => {
			const v = c.val();
			if (isObj(v) && v.status === "pending") {
				v.id = c.key;
				arr.push(v);
			}
		});
		State.myTeamInvites = arr;
		if (State.currentPage === "mymatches") renderMyTeam();
	});
	get(ref(db, "appSettings")).then((s) => {
		State.settings = s.val() || {};
	}).catch(() => {});
}
async function processRefundIfNeeded(matchId, m) {
	if (m.status !== "cancelled" && m.status !== "canceled") return;
	const myRegs = State.myRegistrations.filter((r) => r.matchId === matchId);
	for (const reg of myRegs) {
		if (reg.refunded) continue;
		if (reg.paidBy === State.user.uid || !reg.paidBy && reg.userId === State.user.uid) {
			const refundAmount = Number(reg.entryFee || 0);
			await update(ref(db, "registrations/" + reg.id), { refunded: true });
			reg.refunded = true;
			if (refundAmount > 0) {
				await runTransaction(ref(db, "wallets/" + State.user.uid + "/balance"), (cur) => (Number(cur) || 0) + refundAmount);
				const txRef = push(ref(db, "walletTransactions"));
				await set(txRef, {
					id: txRef.key,
					userId: State.user.uid,
					type: "refund",
					amount: refundAmount,
					currency: "INR",
					relatedId: matchId,
					status: "completed",
					createdAt: Date.now()
				});
			}
			const notifRef = push(ref(db, "notifications/" + State.user.uid));
			await set(notifRef, {
				id: notifRef.key,
				type: "match_cancelled",
				title: "Match Cancelled & Refunded",
				body: `Match "${m.title}" has been cancelled. ₹${refundAmount} has been refunded to your wallet.`,
				matchId,
				read: false,
				createdAt: Date.now()
			});
			toast("info", "Match Cancelled", `₹${refundAmount} refunded to your wallet.`);
		}
	}
}
function renderReferralStats() {
	const refs = State.referrals || [];
	const total = refs.length;
	let earned = 0, pending = 0;
	refs.forEach((r) => {
		if (r.status === "credited") earned += Number(r.rewardAmount || 0);
		else pending++;
	});
	const elTotal = $("#refCount");
	if (elTotal) elTotal.textContent = total;
	const elEarned = $("#refEarned");
	if (elEarned) elEarned.textContent = fmtMoney(earned);
	const elPending = $("#refPending");
	if (elPending) elPending.textContent = pending;
}
function navigate(page) {
	State.currentPage = page;
	$$(".page").forEach((p) => p.classList.remove("active"));
	const el = document.getElementById("page-" + page);
	if (el) el.classList.add("active");
	$$(".bn-item").forEach((b) => b.classList.toggle("active", b.dataset.nav === page));
	window.scrollTo({
		top: 0,
		behavior: "smooth"
	});
	if (page === "profile") {
		loadProfileExtras();
		renderThemeGrid();
		loadChannels();
		renderReferralStats();
	}
	if (page === "mymatches") {
		switchMyTab(State.myTab || "matches");
		loadMyTeam();
	}
}
function switchMyTab(tab) {
	State.myTab = tab;
	$$("#myTopTabs .filter-chip").forEach((c) => c.classList.toggle("active", c.dataset.mytab === tab));
	const matches = $("#myTabMatches");
	const team = $("#myTabTeam");
	const lb = $("#myTabLeaderboard");
	if (matches) matches.hidden = tab !== "matches";
	if (team) team.hidden = tab !== "team";
	if (lb) lb.hidden = tab !== "leaderboard";
	if (tab === "team") loadMyTeam();
	if (tab === "leaderboard") loadLeaderboardData();
}
$$(".bn-item").forEach((b) => b.onclick = () => navigate(b.dataset.nav));
$$("[data-nav]").forEach((b) => {
	if (!b.classList.contains("bn-item")) b.onclick = () => navigate(b.dataset.nav);
});
$("#homeAddBtn").onclick = () => openAddBalance();
$("#homeWithdrawBtn").onclick = () => openWithdraw();
$("#walletAddBtn").onclick = () => openAddBalance();
$("#walletWithdrawBtn").onclick = () => openWithdraw();
$("#notifBtn").onclick = () => openNotifications();
$("#rulesBtn").onclick = () => openRules();
$("#editProfileBtn").onclick = () => openEditProfile();
if ($("#profileAvatar")) {
	$("#profileAvatar").style.cursor = "pointer";
	$("#profileAvatar").title = "Change profile photo";
	$("#profileAvatar").onclick = () => openEditProfile();
}
$("#openVipStoreBtn").onclick = () => openVipStore();
if ($("#profileVipCard")) $("#profileVipCard").onclick = (e) => {
	if (!e.target.closest("#openVipStoreBtn")) openVipStore();
};
$("#homeBuyVipBtn").onclick = () => openVipStore();
$("#chatBtn").onclick = () => openWorldChat();
$("#mailboxBtn").onclick = () => openMailbox();
$("#shareRefBtn").onclick = shareReferral;
function updateClickSoundToggle() {
	const enabled = isClickSoundEnabled();
	const toggle = $("#clickSoundToggle");
	const knob = $("#clickSoundKnob");
	if (!toggle || !knob) return;
	toggle.setAttribute("aria-checked", String(enabled));
	toggle.title = enabled ? "Turn button sounds off" : "Turn button sounds on";
	knob.style.left = enabled ? "24px" : "2px";
	knob.style.background = enabled ? "var(--ac)" : "var(--txm)";
}
$("#clickSoundToggle").onclick = () => {
	const enabled = !isClickSoundEnabled();
	try {
		localStorage.setItem("pe_click_sound", enabled ? "on" : "off");
	} catch (e) {}
	updateClickSoundToggle();
	if (enabled) playClickSound();
	toast("success", "Button sound " + (enabled ? "enabled" : "disabled"), enabled ? "A soft sound will play when you tap buttons." : "Button sounds are now off.");
};
updateClickSoundToggle();
$("#logoutBtn").onclick = async () => {
	if (!await confirmDialog("Logout", "End your session?")) return;
	detachAll();
	await signOut(auth);
	toast("success", "Logged out", "");
};
$("#darkModeToggle").onclick = () => {
	applyBgMode((document.documentElement.getAttribute("data-bg") === "dark" ? "light" : "dark") === "dark");
};
$$("#myTopTabs .filter-chip").forEach((c) => c.onclick = () => switchMyTab(c.dataset.mytab));
$$("#lbSubTabs .filter-chip").forEach((c) => c.onclick = () => {
	State.lbTab = c.dataset.lbtab;
	$$("#lbSubTabs .filter-chip").forEach((x) => x.classList.toggle("active", x.dataset.lbtab === State.lbTab));
	renderLeaderboard();
});
function renderHomeMatches() {
	const host = $("#homeMatches");
	const list = State.tournaments.filter((t) => t.status === "upcoming" || t.status === "ongoing");
	if (!list.length) {
		host.innerHTML = `<div class="empty-state"><div class="es-icon"><i class="fa-solid fa-trophy"></i></div><h3>No matches yet</h3></div>`;
		return;
	}
	host.innerHTML = list.map((m) => matchCardHTML(m)).join("");
	bindMatchCardClicks(host);
}
function updateStats() {
	const regs = State.myRegistrations || [];
	$("#statPlayed").textContent = regs.filter((r) => r.status === "confirmed").length;
	let wins = 0, kills = 0;
	regs.forEach((r) => {
		const res = State.matchResultsCache[r.matchId];
		if (res && res.entries && res.entries[r.userId]) {
			const e = res.entries[r.userId];
			if (Number(e.rank) === 1) wins++;
			kills += Number(e.kills || 0);
		}
	});
	$("#statWins").textContent = wins;
	$("#statKills").textContent = kills;
}
function updateWalletStats() {
	const txs = State.transactions || [];
	let deposited = 0, won = 0, pending = 0;
	txs.forEach((t) => {
		if (t.currency === "DIAMONDS") return;
		if (t.type === "deposit" && t.status === "completed") deposited += Number(t.amount || 0);
		if ((t.type === "match_reward" || t.type === "prize" || t.type === "kill_reward" || t.type === "referral") && t.status === "completed") won += Number(t.amount || 0);
		if (t.status === "pending") pending += Number(t.amount || 0);
	});
	const wd = $("#walletDeposited");
	if (wd) wd.textContent = fmtMoney(deposited);
	const ww = $("#walletWon");
	if (ww) ww.textContent = fmtMoney(won);
	const wp = $("#walletPending");
	if (wp) wp.textContent = fmtMoney(pending);
}
function renderAnnouncements(list) {
	const host = $("#announcementHost");
	if (!list.length) {
		host.innerHTML = "";
		return;
	}
	host.innerHTML = list.slice(0, 2).map((a) => `<div class="card mb-3" style="border-left:4px solid var(--ac)"><div class="flex-between mb-2"><b>${esc(a.title || "")}</b><span class="badge neutral">${fmtDate(a.createdAt)}</span></div><p style="margin:0;font-size:.85rem">${esc(a.body || "")}</p></div>`).join("");
}
$$("#statusTabs .filter-chip").forEach((c) => c.onclick = () => {
	$$("#statusTabs .filter-chip").forEach((x) => x.classList.remove("active"));
	c.classList.add("active");
	State.filters.status = c.dataset.status;
	renderTourList();
});
$$("#modeTabs .filter-chip").forEach((c) => c.onclick = () => {
	$$("#modeTabs .filter-chip").forEach((x) => x.classList.remove("active"));
	c.classList.add("active");
	State.filters.mode = c.dataset.mode;
	renderTourList();
});
$("#tourSearch").oninput = (e) => {
	State.filters.search = e.target.value.trim().toLowerCase();
	renderTourList();
};
var typeDropdownBtn = $("#typeDropdownBtn");
var typeDropdownMenu = $("#typeDropdownMenu");
if (typeDropdownBtn && typeDropdownMenu) {
	typeDropdownBtn.onclick = (e) => {
		e.stopPropagation();
		typeDropdownMenu.classList.toggle("show");
	};
	document.addEventListener("click", (e) => {
		if (!typeDropdownBtn.contains(e.target) && !typeDropdownMenu.contains(e.target)) typeDropdownMenu.classList.remove("show");
	});
	$$("#typeDropdownMenu .premium-item").forEach((item) => {
		item.onclick = () => {
			$$("#typeDropdownMenu .premium-item").forEach((x) => x.classList.remove("active"));
			item.classList.add("active");
			State.filters.type = item.dataset.type;
			const label = item.textContent.replace("All Entries", "All").replace("Free Entry", "Free").replace("Paid Entry", "Paid").replace("✓", "").trim();
			$("#typeDropdownText").textContent = label;
			typeDropdownMenu.classList.remove("show");
			renderTourList();
		};
	});
}
function renderTourList() {
	const host = $("#tourList");
	let list = State.tournaments.filter((t) => {
		if (State.filters.status !== "all" && t.status !== State.filters.status) return false;
		if (State.filters.mode && t.mode !== State.filters.mode) return false;
		if (State.filters.type === "free" && Number(t.entryFee) > 0) return false;
		if (State.filters.type === "paid" && Number(t.entryFee) === 0) return false;
		if (State.filters.search) {
			if (!((t.title || "") + " " + (t.id || "")).toLowerCase().includes(State.filters.search)) return false;
		}
		return true;
	});
	if (!list.length) {
		host.innerHTML = `<div class="empty-state"><div class="es-icon"><i class="fa-solid fa-trophy"></i></div><h3>No matches found</h3></div>`;
		return;
	}
	host.innerHTML = list.map((m) => matchCardHTML(m)).join("");
	bindMatchCardClicks(host);
}
function getValidBanner(m) {
	let bannerRaw = m.bannerUrl || m.imageUrl || m.image || m.img || m.banner || m.thumbnail || "";
	bannerRaw = String(bannerRaw).trim().replace(/['"]/g, "");
	if (bannerRaw.includes("drive.google.com") && bannerRaw.includes("/file/d/")) {
		const idMatch = bannerRaw.match(/\/file\/d\/([^/]+)/);
		if (idMatch && idMatch[1]) bannerRaw = `https://drive.google.com/uc?export=view&id=${idMatch[1]}`;
	}
	if (bannerRaw && !bannerRaw.startsWith("http")) bannerRaw = "https://" + bannerRaw;
	return bannerRaw;
}
function getAllowedSlotCapacity(matchOrMode, formatSize) {
	const mode = typeof matchOrMode === "object" ? String(matchOrMode.mode || "BR").toUpperCase() : String(matchOrMode || "BR").toUpperCase();
	const size = Math.max(1, Number(typeof matchOrMode === "object" ? matchOrMode.teamSize || 1 : formatSize) || 1);
	return Math.max(1, Math.floor((mode === "CS" ? 8 : mode === "LW" ? 2 : 48) / size));
}
function getMatchSlotCapacity(match) {
	const maxAllowed = getAllowedSlotCapacity(match);
	const configured = Math.floor(Number(match && match.capacity) || maxAllowed);
	return Math.max(1, Math.min(configured, maxAllowed));
}
function matchCardHTML(m) {
	const teamSize = Number(m.teamSize || 1);
	const reg = teamSize > 1 ? Number(m.registeredSlotCount ?? Math.floor(Number(m.registeredCount || 0) / teamSize)) : Number(m.registeredCount || 0);
	const cap = getMatchSlotCapacity(m);
	const pct = cap ? Math.min(100, reg / cap * 100) : 0;
	const isFull = reg >= cap;
	const modeCls = {
		BR: "br",
		CS: "cs",
		LW: "lw"
	}[m.mode] || "neutral";
	const modeName = {
		BR: "Battle Royale",
		CS: "Clash Squad",
		LW: "Lone Wolf"
	}[m.mode] || m.mode;
	const teamLabel = teamSize === 2 ? "Duo" : teamSize === 4 ? "Squad" : "Solo";
	const bannerRaw = getValidBanner(m);
	let bannerHTML = `<div class="match-banner"><i class="fa-solid fa-image"></i></div>`;
	if (bannerRaw) bannerHTML = `<div class="match-banner"><img src="${esc(bannerRaw)}" onerror="this.parentElement.innerHTML='<i class=\\'fa-solid fa-image\\'></i>'" alt="Match Banner" style="width:100%;height:100%;object-fit:cover;"></div>`;
	const dateStr = formatMatchDateTime(m.matchDate, m.matchTime);
	return `<div class="match-card" data-match-id="${esc(m.id)}">
    ${bannerHTML}
    <div class="match-body">
      <div class="flex-between mb-2">
        <span class="badge ${modeCls}">${esc(modeName)} · ${teamLabel}</span>
        <span class="badge ${m.status}">${esc(m.status)}</span>
      </div>
      <div class="match-title">${esc(m.title || "Untitled")}</div>
      <div class="match-meta">
        <span><i class="fa-regular fa-calendar"></i> ${esc(dateStr)}</span>
        <span><i class="fa-solid fa-indian-rupee-sign"></i> ${m.entryFee > 0 ? fmtMoney(m.entryFee) : "FREE"}</span>
        ${m.perKill > 0 ? `<span><i class="fa-solid fa-crosshairs"></i> ${fmtMoney(m.perKill)}/kill</span>` : ""}
      </div>
      <div class="match-slot-row">
        <div class="slot-meta"><span>${reg} / ${cap} slots</span><span>${isFull ? "FULL" : cap - reg + " left"}</span></div>
        <div class="slot-bar"><div class="slot-fill ${isFull ? "full" : ""}" style="width:${pct}%"></div></div>
      </div>
    </div>
  </div>`;
}
function bindMatchCardClicks(root) {
	root.querySelectorAll("[data-match-id]").forEach((el) => {
		el.onclick = () => openMatchDetails(el.dataset.matchId);
	});
}
async function openMatchDetails(matchId) {
	const m = State.tournaments.find((t) => t.id === matchId);
	if (!m) {
		toast("error", "Not found", "");
		return;
	}
	const myReg = State.myRegistrations.find((r) => r.matchId === matchId && r.status === "confirmed");
	const teamSize = Number(m.teamSize || 1);
	const reg = teamSize > 1 ? Number(m.registeredSlotCount ?? Math.floor(Number(m.registeredCount || 0) / teamSize)) : Number(m.registeredCount || 0);
	const cap = getMatchSlotCapacity(m);
	const isFull = reg >= cap;
	const pct = cap ? Math.min(100, reg / cap * 100) : 0;
	const bannerRaw = getValidBanner(m);
	let bannerHTML = "";
	if (bannerRaw) bannerHTML = `<img src="${esc(bannerRaw)}" onerror="this.style.display='none'" style="width:100%;height:180px;object-fit:cover;border-radius:14px;margin-bottom:14px">`;
	const modeName = {
		BR: "Battle Royale",
		CS: "Clash Squad",
		LW: "Lone Wolf"
	}[m.mode] || m.mode;
	const teamLabel = teamSize === 2 ? "Duo (2 Players)" : teamSize === 4 ? "Squad (4 Players)" : "Solo (1 Player)";
	let myResultHTML = "";
	const res = State.matchResultsCache[matchId];
	if (res && res.entries && res.entries[State.user.uid]) {
		const e = res.entries[State.user.uid];
		let rankText = `Rank: ${e.rank || "-"}`;
		if (Number(e.rank) === 1) rankText = "🥇 Rank #1";
		else if (Number(e.rank) === 2) rankText = "🥈 Rank #2";
		else if (Number(e.rank) === 3) rankText = "🥉 Rank #3";
		if (res.status === "approved") myResultHTML = `
        <div class="alert success mt-3" style="background:var(--oks);color:var(--ok);border-color:rgba(34,197,94,.3);flex-direction:column;align-items:flex-start;gap:8px">
          <div style="font-weight:700;font-size:1rem"><i class="fa-solid fa-trophy"></i> Your Result (Approved)</div>
          <div style="display:flex;gap:16px;font-size:.9rem">
            <span>${rankText}</span>
            <span><i class="fa-solid fa-crosshairs"></i> ${e.kills || 0} kills</span>
            <span style="font-weight:700;color:var(--ok)">+${fmtMoney(e.reward || 0)}</span>
          </div>
        </div>
      `;
		else if (res.status === "pending_approval") myResultHTML = `
        <div class="alert info mt-3" style="background:var(--infs);color:var(--inf);border-color:rgba(59,130,246,.3);flex-direction:column;align-items:flex-start;gap:8px">
          <div style="font-weight:700;font-size:1rem"><i class="fa-solid fa-hourglass-half"></i> Result Pending Approval</div>
          <div style="display:flex;gap:16px;font-size:.9rem">
            <span>${rankText}</span>
            <span><i class="fa-solid fa-crosshairs"></i> ${e.kills || 0} kills</span>
            <span style="font-weight:700;color:var(--inf)">Est: ${fmtMoney(e.reward || 0)}</span>
          </div>
        </div>
      `;
	}
	let teammatesHTML = "";
	const mySlotNumber = myReg ? Number(myReg.slotIndex || (Number(myReg.teamSize || 1) === 1 ? myReg.teamSlotIndex : 0) || 0) : 0;
	const mySlotHTML = myReg && mySlotNumber ? `<div class="room-box mt-3" style="border:1px solid var(--ac2);background:var(--sf2);padding:14px 16px"><div style="display:flex;align-items:center;justify-content:space-between;gap:12px"><div style="font-weight:800;color:var(--ac2);font-size:.92rem;letter-spacing:.3px"><i class="fa-solid fa-ticket"></i> YOUR ASSIGNED SLOT</div><div style="flex:0 0 58px;height:58px;border:2px solid var(--ac2);border-radius:14px;background:var(--bg);display:flex;align-items:center;justify-content:center;color:var(--ac2);font-size:1.7rem;font-weight:900;box-shadow:0 3px 12px rgba(0,0,0,.12)">${mySlotNumber}</div></div><div style="font-size:.8rem;color:var(--txm);margin-top:10px;line-height:1.55">Enter the game room using this exact slot number. Your whole Duo/Squad team shares this same slot. Playing in another slot may make you ineligible for prizes or rewards.</div></div>` : "";
	if (myReg && myReg.teamId) {
		const teamMates = State.myRegistrations.filter((r) => r.matchId === matchId && r.teamId === myReg.teamId);
		if (teamMates.length > 1) teammatesHTML = `<div class="room-box mt-3"><div style="font-size:.75rem;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:var(--ac2);margin-bottom:8px"><i class="fa-solid fa-users"></i> Your Team</div>${teamMates.map((tm, i) => `<div class="room-row"><span class="rk">${esc(tm.teamMemberIndex ? "Member " + tm.teamMemberIndex : "Player")}</span><span class="rv" style="color:var(--tx)">${esc(tm.userName)}</span></div>`).join("")}</div>`;
	}
	let roomHTML = "";
	if (m.status === "ongoing" && myReg) try {
		const snap = await get(ref(db, "privateRoomCredentials/" + matchId));
		let rData = null;
		if (snap.exists()) rData = snap.val();
		else if (m.roomId || m.roomPass) rData = {
			roomId: m.roomId,
			roomPass: m.roomPass
		};
		if (rData && (rData.roomId || rData.roomPass)) roomHTML = `<div class="room-box mt-3" style="border-color:var(--ok); background:linear-gradient(135deg, rgba(34,197,94,.1), transparent);">
          <div style="font-size:.75rem;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:var(--ok);margin-bottom:8px"><i class="fa-solid fa-key"></i> Room Credentials (Live)</div>
          <div class="room-row"><span class="rk">Room ID</span><span class="rv">${esc(rData.roomId || "—")} <button type="button" class="copy-btn" data-copy="${esc(rData.roomId || "")}">Copy</button></span></div>
          <div class="room-row"><span class="rk">Password</span><span class="rv">${esc(rData.roomPass || "—")} <button type="button" class="copy-btn" data-copy="${esc(rData.roomPass || "")}">Copy</button></span></div>
          <div style="font-size:0.7rem; color:var(--txm); margin-top:8px; text-align:center;"><i class="fa-solid fa-circle-info"></i> Join the room before the timer ends!</div>
        </div>`;
		else roomHTML = `<div class="alert warning mt-3" style="background:var(--wns);color:var(--wn);border-color:var(--wn)"><i class="fa-solid fa-triangle-exclamation"></i><span>Room ID & Password are not set yet. Admin will add them shortly.</span></div>`;
	} catch (e) {
		roomHTML = `<div class="alert info mt-3"><i class="fa-solid fa-lock"></i><span>Credentials available to confirmed participants only.</span></div>`;
	}
	else if (m.status === "upcoming" && myReg) roomHTML = `<div class="alert info mt-3"><i class="fa-solid fa-lock"></i><span>Room credentials will be revealed automatically when the match starts (Ongoing).</span></div>`;
	let footerHTML = `<button class="btn btn-ghost w-100" data-x="close">Close</button>`;
	if (m.status === "upcoming") {
		if (myReg) footerHTML = `<button class="btn btn-success w-100" disabled><i class="fa-solid fa-check"></i> Already Joined</button>`;
		else if (isFull) footerHTML = `<button class="btn btn-outline w-100" disabled><i class="fa-solid fa-ban"></i> Match Full</button>`;
		else footerHTML = `<button class="btn btn-primary w-100" data-x="join"><i class="fa-solid fa-right-to-bracket"></i> ${teamSize > 1 ? "Join as Team" : "Join Match"}</button>`;
	} else if (m.status === "ongoing") footerHTML = `<button class="btn btn-outline w-100" disabled><i class="fa-solid fa-play"></i> Match in Progress</button>`;
	else if (m.status === "completed") footerHTML = `<button class="btn btn-outline w-100" disabled><i class="fa-solid fa-flag-checkered"></i> Completed</button>`;
	else if (m.status === "cancelled" || m.status === "canceled") footerHTML = `<button class="btn btn-danger w-100" disabled><i class="fa-solid fa-ban"></i> Cancelled</button>`;
	openModal({
		title: "Match Details",
		bodyHTML: `
      ${bannerHTML}
      <h2 style="font-size:1.15rem;margin-bottom:8px">${esc(m.title || "")}</h2>
      <div class="flex gap-2 mb-3"><span class="badge ${m.mode === "BR" ? "br" : m.mode === "CS" ? "cs" : "lw"}">${esc(modeName)}</span><span class="badge neutral">${esc(teamLabel)}</span><span class="badge ${m.status}">${esc(m.status)}</span></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px">
        <div><div style="font-size:.7rem;color:var(--txm);text-transform:uppercase;letter-spacing:.8px">Date</div><div style="font-weight:500">${esc(m.matchDate || "—")}</div></div>
        <div><div style="font-size:.7rem;color:var(--txm);text-transform:uppercase;letter-spacing:.8px">Time</div><div style="font-weight:500">${esc(formatTime12h(m.matchTime) || "—")}</div></div>
        <div><div style="font-size:.7rem;color:var(--txm);text-transform:uppercase;letter-spacing:.8px">Entry Fee</div><div style="font-weight:500">${m.entryFee > 0 ? fmtMoney(m.entryFee) : "FREE"}</div></div>
        <div><div style="font-size:.7rem;color:var(--txm);text-transform:uppercase;letter-spacing:.8px">Per Kill</div><div style="font-weight:500">${fmtMoney(m.perKill || 0)}</div></div>
        <div><div style="font-size:.7rem;color:var(--txm);text-transform:uppercase;letter-spacing:.8px">Prize Pool</div><div style="font-weight:500">${fmtMoney(m.prizePool || 0)}</div></div>
        <div><div style="font-size:.7rem;color:var(--txm);text-transform:uppercase;letter-spacing:.8px">Slots</div><div style="font-weight:500">${reg} / ${cap}</div></div>
      </div>
      <div class="slot-bar"><div class="slot-fill ${isFull ? "full" : ""}" style="width:${pct}%"></div></div>
      <div class="slot-meta"><span>${isFull ? "FULL" : cap - reg + " slots left"}</span><span>${pct.toFixed(0)}%</span></div>
      ${myResultHTML}
      ${mySlotHTML}
      ${teammatesHTML}
      ${m.description ? `<hr class="divider"><h4 style="font-size:.88rem">Description</h4><p style="font-size:.84rem">${esc(m.description)}</p>` : ""}
      ${m.rules ? `<hr class="divider"><h4 style="font-size:.88rem">Rules</h4><p style="font-size:.84rem;white-space:pre-wrap">${esc(m.rules)}</p>` : ""}
      ${roomHTML}
    `,
		footerHTML,
		onMount: (el, close) => {
			el.querySelectorAll("[data-copy]").forEach((b) => {
				b.type = "button";
				b.onclick = async (e) => {
					e.preventDefault();
					e.stopPropagation();
					await copyTextToClipboard(b.dataset.copy);
				};
			});
			const cb = el.querySelector("[data-x=\"close\"]");
			if (cb) cb.onclick = close;
			const jb = el.querySelector("[data-x=\"join\"]");
			if (jb) jb.onclick = () => {
				close();
				handleJoin(matchId);
			};
		}
	});
}
async function ensureRoomCredentials(matchId, m) {
	try {
		if (!(await get(ref(db, "privateRoomCredentials/" + matchId))).exists() && (m.roomId || m.roomPass)) await set(ref(db, "privateRoomCredentials/" + matchId), {
			roomId: m.roomId || "",
			roomPass: m.roomPass || "",
			createdAt: Date.now()
		});
	} catch (e) {
		console.warn("Failed to sync credentials", e);
	}
}
async function handleJoin(matchId) {
	if (!State.user) return;
	const m = State.tournaments.find((t) => t.id === matchId);
	if (!m) return;
	const teamSize = Number(m.teamSize || 1);
	if (teamSize > 1) return handleTeamJoin(matchId, m, teamSize);
	const balance = Number(State.wallet.balance || 0);
	const fee = Number(m.entryFee || 0);
	if (fee > 0 && balance < fee) {
		toast("warning", "Insufficient Balance", "");
		openAddBalance();
		return;
	}
	if (!await new Promise((resolve) => {
		openModal({
			title: "Confirm Join",
			bodyHTML: `
        <div style="text-align:center;margin-bottom:14px"><i class="fa-solid fa-trophy" style="font-size:2.5rem;color:var(--ac2)"></i></div>
        <div style="display:flex;flex-direction:column;gap:8px">
          <div class="room-row"><span class="rk">Match</span><span style="font-weight:600">${esc(m.title || "")}</span></div>
          <div class="room-row"><span class="rk">Entry Fee</span><span style="font-weight:600">${fee > 0 ? fmtMoney(fee) : "FREE"}</span></div>
          <div class="room-row"><span class="rk">Your Balance</span><span style="font-weight:600">${fmtMoney(balance)}</span></div>
          <div class="room-row"><span class="rk">After Joining</span><span style="font-weight:600;color:var(--ok)">${fmtMoney(balance - fee)}</span></div>
        </div>
      `,
			footerHTML: `<button class="btn btn-ghost" data-x="c">Cancel</button><button class="btn btn-primary" data-x="ok"><i class="fa-solid fa-check"></i> Confirm & Join</button>`,
			onMount: (el, close) => {
				el.querySelector("[data-x=\"c\"]").onclick = () => {
					close();
					resolve(false);
				};
				el.querySelector("[data-x=\"ok\"]").onclick = () => {
					close();
					resolve(true);
				};
			}
		});
	})) return;
	await executeJoin(matchId, m, fee);
}
async function executeJoin(matchId, m, fee) {
	const uid = State.user.uid;
	const operationId = "join_" + matchId + "_" + uid + "_" + Date.now();
	const regRef = push(ref(db, "registrations"));
	const regId = regRef.key;
	try {
		if (!(await runTransaction(ref(db, "tournaments/" + matchId + "/registeredCount"), (cur) => {
			const curr = Number(cur) || 0;
			if (curr >= getMatchSlotCapacity(m)) return;
			return curr + 1;
		})).committed) {
			toast("error", "Match Full", "");
			return;
		}
		if (fee > 0) {
			State.localWalletActionTs = Date.now();
			if (!(await runTransaction(ref(db, "wallets/" + uid + "/balance"), (cur) => {
				const curr = Number(cur) || 0;
				if (curr < fee) return;
				return curr - fee;
			})).committed) {
				await runTransaction(ref(db, "tournaments/" + matchId + "/registeredCount"), (cur) => Math.max(0, (Number(cur) || 0) - 1));
				toast("error", "Insufficient Balance", "");
				openAddBalance();
				return;
			}
		}
		const slotResult = await runTransaction(ref(db, "tournaments/" + matchId + "/registeredSlotCount"), (cur) => {
			const next = (Number(cur) || 0) + 1;
			if (next > getMatchSlotCapacity(m)) return;
			return next;
		});
		if (!slotResult.committed) {
			await runTransaction(ref(db, "tournaments/" + matchId + "/registeredCount"), (cur) => Math.max(0, (Number(cur) || 0) - 1));
			if (fee > 0) await runTransaction(ref(db, "wallets/" + uid + "/balance"), (cur) => (Number(cur) || 0) + fee);
			toast("error", "No Slot Available", "All match slots are already assigned.");
			return;
		}
		const assignedSlot = Number(slotResult.snapshot.val());
		await set(regRef, {
			id: regId,
			matchId,
			matchTitle: m.title || "",
			matchMode: m.mode || "",
			userId: uid,
			userName: State.profile?.displayName || "Player",
			userFfUid: State.profile?.freeFireUid || "",
			entryFee: fee,
			paidBy: uid,
			payerId: uid,
			joinedBy: uid,
			teamMemberUids: [uid],
			teamSize: 1,
			slotIndex: assignedSlot,
			teamSlotIndex: assignedSlot,
			isEntryPayer: true,
			status: "confirmed",
			operationId,
			createdAt: Date.now()
		});
		if (fee > 0) {
			const txRef = push(ref(db, "walletTransactions"));
			await set(txRef, {
				id: txRef.key,
				userId: uid,
				type: "entry_fee",
				amount: -fee,
				currency: "INR",
				relatedId: matchId,
				relatedRegId: regId,
				status: "completed",
				idempotencyKey: operationId,
				createdAt: Date.now()
			});
		}
		await set(ref(db, "userRegistrations/" + uid + "/" + matchId), {
			regId,
			status: "confirmed",
			matchTitle: m.title || "",
			createdAt: Date.now()
		});
		await ensureRoomCredentials(matchId, m);
		const notifRef = push(ref(db, "notifications/" + uid));
		await set(notifRef, {
			id: notifRef.key,
			type: "registration",
			title: "Registration Confirmed",
			body: `You joined "${m.title}"`,
			matchId,
			read: false,
			createdAt: Date.now()
		});
		toast("success", "Joined!", fee > 0 ? `${fmtMoney(fee)} deducted.` : "Entry confirmed.");
		navigate("mymatches");
	} catch (e) {
		toast("error", "Join Failed", e.message || "");
	}
}
async function handleTeamJoin(matchId, m, teamSize) {
	const uid = State.user.uid;
	let teamId, team;
	try {
		const utSnap = await get(ref(db, "userTeams/" + uid));
		if (!utSnap.exists()) {
			openModal({
				title: "Team Required",
				bodyHTML: `<div style="text-align:center;padding:16px 0"><i class="fa-solid fa-users" style="font-size:3rem;color:var(--ac2);margin-bottom:14px"></i><h3>You need a team</h3><p style="font-size:.9rem">${teamSize === 4 ? "Squad" : "Duo"} matches require a team. Create or join a team to continue.</p></div>`,
				footerHTML: `<button class="btn btn-primary w-100" id="gotoTeamBtn"><i class="fa-solid fa-users"></i> Go to My Team</button>`,
				onMount: (el, close) => {
					el.querySelector("#gotoTeamBtn").onclick = () => {
						close();
						navigate("mymatches");
						setTimeout(() => switchMyTab("team"), 200);
					};
				}
			});
			return;
		}
		teamId = utSnap.val().teamId;
		const teamSnap = await get(ref(db, "teams/" + teamId));
		if (!teamSnap.exists()) {
			toast("error", "Team not found", "");
			return;
		}
		team = teamSnap.val();
	} catch (e) {
		toast("error", "Error", e.message);
		return;
	}
	const members = Object.values(team.members || {});
	if (!(Number(team.maintenanceExpiry || 0) > Date.now())) {
		openModal({
			title: "Maintenance Pass Required",
			bodyHTML: `<div style="text-align:center;padding:16px 0"><i class="fa-solid fa-lock" style="font-size:3rem;color:var(--wn);margin-bottom:14px"></i><h3>Team Locked</h3><p style="font-size:.9rem">Your team's ₹5 Monthly Maintenance Pass is not active. Purchase or extend it to unlock Duo & Squad matches.</p></div>`,
			footerHTML: `<button class="btn btn-primary w-100" id="buyPassBtn"><i class="fa-solid fa-crown"></i> Buy ₹5 Pass</button>`,
			onMount: (el, close) => {
				el.querySelector("#buyPassBtn").onclick = () => {
					close();
					setTimeout(() => buyTeamMaintenancePass(teamId), 200);
				};
			}
		});
		return;
	}
	if (members.length < teamSize) {
		toast("error", "Not Enough Members", `Your team needs ${teamSize} members to join this match (currently ${members.length}).`);
		return;
	}
	let selectedTeammates = [];
	if (teamSize === 4) selectedTeammates = members.filter((mem) => mem.uid !== uid).slice(0, 3);
	else if (teamSize === 2) {
		const pick = await showTeammatePicker(members.filter((mem) => mem.uid !== uid));
		if (!pick) return;
		selectedTeammates = [pick];
	}
	const fee = Number(m.entryFee || 0);
	const balance = Number(State.wallet.balance || 0);
	const allPlayers = [{
		uid,
		name: State.profile?.displayName || "Player",
		ffUid: State.profile?.freeFireUid || ""
	}, ...selectedTeammates.map((t) => ({
		uid: t.uid,
		name: t.name || "Player",
		ffUid: t.ffUid || ""
	}))];
	if (fee > 0 && balance < fee) {
		toast("warning", "Insufficient Balance", "");
		openAddBalance();
		return;
	}
	if (!await new Promise((resolve) => {
		openModal({
			title: "Confirm Team Join",
			bodyHTML: `
        <div style="text-align:center;margin-bottom:14px"><i class="fa-solid fa-users" style="font-size:2.5rem;color:var(--ac2)"></i></div>
        <div class="room-box mb-3">
          <div class="room-row"><span class="rk">Match</span><span style="font-weight:600">${esc(m.title || "")}</span></div>
          <div class="room-row"><span class="rk">Team Size</span><span style="font-weight:600">${allPlayers.length} Players</span></div>
          <div class="room-row"><span class="rk">Entry Fee</span><span style="font-weight:600">${fee > 0 ? fmtMoney(fee) : "FREE"}</span></div>
        </div>
        <div style="font-size:.75rem;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:var(--txm);margin-bottom:8px">Players</div>
        ${allPlayers.map((p, i) => `<div class="member-row"><div class="member-avatar">${esc((p.name || "P").charAt(0).toUpperCase())}</div><div style="flex:1"><b style="font-size:.9rem">${esc(p.name)}</b><small style="display:block;font-size:.72rem;color:var(--txm)">Slot ${i + 1}${i === 0 ? " · Leader" : ""}</small></div></div>`).join("")}
        <div class="alert info mt-3" style="margin-bottom:0"><i class="fa-solid fa-info-circle"></i><span>Entry fee is deducted from <b>your wallet</b>. All ${allPlayers.length} players will be registered.</span></div>
      `,
			footerHTML: `<button class="btn btn-ghost" data-x="c">Cancel</button><button class="btn btn-primary" data-x="ok"><i class="fa-solid fa-check"></i> Confirm & Join</button>`,
			onMount: (el, close) => {
				el.querySelector("[data-x=\"c\"]").onclick = () => {
					close();
					resolve(false);
				};
				el.querySelector("[data-x=\"ok\"]").onclick = () => {
					close();
					resolve(true);
				};
			}
		});
	})) return;
	await executeTeamJoin(matchId, m, teamSize, teamId, team, allPlayers, fee);
}
function showTeammatePicker(candidates) {
	return new Promise((resolve) => {
		if (!candidates.length) {
			resolve(null);
			return;
		}
		openModal({
			title: "Select Teammate",
			bodyHTML: `<div style="display:flex;flex-direction:column;gap:6px">${candidates.map((c) => `<div class="member-row" data-pick="${esc(c.uid)}" style="cursor:pointer;padding:12px;background:var(--sf2);border-radius:var(--rm);border:1px solid var(--bd);margin-bottom:4px"><div class="member-avatar">${esc((c.name || "P").charAt(0).toUpperCase())}</div><div style="flex:1"><b style="font-size:.9rem">${esc(c.name || "Player")}</b>${c.ffUid ? `<small style="display:block;font-size:.72rem;color:var(--txm)">UID: ${esc(c.ffUid)}</small>` : ""}</div><i class="fa-solid fa-circle-check" style="color:var(--ac2)"></i></div>`).join("")}</div>`,
			footerHTML: `<button class="btn btn-ghost w-100" data-x="c">Cancel</button>`,
			onMount: (el, close) => {
				el.querySelector("[data-x=\"c\"]").onclick = () => {
					close();
					resolve(null);
				};
				el.querySelectorAll("[data-pick]").forEach((item) => {
					item.onclick = () => {
						const pickedUid = item.dataset.pick;
						const picked = candidates.find((c) => c.uid === pickedUid);
						close();
						resolve(picked || null);
					};
				});
			}
		});
	});
}
async function executeTeamJoin(matchId, m, teamSize, teamId, team, allPlayers, fee) {
	const uid = State.user.uid;
	const operationId = "teamjoin_" + matchId + "_" + uid + "_" + Date.now();
	try {
		const slotCapacity = getMatchSlotCapacity(m);
		const slotResult = await runTransaction(ref(db, "tournaments/" + matchId + "/registeredSlotCount"), (cur) => {
			const next = (Number(cur) || 0) + 1;
			if (next > slotCapacity) return;
			return next;
		});
		if (!slotResult.committed) {
			toast("error", "Match Full", "All team slots are already assigned.");
			return;
		}
		const assignedTeamSlot = Number(slotResult.snapshot.val());
		if (fee > 0) {
			State.localWalletActionTs = Date.now();
			if (!(await runTransaction(ref(db, "wallets/" + uid + "/balance"), (cur) => {
				const curr = Number(cur) || 0;
				if (curr < fee) return;
				return curr - fee;
			})).committed) {
				await runTransaction(ref(db, "tournaments/" + matchId + "/registeredSlotCount"), (cur) => Math.max(0, (Number(cur) || 0) - 1));
				toast("error", "Insufficient Balance", "");
				openAddBalance();
				return;
			}
		}
		await runTransaction(ref(db, "tournaments/" + matchId + "/registeredCount"), (cur) => (Number(cur) || 0) + teamSize);
		const regIds = [];
		for (let i = 0; i < allPlayers.length; i++) {
			const p = allPlayers[i];
			const regRef = push(ref(db, "registrations"));
			regIds.push(regRef.key);
			const regData = {
				id: regRef.key,
				matchId,
				matchTitle: m.title || "",
				matchMode: m.mode || "",
				teamId,
				teamName: team.name || "",
				teamSize,
				userId: p.uid,
				userName: p.name,
				userFfUid: p.ffUid || "",
				entryFee: i === 0 ? fee : 0,
				paidBy: uid,
				payerId: uid,
				joinedBy: uid,
				teamLeaderId: team.leaderId || null,
				teamMemberUids: allPlayers.map((player) => player.uid),
				teamSlotIndex: assignedTeamSlot,
				slotIndex: assignedTeamSlot,
				teamMemberIndex: i + 1,
				isEntryPayer: p.uid === uid,
				status: "confirmed",
				operationId,
				createdAt: Date.now()
			};
			await set(regRef, regData);
			await set(ref(db, "userRegistrations/" + p.uid + "/" + matchId), {
				regId: regRef.key,
				status: "confirmed",
				matchTitle: m.title || "",
				teamId,
				createdAt: Date.now()
			});
			if (p.uid !== uid) {
				const notifRef = push(ref(db, "notifications/" + p.uid));
				await set(notifRef, {
					id: notifRef.key,
					type: "registration",
					title: "Team Registration",
					body: `Your team "${team.name}" registered you for "${m.title}".`,
					matchId,
					read: false,
					createdAt: Date.now()
				});
			}
		}
		if (fee > 0) {
			const txRef = push(ref(db, "walletTransactions"));
			await set(txRef, {
				id: txRef.key,
				userId: uid,
				type: "entry_fee",
				amount: -fee,
				currency: "INR",
				relatedId: matchId,
				status: "completed",
				idempotencyKey: operationId,
				createdAt: Date.now()
			});
		}
		await ensureRoomCredentials(matchId, m);
		const notifRef = push(ref(db, "notifications/" + uid));
		await set(notifRef, {
			id: notifRef.key,
			type: "registration",
			title: "Team Joined Match",
			body: `Your team joined "${m.title}" with ${allPlayers.length} players.`,
			matchId,
			read: false,
			createdAt: Date.now()
		});
		toast("success", "Team Registered!", `${allPlayers.length} players joined.`);
		navigate("mymatches");
	} catch (e) {
		toast("error", "Join Failed", e.message || "");
	}
}
async function loadMyTeam() {
	const uid = State.user.uid;
	try {
		const utSnap = await get(ref(db, "userTeams/" + uid));
		if (utSnap.exists()) {
			const { teamId, role } = utSnap.val();
			const teamSnap = await get(ref(db, "teams/" + teamId));
			if (teamSnap.exists()) {
				State.myTeam = {
					...teamSnap.val(),
					teamId
				};
				State.teamRole = role;
				const memberIds = Object.keys(State.myTeam.members || {});
				await Promise.all(memberIds.map(async (memberUid) => {
					try {
						const profileSnap = await get(ref(db, "publicProfiles/" + memberUid));
						const profile = profileSnap.exists() ? profileSnap.val() : {};
						const current = State.myTeam.members[memberUid] || {};
						State.myTeam.members[memberUid] = {
							...current,
							uid: memberUid,
							name: profile.displayName || current.name || "Player",
							photoUrl: profile.photoUrl || current.photoUrl || "",
							profileEmoji: profile.profileEmoji || current.profileEmoji || "",
							ffUid: profile.freeFireUid || current.ffUid || ""
						};
					} catch (_) {}
				}));
				const walletSnap = await get(ref(db, "teamWallets/" + teamId));
				State.teamWalletData = walletSnap.exists() ? walletSnap.val() : {
					balance: 0,
					transactions: {},
					matchHistory: {}
				};
			} else {
				State.myTeam = null;
				State.teamRole = null;
				State.teamWalletData = null;
			}
		} else {
			State.myTeam = null;
			State.teamRole = null;
			State.teamWalletData = null;
		}
		const invSnap = await get(ref(db, "teamInvites/" + uid));
		const invites = [];
		invSnap.forEach((c) => {
			const v = c.val();
			if (isObj(v) && v.status === "pending") {
				v.id = c.key;
				invites.push(v);
			}
		});
		State.myTeamInvites = invites;
	} catch (e) {
		console.warn("loadMyTeam", e);
	}
	renderMyTeam();
}
function renderMyTeam() {
	const host = $("#myTeamContent");
	if (!host) return;
	const team = State.myTeam;
	const role = State.teamRole;
	const invites = State.myTeamInvites || [];
	let html = "";
	if (invites.length && !team) {
		html += `<div class="card mb-3" style="border-left:4px solid var(--ac)"><div class="card-head"><h3><i class="fa-solid fa-envelope" style="color:var(--ac2)"></i> Team Invites (${invites.length})</h3></div>`;
		invites.forEach((inv) => {
			html += `<div class="member-row" style="padding:10px 0;border-bottom:1px solid var(--bd)">
        <div class="member-avatar">${esc((inv.teamName || "T").charAt(0).toUpperCase())}</div>
        <div style="flex:1"><b style="font-size:.9rem">${esc(inv.teamName || "Team")}</b><small style="display:block;font-size:.72rem;color:var(--txm)">Invited by ${esc(inv.fromName || "Leader")}</small></div>
        <div class="flex gap-2">
          <button class="btn btn-sm btn-outline" data-decline="${esc(inv.id)}">Decline</button>
          <button class="btn btn-sm btn-primary" data-accept="${esc(inv.id)}">Accept</button>
        </div>
      </div>`;
		});
		html += `</div>`;
	}
	if (!team) {
		html += `<div class="card mb-3">
      <div class="card-head"><h3><i class="fa-solid fa-users" style="color:var(--ac2)"></i> Create Your Team</h3></div>
      <p style="font-size:.85rem">Create a free squad of up to 4 players. Get a <b>7-Day Free Trial</b> on your first team! After trial, a ₹5/month pass is required for Duo & Squad tournaments.</p>
      <div class="field"><label>Team Name <span class="req">*</span></label><input type="text" id="newTeamName" class="input" placeholder="e.g. Punjab Warriors" maxlength="30"></div>
      <button class="btn btn-primary btn-block" id="createTeamBtn"><i class="fa-solid fa-plus"></i> Create Team (Free)</button>
    </div>`;
		host.innerHTML = html;
		const createBtn = host.querySelector("#createTeamBtn");
		if (createBtn) createBtn.onclick = () => {
			const name = host.querySelector("#newTeamName").value.trim();
			if (name.length < 2) {
				toast("warning", "Name Too Short", "");
				return;
			}
			createTeam(name);
		};
		host.querySelectorAll("[data-accept]").forEach((b) => b.onclick = () => acceptTeamInvite(b.dataset.accept));
		host.querySelectorAll("[data-decline]").forEach((b) => b.onclick = () => declineTeamInvite(b.dataset.decline));
		return;
	}
	const members = Object.values(team.members || {});
	const passExpiry = Number(team.maintenanceExpiry || 0);
	const passActive = passExpiry > Date.now();
	const daysLeft = passActive ? Math.ceil((passExpiry - Date.now()) / 864e5) : 0;
	const isLeader = role === "leader";
	const logoHTML = team.logo && team.logo.startsWith("data:image") ? `<img src="${team.logo}" alt="logo">` : esc((team.name || "T").charAt(0).toUpperCase());
	html += `<div class="card mb-3">
    <div style="display:flex;align-items:center;gap:14px;margin-bottom:14px">
      <div class="team-logo">${logoHTML}</div>
      <div style="flex:1;min-width:0">
        <div style="font-size:1.15rem;font-weight:700;word-break:break-word">${esc(team.name || "Team")}</div>
        <div style="font-size:.75rem;color:var(--txm);margin-top:2px">${isLeader ? "<i class=\"fa-solid fa-crown\" style=\"color:#fbbf24\"></i> You are Leader" : "<i class=\"fa-solid fa-user\"></i> Member"} · ${members.length}/${TEAM_MAX_MEMBERS} Players</div>
        ${team.isTrial && passActive ? "<span class=\"badge approved mt-2\" style=\"font-size:.6rem;padding:2px 6px;\">7-Day Free Trial Active</span>" : ""}
      </div>
      ${isLeader ? `<button class="icon-btn" id="editTeamBtn" style="width:36px;height:36px;font-size:.85rem"><i class="fa-solid fa-pen"></i></button>` : ""}
    </div>
    <div class="room-box" style="margin-top:0">
      <div class="room-row"><span class="rk">Maintenance Pass</span><span class="rv" style="font-family:inherit;letter-spacing:normal;color:${passActive ? "var(--ok)" : "var(--er)"}">${passActive ? `✓ Active · ${daysLeft} Day${daysLeft > 1 ? "s" : ""} Remaining` : "✗ Locked · Pass Expired"}</span></div>
      <div class="room-row"><span class="rk">Team ID</span><span class="rv" style="font-size:.75rem">${esc(team.teamId || "")}</span></div>
    </div>
    ${passActive ? "" : "<div class=\"alert warning mt-3\" style=\"margin-bottom:0\"><i class=\"fa-solid fa-lock\"></i><span>Duo & Squad matches are locked. Purchase the ₹5 monthly pass to unlock.</span></div>"}
  </div>`;
	const tw = State.teamWalletData || {};
	const teamBalance = Math.max(0, Number(tw.balance || tw.availableBalance || 0));
	const allTeamTx = Object.entries(tw.transactions || {}).map(([id, tx]) => ({
		id,
		...tx || {}
	})).sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0));
	const teamHistory = tw.matchHistory || {};
	const duoHistory = Object.entries(teamHistory.duo || {}).map(([id, x]) => ({
		id,
		...x || {}
	})).sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0)).slice(0, 3);
	const squadHistory = Object.entries(teamHistory.squad || {}).map(([id, x]) => ({
		id,
		...x || {}
	})).sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0)).slice(0, 3);
	const txLabel = (tx) => tx.type === "match_earning" ? "Match earning" : tx.type === "leader_transfer" ? tx.fromUid === State.user.uid ? "Sent by you" : `Transfer to ${tx.toName || "member"}` : tx.description || "Team wallet transaction";
	html += `<div class="card mb-3" id="teamWalletCard">
    <div class="flex-between" style="align-items:flex-start"><div><div style="font-size:.8rem;color:var(--txm)"><i class="fa-solid fa-wallet"></i> TEAM WALLET</div><div style="font-size:1.8rem;font-weight:800;color:var(--ok);margin-top:4px">${fmtMoney(teamBalance)}</div><small style="color:var(--txm)">Live shared team balance · visible to all members</small></div><span class="badge approved">${isLeader ? "Leader access" : "View only"}</span></div>
    ${isLeader ? `<button class="btn btn-primary btn-block mt-3" id="teamSendMoneyBtn"><i class="fa-solid fa-paper-plane"></i> Send Money</button>` : `<p class="mt-3" style="font-size:.78rem;margin-bottom:0">Only the Team Leader can transfer money.</p>`}
    <div class="mt-3" style="border-top:1px solid var(--bd);padding-top:12px"><b style="font-size:.88rem">Recent Match Earnings</b><div class="grid grid-2 mt-2" style="display:grid;grid-template-columns:1fr 1fr;gap:10px"><div class="room-box"><b>Duo</b><div style="font-size:1.1rem;color:var(--ok);font-weight:700">${fmtMoney(duoHistory.reduce((n, x) => n + Number(x.totalEarnings ?? x.amount ?? 0), 0))}</div><small>Latest 3 matches</small></div><div class="room-box"><b>Squad</b><div style="font-size:1.1rem;color:var(--ok);font-weight:700">${fmtMoney(squadHistory.reduce((n, x) => n + Number(x.totalEarnings ?? x.amount ?? 0), 0))}</div><small>Latest 3 matches</small></div></div></div>
  </div>`;
	const renderTeamMatchHistory = (items, label) => `<div class="card mb-3"><div class="card-head"><h3><i class="fa-solid fa-trophy" style="color:var(--ac2)"></i> ${label} Match History <small style="color:var(--txm);font-size:.68rem">(Latest 3)</small></h3></div>${items.length ? items.map((x) => `<div class="member-row" style="display:block"><div class="flex-between"><b>${esc(x.matchTitle || x.title || label + " Match")}</b><strong style="color:var(--ok)">${fmtMoney(x.totalEarnings ?? x.amount ?? 0)}</strong></div><small style="display:block;color:var(--txm)">${fmtDateTime(x.createdAt || x.playedAt)}</small><small style="display:block;margin-top:4px">Players: ${esc((Array.isArray(x.players) ? x.players.map((p) => typeof p === "string" ? p : p.name || p.uid) : []).join(", ") || x.playerNames || "Details unavailable")}</small></div>`).join("") : `<div class="empty-state" style="padding:14px"><p>No ${label} match history yet.</p></div>`}</div>`;
	html += renderTeamMatchHistory(duoHistory, "Duo");
	html += renderTeamMatchHistory(squadHistory, "Squad");
	html += `<div class="card mb-3"><div class="card-head"><h3><i class="fa-solid fa-receipt" style="color:var(--ac2)"></i> Team Wallet Transactions</h3><small style="color:var(--txm)">Full history</small></div>${allTeamTx.length ? allTeamTx.map((tx) => `<div class="member-row"><div style="flex:1;min-width:0"><b style="font-size:.84rem">${esc(txLabel(tx))}</b><small style="display:block;color:var(--txm)">${fmtDateTime(tx.createdAt)}${tx.fromName ? " · From " + esc(tx.fromName) : ""}${tx.toName ? " · To " + esc(tx.toName) : ""}</small>${tx.note ? `<small style="display:block;color:var(--txm)">${esc(tx.note)}</small>` : ""}</div><b style="color:${Number(tx.amount || 0) >= 0 ? "var(--ok)" : "var(--er)"}">${Number(tx.amount || 0) >= 0 ? "+" : ""}${fmtMoney(tx.amount || 0)}</b></div>`).join("") : `<div class="empty-state" style="padding:14px"><p>No team wallet transactions yet.</p></div>`}</div>`;
	html += `<div class="card mb-3">
    <div class="card-head"><h3><i class="fa-solid fa-users" style="color:var(--ac2)"></i> Members</h3>
    ${isLeader && members.length < TEAM_MAX_MEMBERS ? `<button class="btn btn-sm btn-primary" id="inviteMemberBtn"><i class="fa-solid fa-user-plus"></i> Invite</button>` : ""}
    </div>`;
	members.forEach((mem) => {
		const isTeamLeader = mem.uid === team.leaderId;
		const avatarHtml = getAvatarHTML(mem.photoUrl, mem.profileEmoji, mem.name);
		html += `<div class="member-row">
      <div class="member-avatar">${avatarHtml}</div>
      <div style="flex:1;min-width:0">
        <b style="font-size:.9rem;display:block">${esc(mem.name || "Player")} ${isTeamLeader ? "<span style=\"font-size:.65rem;color:#fbbf24;background:rgba(251,191,36,.15);padding:1px 6px;border-radius:6px;margin-left:4px\">LEADER</span>" : ""}</b>
        ${mem.ffUid ? `<small style="display:block;font-size:.72rem;color:var(--txm)">UID: ${esc(mem.ffUid)}</small>` : ""}
      </div>
      ${isLeader && !isTeamLeader ? `<div style="display:flex;gap:6px"><button class="btn btn-sm btn-outline" data-make-leader="${esc(mem.uid)}" title="Make Leader"><i class="fa-solid fa-crown"></i></button><button class="btn btn-sm" style="background:var(--ers);color:var(--er);padding:6px 10px" data-kick="${esc(mem.uid)}" title="Remove Member"><i class="fa-solid fa-user-minus"></i></button></div>` : ""}
    </div>`;
	});
	html += `</div>`;
	html += `<div class="card mb-3">
    <div style="display:flex;flex-direction:column;gap:10px">
      <button class="btn btn-primary btn-block" id="buyPassBtn2"><i class="fa-solid fa-crown"></i> ${passActive ? "Extend Pass (+30 Days)" : "Buy Maintenance Pass (₹5)"}</button>
      ${isLeader ? `<button class="btn btn-outline btn-block" id="disbandTeamBtn" style="color:var(--er);border-color:var(--er)"><i class="fa-solid fa-trash"></i> Disband Team</button>` : `<button class="btn btn-outline btn-block" id="leaveTeamBtn" style="color:var(--er);border-color:var(--er)"><i class="fa-solid fa-right-from-bracket"></i> Leave Team</button>`}
    </div>
  </div>`;
	host.innerHTML = html;
	host.querySelectorAll("[data-kick]").forEach((b) => b.onclick = () => kickTeamMember(b.dataset.kick));
	host.querySelectorAll("[data-make-leader]").forEach((b) => b.onclick = () => transferTeamLeadership(b.dataset.makeLeader));
	const editBtn = host.querySelector("#editTeamBtn");
	if (editBtn) editBtn.onclick = () => editTeamInfo();
	const inviteBtn = host.querySelector("#inviteMemberBtn");
	if (inviteBtn) inviteBtn.onclick = () => openTeamInviteModal();
	const sendMoneyBtn = host.querySelector("#teamSendMoneyBtn");
	if (sendMoneyBtn) sendMoneyBtn.onclick = () => openTeamWalletTransferModal();
	const passBtn = host.querySelector("#buyPassBtn2");
	if (passBtn) passBtn.onclick = () => buyTeamMaintenancePass(team.teamId);
	const disbandBtn = host.querySelector("#disbandTeamBtn");
	if (disbandBtn) disbandBtn.onclick = () => disbandTeam();
	const leaveBtn = host.querySelector("#leaveTeamBtn");
	if (leaveBtn) leaveBtn.onclick = () => leaveTeam();
}
async function openTeamWalletTransferModal() {
	const team = State.myTeam;
	if (!team || State.teamRole !== "leader" || team.leaderId !== State.user.uid) {
		toast("error", "Leader Only", "Only the current Team Leader can send money.");
		return;
	}
	openModal({
		title: "Send Team Wallet Money",
		bodyHTML: `<div class="alert info"><i class="fa-solid fa-shield-halved"></i><span>All team members can see this transfer in the full Team Wallet transaction history. You may send money to yourself too.</span></div><div class="field"><label>Choose recipient</label><select class="select" id="teamTransferRecipient">${Object.values(team.members || {}).map((m) => `<option value="${esc(m.uid)}">${esc(m.name || "Player")} · UID ${esc(m.ffUid || m.uid)}</option>`).join("")}</select></div><div class="field"><label>Amount (₹)</label><input class="input" id="teamTransferAmount" type="number" min="1" step="0.01" placeholder="Enter amount"></div><div class="field"><label>Note (optional)</label><input class="input" id="teamTransferNote" maxlength="100" placeholder="Payment note"></div><small style="color:var(--txm)">Available: ${fmtMoney(Number(State.teamWalletData?.balance || 0))}</small>`,
		footerHTML: `<button class="btn btn-ghost" data-x="c">Cancel</button><button class="btn btn-primary" id="teamTransferConfirm">Send</button>`,
		onMount: (el, close) => {
			el.querySelector("[data-x=\"c\"]").onclick = close;
			el.querySelector("#teamTransferConfirm").onclick = async () => {
				const recipientUid = el.querySelector("#teamTransferRecipient").value;
				const amount = Math.round(Number(el.querySelector("#teamTransferAmount").value) * 100) / 100;
				const note = el.querySelector("#teamTransferNote").value.trim();
				if (!recipientUid || !Number.isFinite(amount) || amount <= 0) {
					toast("warning", "Invalid Amount", "Enter a valid amount greater than zero.");
					return;
				}
				const btn = el.querySelector("#teamTransferConfirm");
				btn.disabled = true;
				btn.textContent = "Sending…";
				try {
					await transferFromTeamWallet(recipientUid, amount, note);
					close();
					toast("success", "Money Sent", `${fmtMoney(amount)} transferred successfully.`);
					await loadMyTeam();
				} catch (e) {
					btn.disabled = false;
					btn.textContent = "Send";
					toast("error", "Transfer Failed", e.message || "Please try again.");
				}
			};
		}
	});
}
async function transferFromTeamWallet(recipientUid, amount, note) {
	const team = State.myTeam;
	const leaderUid = State.user.uid;
	const teamId = team?.teamId;
	if (!teamId || State.teamRole !== "leader" || team.leaderId !== leaderUid) throw new Error("Only the current team leader can transfer funds.");
	if (!team.members?.[recipientUid]) throw new Error("Recipient is not a current team member.");
	const transferId = push(ref(db, "teamWallets/" + teamId + "/transactions")).key;
	const now = Date.now();
	const recipient = team.members[recipientUid];
	if (!(await runTransaction(ref(db, "teamWallets/" + teamId), (current) => {
		if (!current) current = {
			balance: 0,
			transactions: {},
			matchHistory: {}
		};
		const balance = Number(current.balance || current.availableBalance || 0);
		if (balance < amount) return;
		current.balance = Math.round((balance - amount) * 100) / 100;
		current.transactions = current.transactions || {};
		current.transactions[transferId] = {
			id: transferId,
			type: "leader_transfer",
			amount: -amount,
			fromUid: leaderUid,
			fromName: State.profile?.displayName || "Leader",
			toUid: recipientUid,
			toName: recipient.name || "Player",
			note,
			status: "pending_credit",
			createdAt: now
		};
		return current;
	})).committed) throw new Error("Insufficient Team Wallet balance.");
	try {
		if (!(await runTransaction(ref(db, "wallets/" + recipientUid), (current) => {
			current = current || {};
			current.teamTransfers = current.teamTransfers || {};
			if (current.teamTransfers[transferId]) return current;
			current.balance = Math.round(((Number(current.balance) || 0) + amount) * 100) / 100;
			current.teamTransfers[transferId] = {
				teamId,
				amount,
				createdAt: now
			};
			return current;
		})).committed) throw new Error("Recipient wallet credit could not be confirmed.");
		await update(ref(db, "teamWallets/" + teamId + "/transactions/" + transferId), { status: "completed" });
		const personalTx = push(ref(db, "walletTransactions"));
		await set(personalTx, {
			id: personalTx.key,
			userId: recipientUid,
			type: "team_wallet_transfer",
			amount,
			currency: "INR",
			relatedId: teamId,
			relatedTransferId: transferId,
			status: "completed",
			createdAt: now
		});
		const notif = push(ref(db, "notifications/" + recipientUid));
		await set(notif, {
			id: notif.key,
			type: "team_wallet_transfer",
			title: "Team Wallet Payment Received",
			body: `${fmtMoney(amount)} received from ${State.profile?.displayName || "Team Leader"}.`,
			read: false,
			createdAt: now
		});
	} catch (err) {
		throw new Error("Team balance was reserved, but recipient credit needs reconciliation. Contact Admin before retrying. " + (err.message || ""));
	}
}
async function createTeam(name) {
	const uid = State.user.uid;
	try {
		if ((await get(ref(db, "userTeams/" + uid))).exists()) {
			toast("error", "Already in a team", "");
			return;
		}
		const userSnap = await get(ref(db, "users/" + uid));
		let hasUsedTrial = false;
		if (userSnap.exists()) hasUsedTrial = userSnap.val().hasUsedTeamTrial || false;
		const isTrial = !hasUsedTrial;
		const teamRef = push(ref(db, "teams"));
		const teamId = teamRef.key;
		const now = Date.now();
		const maintenanceExpiry = isTrial ? now + TEAM_TRIAL_DURATION_MS : 0;
		const member = {
			uid,
			name: State.profile.displayName || "Player",
			ffUid: State.profile.freeFireUid || "",
			photoUrl: State.profile.photoUrl || "",
			profileEmoji: State.profile.profileEmoji || "",
			joinedAt: now,
			role: "leader"
		};
		const teamData = {
			teamId,
			name,
			logo: "",
			leaderId: uid,
			leaderName: State.profile.displayName || "Player",
			members: { [uid]: member },
			maintenanceExpiry,
			isTrial,
			createdAt: now,
			updatedAt: now
		};
		await set(teamRef, teamData);
		await set(ref(db, "userTeams/" + uid), {
			teamId,
			role: "leader",
			joinedAt: now
		});
		if (isTrial) await update(ref(db, "users/" + uid), { hasUsedTeamTrial: true });
		State.myTeam = { ...teamData };
		State.teamRole = "leader";
		renderMyTeam();
		toast("success", isTrial ? "Team Created! 7-Day Trial Active." : "Team Created!", "");
	} catch (e) {
		toast("error", "Failed", e.message || "");
	}
}
async function openTeamInviteModal() {
	if (!State.myTeam) return;
	if (State.teamRole !== "leader") {
		toast("error", "Leader Only", "");
		return;
	}
	const team = State.myTeam;
	const members = Object.values(team.members || {});
	if (members.length >= TEAM_MAX_MEMBERS) {
		toast("warning", "Team Full", "");
		return;
	}
	let users = [];
	try {
		(await get(ref(db, "publicProfiles"))).forEach((c) => {
			const v = c.val();
			if (isObj(v) && v.uid !== State.user.uid) users.push({
				uid: c.key,
				...v
			});
		});
	} catch (e) {}
	const memberUids = new Set(members.map((m) => m.uid));
	openModal({
		title: "Invite Players",
		bodyHTML: `
      <div class="search-box"><i class="fa-solid fa-magnifying-glass"></i><input class="input" id="inviteSearch" placeholder="Search by name…"></div>
      <div id="inviteResults" style="max-height:400px;overflow-y:auto"></div>
    `,
		footerHTML: `<button class="btn btn-ghost w-100" data-x="c">Close</button>`,
		onMount: (el, close) => {
			el.querySelector("[data-x=\"c\"]").onclick = close;
			const searchInput = el.querySelector("#inviteSearch");
			const resultsHost = el.querySelector("#inviteResults");
			const renderResults = (q) => {
				const filtered = users.filter((u) => !memberUids.has(u.uid) && (u.displayName || "").toLowerCase().includes(q));
				if (!filtered.length) {
					resultsHost.innerHTML = `<div class="empty-state"><p>No players found.</p></div>`;
					return;
				}
				resultsHost.innerHTML = filtered.slice(0, 30).map((u) => {
					return `
          <div class="member-row" style="padding:10px 0">
            <div class="member-avatar">${getAvatarHTML(u.photoUrl, u.profileEmoji, u.displayName)}</div>
            <div style="flex:1;min-width:0"><b style="font-size:.88rem">${esc(u.displayName || "Player")}</b>${u.freeFireUid ? `<small style="display:block;font-size:.7rem;color:var(--txm)">UID: ${esc(u.freeFireUid)}</small>` : ""}</div>
            <button class="btn btn-sm btn-primary" data-invite="${esc(u.uid)}">Invite</button>
          </div>
        `;
				}).join("");
				resultsHost.querySelectorAll("[data-invite]").forEach((b) => {
					b.onclick = async () => {
						b.disabled = true;
						await sendTeamInvite(b.dataset.invite);
						b.textContent = "Sent";
					};
				});
			};
			searchInput.oninput = () => renderResults(searchInput.value.trim().toLowerCase());
			renderResults("");
		}
	});
}
async function sendTeamInvite(targetUid) {
	if (!State.myTeam) return;
	if (State.teamRole !== "leader") {
		toast("error", "Leader Only", "");
		return;
	}
	try {
		if ((await get(ref(db, "userTeams/" + targetUid))).exists()) {
			toast("warning", "Already in a team", "That player is already in another team.");
			return;
		}
		const invRef = push(ref(db, "teamInvites/" + targetUid));
		await set(invRef, {
			id: invRef.key,
			teamId: State.myTeam.teamId,
			teamName: State.myTeam.name,
			fromUid: State.user.uid,
			fromName: State.profile.displayName || "Leader",
			toUid: targetUid,
			status: "pending",
			createdAt: Date.now()
		});
		const notifRef = push(ref(db, "notifications/" + targetUid));
		await set(notifRef, {
			id: notifRef.key,
			type: "team_invite",
			title: "🎮 Team Invitation",
			body: `${State.profile.displayName || "Leader"} invited you to join "${State.myTeam.name}". Open My Team to accept.`,
			read: false,
			createdAt: Date.now()
		});
		toast("success", "Invite Sent", "");
	} catch (e) {
		toast("error", "Failed", e.message || "");
	}
}
async function acceptTeamInvite(inviteId) {
	const uid = State.user.uid;
	try {
		const invSnap = await get(ref(db, "teamInvites/" + uid + "/" + inviteId));
		if (!invSnap.exists()) {
			toast("error", "Invite not found", "");
			return;
		}
		const inv = invSnap.val();
		if (inv.status !== "pending") {
			toast("warning", "Already handled", "");
			return;
		}
		if ((await get(ref(db, "userTeams/" + uid))).exists()) {
			toast("error", "Already in a team", "");
			return;
		}
		const teamSnap = await get(ref(db, "teams/" + inv.teamId));
		if (!teamSnap.exists()) {
			toast("error", "Team not found", "");
			return;
		}
		const team = teamSnap.val();
		if (Object.values(team.members || {}).length >= TEAM_MAX_MEMBERS) {
			toast("error", "Team is full", "");
			return;
		}
		const now = Date.now();
		const memberData = {
			uid,
			name: State.profile.displayName || "Player",
			ffUid: State.profile.freeFireUid || "",
			photoUrl: State.profile.photoUrl || "",
			profileEmoji: State.profile.profileEmoji || "",
			joinedAt: now,
			role: "member"
		};
		await update(ref(db, "teams/" + inv.teamId + "/members/" + uid), memberData);
		await update(ref(db, "teams/" + inv.teamId), { updatedAt: now });
		await set(ref(db, "userTeams/" + uid), {
			teamId: inv.teamId,
			role: "member",
			joinedAt: now
		});
		await update(ref(db, "teamInvites/" + uid + "/" + inviteId), { status: "accepted" });
		const notifRef = push(ref(db, "notifications/" + team.leaderId));
		await set(notifRef, {
			id: notifRef.key,
			type: "team_join",
			title: "New Team Member",
			body: `${State.profile.displayName || "Player"} joined your team "${team.name}".`,
			read: false,
			createdAt: now
		});
		toast("success", "Joined Team!", "");
		await loadMyTeam();
	} catch (e) {
		toast("error", "Failed", e.message || "");
	}
}
async function declineTeamInvite(inviteId) {
	const uid = State.user.uid;
	try {
		await update(ref(db, "teamInvites/" + uid + "/" + inviteId), { status: "declined" });
		toast("info", "Declined", "");
		await loadMyTeam();
	} catch (e) {
		toast("error", "Failed", "");
	}
}
async function transferTeamLeadership(newLeaderUid) {
	const team = State.myTeam;
	const oldLeaderUid = State.user.uid;
	if (!team || State.teamRole !== "leader" || team.leaderId !== oldLeaderUid) {
		toast("error", "Leader Only", "");
		return;
	}
	if (!team.members?.[newLeaderUid] || newLeaderUid === oldLeaderUid) return;
	const newName = team.members[newLeaderUid].name || "selected member";
	if (!await confirmDialog("Transfer Leadership", `Make ${newName} the new Team Leader? You will become a normal member and may then leave the team.`, true)) return;
	try {
		const now = Date.now();
		await update(ref(db, "teams/" + team.teamId), {
			leaderId: newLeaderUid,
			leaderName: newName,
			["members/" + oldLeaderUid + "/role"]: "member",
			["members/" + newLeaderUid + "/role"]: "leader",
			updatedAt: now
		});
		await update(ref(db, "userTeams/" + oldLeaderUid), { role: "member" });
		await update(ref(db, "userTeams/" + newLeaderUid), { role: "leader" });
		const notif = push(ref(db, "notifications/" + newLeaderUid));
		await set(notif, {
			id: notif.key,
			type: "team_leadership",
			title: "You are the Team Leader",
			body: `You are now the leader of ${team.name}. Team wallet and history remain unchanged.`,
			read: false,
			createdAt: now
		});
		toast("success", "Leadership Transferred", `${newName} is now the Team Leader.`);
		await loadMyTeam();
	} catch (e) {
		toast("error", "Transfer Failed", e.message || "");
	}
}
async function kickTeamMember(memberUid) {
	if (!State.myTeam || State.teamRole !== "leader") {
		toast("error", "Leader Only", "");
		return;
	}
	if (memberUid === State.user.uid) {
		toast("error", "Cannot kick yourself", "");
		return;
	}
	if (!await confirmDialog("Remove Member", `Remove ${State.myTeam.members?.[memberUid]?.name || "this member"} from the team?`, true)) return;
	try {
		await remove(ref(db, "teams/" + State.myTeam.teamId + "/members/" + memberUid));
		await remove(ref(db, "userTeams/" + memberUid));
		await update(ref(db, "teams/" + State.myTeam.teamId), { updatedAt: Date.now() });
		const notifRef = push(ref(db, "notifications/" + memberUid));
		await set(notifRef, {
			id: notifRef.key,
			type: "team_kick",
			title: "Removed from Team",
			body: `You were removed from "${State.myTeam.name}".`,
			read: false,
			createdAt: Date.now()
		});
		toast("success", "Member Removed", "");
		await loadMyTeam();
	} catch (e) {
		toast("error", "Failed", e.message || "");
	}
}
async function buyTeamMaintenancePass(teamId) {
	if (!State.myTeam || State.myTeam.teamId !== teamId) {
		toast("error", "Team error", "");
		return;
	}
	if (Number(State.wallet.balance || 0) < TEAM_PASS_PRICE) {
		toast("warning", "Insufficient Balance", `You need at least ₹${TEAM_PASS_PRICE} to buy the pass.`);
		openAddBalance();
		return;
	}
	const team = State.myTeam;
	const currentExpiry = Number(team.maintenanceExpiry || 0);
	const newExpiry = Math.max(Date.now(), currentExpiry) + TEAM_PASS_DURATION_MS;
	if (!await confirmDialog("Buy Maintenance Pass", `Pay ₹${TEAM_PASS_PRICE} from your wallet to ${currentExpiry > Date.now() ? "extend" : "activate"} the team pass for 30 days?`)) return;
	try {
		State.localWalletActionTs = Date.now();
		if (!(await runTransaction(ref(db, "wallets/" + State.user.uid + "/balance"), (cur) => {
			const c = Number(cur) || 0;
			if (c < TEAM_PASS_PRICE) return;
			return c - TEAM_PASS_PRICE;
		})).committed) {
			toast("error", "Failed", "Insufficient balance.");
			return;
		}
		await update(ref(db, "teams/" + teamId), {
			maintenanceExpiry: newExpiry,
			isTrial: false,
			updatedAt: Date.now()
		});
		const txRef = push(ref(db, "walletTransactions"));
		await set(txRef, {
			id: txRef.key,
			userId: State.user.uid,
			type: "team_pass",
			amount: -5,
			currency: "INR",
			relatedId: teamId,
			status: "completed",
			createdAt: Date.now()
		});
		const memberUids = Object.keys(team.members || {});
		for (const muid of memberUids) {
			if (muid === State.user.uid) continue;
			const notifRef = push(ref(db, "notifications/" + muid));
			await set(notifRef, {
				id: notifRef.key,
				type: "team_pass",
				title: "🎉 Team Pass Activated",
				body: `Your team "${team.name}" now has an active maintenance pass for 30 days.`,
				read: false,
				createdAt: Date.now()
			});
		}
		toast("success", "Pass Activated!", `Valid till ${fmtDate(newExpiry)}.`);
		await loadMyTeam();
	} catch (e) {
		toast("error", "Failed", e.message || "");
	}
}
async function editTeamInfo() {
	if (!State.myTeam || State.teamRole !== "leader") {
		toast("error", "Leader Only", "");
		return;
	}
	if (!isVipActive()) {
		openVipGateModal("team");
		return;
	}
	const team = State.myTeam;
	openModal({
		title: "Edit Team",
		bodyHTML: `
      <div style="display:flex;align-items:center;gap:14px;margin-bottom:16px">
        <div class="team-logo" id="teamLogoPreview">${team.logo && team.logo.startsWith("data:image") ? `<img src="${team.logo}" style="width:100%;height:100%;object-fit:cover;border-radius:14px">` : (team.name || "T").charAt(0).toUpperCase()}</div>
        <div style="flex:1">
          <label for="teamLogoFile" class="btn btn-outline btn-sm" style="width:100%;cursor:pointer"><i class="fa-solid fa-cloud-arrow-up"></i> <span id="teamLogoLabel">Upload Logo</span></label>
          <input type="file" id="teamLogoFile" accept="image/*" style="display:none">
        </div>
      </div>
      <div class="field"><label>Team Name</label><input type="text" id="editTeamName" class="input" value="${esc(team.name || "")}" maxlength="30"></div>
      <div style="font-size:.72rem;color:var(--txm);margin-top:4px">* Pick any image from your gallery — all photo sizes are supported and auto-optimized.</div>
    `,
		footerHTML: `<button class="btn btn-ghost" data-x="c">Cancel</button><button class="btn btn-primary" data-x="ok"><i class="fa-solid fa-floppy-disk"></i> Save</button>`,
		onMount: (el, close) => {
			let newLogoBase64 = null;
			const fileInput = el.querySelector("#teamLogoFile");
			const preview = el.querySelector("#teamLogoPreview");
			const label = el.querySelector("#teamLogoLabel");
			fileInput.onchange = async (ev) => {
				const file = ev.target.files[0];
				if (!file) return;
				if (label) label.textContent = "Processing...";
				try {
					newLogoBase64 = await processImageFileToDataURL(file, 512, .85);
					preview.innerHTML = `<img src="${newLogoBase64}" style="width:100%;height:100%;object-fit:cover;border-radius:14px">`;
					if (label) label.textContent = file.name.length > 16 ? file.name.substring(0, 13) + "..." : file.name;
					toast("success", "Logo Ready", "Image optimized and ready to save.");
				} catch (err) {
					fileInput.value = "";
					if (label) label.textContent = "Upload Logo";
					toast("error", "Image Error", "Could not load that image. Please try another.");
				}
			};
			el.querySelector("[data-x=\"c\"]").onclick = close;
			el.querySelector("[data-x=\"ok\"]").onclick = async () => {
				const newName = el.querySelector("#editTeamName").value.trim();
				if (newName.length < 2) {
					toast("error", "Name Too Short", "");
					return;
				}
				try {
					const updates = {
						name: newName,
						updatedAt: Date.now()
					};
					if (newLogoBase64) updates.logo = newLogoBase64;
					await update(ref(db, "teams/" + team.teamId), updates);
					State.myTeam = {
						...State.myTeam,
						...updates
					};
					toast("success", "Team Updated", "");
					close();
					renderMyTeam();
				} catch (e) {
					toast("error", "Failed", e.message || "");
				}
			};
		}
	});
}
async function disbandTeam() {
	if (!State.myTeam || State.teamRole !== "leader") return;
	if (!await confirmDialog("Disband Team", "This will remove all members and delete the team. Continue?", true)) return;
	try {
		const memberUids = Object.keys(State.myTeam.members || {});
		for (const muid of memberUids) {
			await remove(ref(db, "userTeams/" + muid));
			if (muid !== State.user.uid) {
				const notifRef = push(ref(db, "notifications/" + muid));
				await set(notifRef, {
					id: notifRef.key,
					type: "team_disband",
					title: "Team Disbanded",
					body: `Team "${State.myTeam.name}" has been disbanded by the leader.`,
					read: false,
					createdAt: Date.now()
				});
			}
		}
		await remove(ref(db, "teams/" + State.myTeam.teamId));
		await remove(ref(db, "teamWallets/" + State.myTeam.teamId));
		State.myTeam = null;
		State.teamRole = null;
		State.teamWalletData = null;
		toast("info", "Team Disbanded", "");
		renderMyTeam();
	} catch (e) {
		toast("error", "Failed", e.message || "");
	}
}
async function leaveTeam() {
	if (!State.myTeam) return;
	if (State.myTeam.leaderId === State.user.uid || State.teamRole === "leader") {
		toast("warning", "Transfer Leadership First", "A Team Leader cannot leave directly. Transfer leadership to another member first.");
		return;
	}
	if (!await confirmDialog("Leave Team", "Leave this team?", true)) return;
	try {
		const teamId = State.myTeam.teamId;
		const leaderId = State.myTeam.leaderId;
		await remove(ref(db, "teams/" + teamId + "/members/" + State.user.uid));
		await remove(ref(db, "userTeams/" + State.user.uid));
		await update(ref(db, "teams/" + teamId), { updatedAt: Date.now() });
		if (leaderId && leaderId !== State.user.uid) {
			const notifRef = push(ref(db, "notifications/" + leaderId));
			await set(notifRef, {
				id: notifRef.key,
				type: "team_leave",
				title: "Member Left",
				body: `${State.profile.displayName || "A member"} left your team.`,
				read: false,
				createdAt: Date.now()
			});
		}
		State.myTeam = null;
		State.teamRole = null;
		toast("info", "Left Team", "");
		renderMyTeam();
	} catch (e) {
		toast("error", "Failed", e.message || "");
	}
}
async function loadLeaderboardData() {
	const host = $("#lbContent");
	if (!host) return;
	host.innerHTML = `<div class="loading-center"><div class="spinner"></div>Loading leaderboard…</div>`;
	try {
		const resSnap = await get(ref(db, "matchResults")).catch(() => null);
		const regSnap = await get(ref(db, "registrations")).catch(() => null);
		const teamSnap = await get(ref(db, "teams")).catch(() => null);
		const ppSnap = await get(ref(db, "publicProfiles")).catch(() => null);
		const matchResults = {};
		if (resSnap && resSnap.exists()) resSnap.forEach((c) => {
			const v = c.val();
			if (isObj(v) && (v.status === "approved" || v.status === "pending_approval")) matchResults[c.key] = v;
		});
		const regs = [];
		if (regSnap && regSnap.exists()) regSnap.forEach((c) => {
			const v = c.val();
			if (isObj(v)) regs.push(v);
		});
		const teamsMap = {};
		if (teamSnap && teamSnap.exists()) teamSnap.forEach((c) => {
			teamsMap[c.key] = c.val();
		});
		const profilesMap = {};
		if (ppSnap && ppSnap.exists()) ppSnap.forEach((c) => {
			profilesMap[c.key] = c.val();
		});
		const matchSizes = {};
		State.tournaments.forEach((t) => {
			matchSizes[t.id] = Number(t.teamSize || 1);
		});
		const soloStats = {};
		const duoTeamStats = {};
		const squadTeamStats = {};
		regs.forEach((reg) => {
			const res = matchResults[reg.matchId];
			if (!res || !res.entries || !res.entries[reg.userId]) return;
			const entry = res.entries[reg.userId];
			const reward = Number(entry.reward || 0);
			const kills = Number(entry.kills || 0);
			const isWin = (Number(entry.rank) || 0) === 1;
			const uid = reg.userId;
			let size = matchSizes[reg.matchId] || Number(reg.teamSize) || 1;
			if (size === 1) {
				if (!soloStats[uid]) soloStats[uid] = {
					uid,
					name: reg.userName || "Player",
					matches: 0,
					wins: 0,
					kills: 0,
					earnings: 0,
					photoUrl: "",
					profileEmoji: ""
				};
				soloStats[uid].matches++;
				soloStats[uid].kills += kills;
				soloStats[uid].earnings += reward;
				if (isWin) soloStats[uid].wins++;
				const pp = profilesMap[uid];
				if (pp) {
					soloStats[uid].photoUrl = pp.photoUrl || "";
					soloStats[uid].profileEmoji = pp.profileEmoji || "";
					if (!soloStats[uid].name || soloStats[uid].name === "Player") soloStats[uid].name = pp.displayName || reg.userName;
				}
			} else if (size === 2 || size === 4) {
				const bucket = size === 2 ? duoTeamStats : squadTeamStats;
				const teamKey = reg.teamId || (reg.teamName ? "name_" + reg.teamName : "solo_" + uid);
				if (!bucket[teamKey]) {
					const teamInfo = teamsMap[reg.teamId] || {};
					bucket[teamKey] = {
						teamId: reg.teamId || teamKey,
						teamName: reg.teamName || teamInfo.name || "Unknown Team",
						teamLogo: teamInfo.logo || "",
						leaderId: teamInfo.leaderId || null,
						matchSet: /* @__PURE__ */ new Set(),
						totalEarnings: 0,
						totalWins: 0,
						totalKills: 0,
						members: {}
					};
				}
				const T = bucket[teamKey];
				T.matchSet.add(reg.matchId);
				T.totalEarnings += reward;
				T.totalKills += kills;
				if (isWin) T.totalWins++;
				if (!T.members[uid]) {
					const pp = profilesMap[uid];
					T.members[uid] = {
						uid,
						name: reg.userName || pp?.displayName || "Player",
						photoUrl: pp?.photoUrl || "",
						profileEmoji: pp?.profileEmoji || "",
						earnings: 0,
						kills: 0,
						wins: 0,
						matchSet: /* @__PURE__ */ new Set()
					};
				}
				const M = T.members[uid];
				M.earnings += reward;
				M.kills += kills;
				if (isWin) M.wins++;
				M.matchSet.add(reg.matchId);
			}
		});
		const finalizeTeam = (bucket) => Object.values(bucket).map((t) => {
			const membersArr = Object.values(t.members).map((m) => ({
				uid: m.uid,
				name: m.name,
				photoUrl: m.photoUrl,
				profileEmoji: m.profileEmoji,
				earnings: m.earnings,
				kills: m.kills,
				wins: m.wins,
				matches: m.matchSet.size,
				isLeader: m.uid === t.leaderId || t.members[m.uid] && Object.keys(t.members)[0] === m.uid
			}));
			membersArr.sort((a, b) => {
				if (a.isLeader && !b.isLeader) return -1;
				if (!a.isLeader && b.isLeader) return 1;
				return b.earnings - a.earnings;
			});
			return {
				teamId: t.teamId,
				teamName: t.teamName,
				teamLogo: t.teamLogo,
				leaderId: t.leaderId,
				matches: t.matchSet.size,
				wins: t.totalWins,
				kills: t.totalKills,
				earnings: t.totalEarnings,
				members: membersArr
			};
		}).sort((a, b) => b.earnings - a.earnings);
		const duoList = finalizeTeam(duoTeamStats);
		const squadList = finalizeTeam(squadTeamStats);
		State.lbCache = {
			data: {
				solo: Object.values(soloStats).sort((a, b) => b.earnings - a.earnings),
				duo: duoList,
				squad: squadList
			},
			ts: Date.now()
		};
		renderLeaderboard();
	} catch (e) {
		console.warn("Leaderboard error:", e);
		host.innerHTML = `<div class="empty-state"><div class="es-icon"><i class="fa-solid fa-triangle-exclamation"></i></div><h3>Failed to load</h3><p style="font-size:0.8rem; margin-top:8px;">Please refresh the page or try again later.</p></div>`;
	}
}
function renderLeaderboard() {
	const host = $("#lbContent");
	if (!host) return;
	const data = State.lbCache.data;
	if (!data) {
		host.innerHTML = `<div class="empty-state"><div class="es-icon"><i class="fa-solid fa-list-ol"></i></div><h3>No leaderboard data</h3><p>Rankings will appear after matches are played.</p></div>`;
		return;
	}
	const tab = State.lbTab;
	if (tab === "solo") {
		const list = data.solo.slice(0, 10);
		if (!list.length) {
			host.innerHTML = `<div class="empty-state"><div class="es-icon"><i class="fa-solid fa-medal"></i></div><h3>No Solo data yet</h3><p>Top players will appear once Solo matches finish.</p></div>`;
			return;
		}
		host.innerHTML = `<div class="card">` + list.map((u, i) => {
			const rank = i + 1;
			let rankHTML = "";
			if (rank === 1) rankHTML = `<div class="pro-rank-badge rank-1">🥇</div>`;
			else if (rank === 2) rankHTML = `<div class="pro-rank-badge rank-2">🥈</div>`;
			else if (rank === 3) rankHTML = `<div class="pro-rank-badge rank-3">🥉</div>`;
			else rankHTML = `<div class="pro-rank-badge">#${rank}</div>`;
			const avatarHtml = getAvatarHTML(u.photoUrl, u.profileEmoji, u.name);
			return `<div class="list-item">
        ${rankHTML}
        <div class="member-avatar" style="width:38px;height:38px;font-size:.95rem;">${avatarHtml}</div>
        <div class="li-body">
          <b>${esc(u.name)}</b>
          <small>${u.matches} matches · ${u.wins} wins · ${u.kills} kills</small>
        </div>
        <span class="amount pos">${fmtMoney(u.earnings)}</span>
      </div>`;
		}).join("") + `</div>`;
		return;
	}
	const list = tab === "duo" ? data.duo.slice(0, 3) : data.squad.slice(0, 3);
	const headerTitle = tab === "duo" ? "🏆 Top Duo Teams" : "🏆 Top Squad Teams";
	const teamSizeLabel = tab === "duo" ? "2 Players (Duo)" : "4 Players (Squad)";
	if (!list.length) {
		host.innerHTML = `<div class="empty-state"><div class="es-icon"><i class="fa-solid fa-users"></i></div><h3>No ${tab} data yet</h3><p>Team rankings appear once ${tab} matches are played.</p></div>`;
		return;
	}
	host.innerHTML = `<div style="font-size:.72rem;color:var(--txm);text-transform:uppercase;letter-spacing:1px;margin-bottom:10px;text-align:center">${esc(headerTitle)} · ${esc(teamSizeLabel)}</div>` + list.map((t, i) => {
		const rank = i + 1;
		let cardCls = "";
		let rankHTML = "";
		if (rank === 1) {
			cardCls = "is-rank-1";
			rankHTML = `<div class="pro-rank-badge rank-1">🥇</div>`;
		} else if (rank === 2) {
			cardCls = "is-rank-2";
			rankHTML = `<div class="pro-rank-badge rank-2">🥈</div>`;
		} else if (rank === 3) {
			cardCls = "is-rank-3";
			rankHTML = `<div class="pro-rank-badge rank-3">🥉</div>`;
		}
		const logoHTML = t.teamLogo && t.teamLogo.startsWith("data:image") ? `<img src="${t.teamLogo}" alt="logo">` : esc((t.teamName || "T").charAt(0).toUpperCase());
		return `<div class="lb-team-card ${cardCls}">
      <div class="lb-team-header">
        ${rankHTML}
        <div class="lb-team-logo">${logoHTML}</div>
        <div class="lb-team-info">
          <b>${esc(t.teamName)}</b>
          <small>${t.matches} matches · ${t.wins} wins · ${t.kills} kills</small>
        </div>
        <div class="lb-team-earnings">
          <div class="val">${fmtMoney(t.earnings)}</div>
          <div class="lbl">Total Earning</div>
        </div>
      </div>
      <div class="lb-team-members">
        ${t.members.map((mem) => {
			return `<div class="lb-member-item">
            <div class="lb-member-avatar">${getAvatarHTML(mem.photoUrl, mem.profileEmoji, mem.name)}</div>
            <div class="lb-member-info">
              <div class="lb-member-name">
                <span>${esc(mem.name)}</span>
                ${mem.isLeader ? "<span class=\"leader-tag\">👑 Leader</span>" : ""}
              </div>
              <div class="lb-member-stats">
                <span><i class="fa-solid fa-gamepad"></i> ${mem.matches} matches</span>
                <span><i class="fa-solid fa-crosshairs"></i> ${mem.kills} kills</span>
                ${mem.wins > 0 ? `<span><i class="fa-solid fa-medal"></i> ${mem.wins} wins</span>` : ""}
              </div>
            </div>
            <div class="lb-member-earning">
              ${fmtMoney(mem.earnings)}
              <small>Earned</small>
            </div>
          </div>`;
		}).join("")}
      </div>
    </div>`;
	}).join("");
}
function renderMyMatches() {
	const host = $("#myMatchesList");
	if (!host) return;
	const list = (State.myRegistrations || []).filter((r) => isWithinRetention(r.createdAt)).slice().sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
	if (!list.length) {
		host.innerHTML = `<div class="empty-state"><div class="es-icon"><i class="fa-solid fa-list-check"></i></div><h3>No matches yet</h3><button class="btn btn-primary mt-3" data-nav="tournaments"><i class="fa-solid fa-trophy"></i> Browse Matches</button></div>`;
		host.querySelectorAll("[data-nav]").forEach((b) => b.onclick = () => navigate(b.dataset.nav));
		return;
	}
	const active = list.filter((r) => {
		const m = State.tournaments.find((t) => t.id === r.matchId);
		return m && (m.status === "upcoming" || m.status === "ongoing");
	});
	const past = list.filter((r) => {
		const m = State.tournaments.find((t) => t.id === r.matchId);
		return m && (m.status === "completed" || m.status === "cancelled" || m.status === "canceled");
	});
	let html = "";
	if (active.length) html += `<h3 class="mb-3">Active</h3>` + active.map((r) => myMatchHTML(r)).join("");
	if (past.length) html += `<h3 class="mb-3 mt-4">History</h3>` + past.map((r) => myMatchHTML(r)).join("");
	host.innerHTML = html;
	bindMatchCardClicks(host);
}
function myMatchHTML(r) {
	const m = State.tournaments.find((t) => t.id === r.matchId) || {};
	const modeCls = {
		BR: "br",
		CS: "cs",
		LW: "lw"
	}[m.mode] || "neutral";
	const teamSize = Number(m.teamSize || 1);
	const teamLabel = teamSize === 2 ? "Duo" : teamSize === 4 ? "Squad" : "Solo";
	const res = State.matchResultsCache[r.matchId];
	const myResult = res && res.entries ? res.entries[r.userId] : null;
	let resultHTML = "";
	if (myResult && res.status === "approved") {
		let rankIcon = "";
		if (Number(myResult.rank) === 1) rankIcon = "🥇";
		else if (Number(myResult.rank) === 2) rankIcon = "🥈";
		else if (Number(myResult.rank) === 3) rankIcon = "🥉";
		resultHTML = `
      <div class="match-reward-detail">
        <span>${rankIcon} <b>Rank: ${myResult.rank || "-"}</b></span>
        <span><i class="fa-solid fa-crosshairs"></i> ${myResult.kills || 0} kills</span>
        <span class="reward-badge"><i class="fa-solid fa-coins"></i> +${fmtMoney(myResult.reward || 0)}</span>
      </div>
    `;
	} else if (myResult && res.status === "pending_approval") resultHTML = `<div class="match-reward-detail"><span class="muted" style="font-size:.75rem;color:var(--inf)"><i class="fa-solid fa-hourglass-half"></i> Result pending approval</span></div>`;
	else if (res && res.status === "pending_approval" && !myResult) resultHTML = `<div class="match-reward-detail"><span class="muted" style="font-size:.75rem;color:var(--inf)"><i class="fa-solid fa-hourglass-half"></i> Results being prepared</span></div>`;
	return `<div class="match-card" data-match-id="${esc(r.matchId)}">
    <div class="match-body">
      <div class="flex-between mb-2">
        <span class="badge ${modeCls}">${esc(m.mode || r.matchMode || "")} · ${teamLabel}</span>
        <span class="badge ${m.status || "unknown"}">${esc(m.status || "unknown")}</span>
      </div>
      <div class="match-title">${esc(r.matchTitle || m.title || "")}</div>
      <div class="match-meta">
        <span><i class="fa-regular fa-calendar"></i> ${esc(formatMatchDateTime(m.matchDate, m.matchTime))}</span>
        <span><i class="fa-solid fa-indian-rupee-sign"></i> ${r.entryFee > 0 ? fmtMoney(r.entryFee) : "FREE"}</span>
      </div>
      ${resultHTML}
    </div>
  </div>`;
}
async function openAddBalance() {
	const s = (await get(ref(db, "appSettings/payment")).catch(() => null))?.val() || {};
	const upiId = s.upiId || "";
	const qrUrl = s.qrUrl || "";
	const instructions = s.instructions || "Send the exact amount and enter the UTR / transaction reference below.";
	const minDep = Number(s.minDeposit || 10);
	const maxDep = Number(s.maxDeposit || 1e4);
	openModal({
		title: "Add Balance",
		bodyHTML: `
      <div class="alert info" style="padding:10px 12px;font-size:.78rem;margin-bottom:10px;"><i class="fa-solid fa-circle-info"></i><span>Pay via UPI, then submit the reference. Admin will verify and credit your wallet.</span></div>
      ${qrUrl ? `<div class="tc mb-2"><img src="${esc(qrUrl)}" style="max-width:155px;border-radius:12px;margin:0 auto" onerror="this.style.display='none'"></div>` : ""}
      ${upiId ? `<div class="room-box mb-2" style="padding:8px 12px;"><div class="room-row" style="padding:2px 0;"><span class="rk">UPI ID</span><span class="rv" style="font-size:.86rem;">${esc(upiId)} <button type="button" class="copy-btn" data-copy="${esc(upiId)}">Copy</button></span></div></div>` : ""}
      <div style="font-size:.76rem;color:var(--txd);margin-bottom:10px;white-space:pre-wrap">${esc(instructions)}</div>
      <div class="field" style="margin-bottom:10px;"><label>Amount (₹) <span class="req">*</span></label><input type="number" id="depAmt" class="input" min="${minDep}" max="${maxDep}" step="1" placeholder="Min ₹${minDep}"></div>
      <div class="field" style="margin-bottom:10px;"><label>Your UPI ID <span class="req">*</span></label><input type="text" id="depUpi" class="input" placeholder="yourname@upi"></div>
      <div class="field" style="margin-bottom:0;"><label>Transaction / UTR Reference <span class="req">*</span></label><input type="text" id="depRef" class="input" placeholder="12-digit UTR"></div>
    `,
		footerHTML: `<button class="btn btn-ghost" style="flex:1;" data-x="c">Cancel</button><button class="btn btn-primary" style="flex:1;" data-x="ok"><i class="fa-solid fa-paper-plane"></i> Submit</button>`,
		onMount: (el, close) => {
			const mfoot = el.querySelector(".mfoot");
			if (mfoot) mfoot.classList.add("mfoot-row");
			el.querySelectorAll("[data-copy]").forEach((b) => {
				b.type = "button";
				b.onclick = async (e) => {
					e.preventDefault();
					e.stopPropagation();
					await copyTextToClipboard(b.dataset.copy);
				};
			});
			el.querySelector("[data-x=\"c\"]").onclick = close;
			el.querySelector("[data-x=\"ok\"]").onclick = async () => {
				const amtRupees = Number(el.querySelector("#depAmt").value);
				const upi = el.querySelector("#depUpi").value.trim();
				const refVal = el.querySelector("#depRef").value.trim();
				if (!amtRupees || amtRupees < minDep) {
					toast("error", "Invalid", "Min amount is ₹" + minDep);
					return;
				}
				if (amtRupees > maxDep) {
					toast("error", "Too High", "Max amount is ₹" + maxDep);
					return;
				}
				if (!upi) {
					toast("error", "Required", "Enter your UPI ID");
					return;
				}
				if (!refVal) {
					toast("error", "Required", "Enter transaction reference");
					return;
				}
				try {
					const dupSnap = await get(query(ref(db, "depositRequests"), orderByChild("transactionRef"), equalTo(refVal))).catch(() => null);
					if (dupSnap && dupSnap.exists()) {
						toast("error", "Duplicate", "This reference is already used");
						return;
					}
					const dRef = push(ref(db, "depositRequests"));
					await set(dRef, {
						id: dRef.key,
						userId: State.user.uid,
						userName: State.profile?.displayName || "",
						amount: amtRupees,
						payerUpi: upi,
						transactionRef: refVal,
						status: "pending",
						createdAt: Date.now()
					});
					const notifRef = push(ref(db, "notifications/" + State.user.uid));
					await set(notifRef, {
						id: notifRef.key,
						type: "deposit_request",
						title: "Deposit Submitted",
						body: `Your deposit of ₹${amtRupees} is pending admin approval.`,
						read: false,
						createdAt: Date.now()
					});
					toast("success", "Submitted", "Pending verification");
					close();
				} catch (e) {
					toast("error", "Failed", e.message);
				}
			};
		}
	});
}
async function openWithdraw() {
	const s = (await get(ref(db, "appSettings/payment")).catch(() => null))?.val() || {};
	const minWd = Number(s.minWithdrawal || 100);
	const balance = Number(State.wallet.balance || 0);
	openModal({
		title: "Withdraw",
		bodyHTML: `
      <div class="alert info"><i class="fa-solid fa-circle-info"></i><span>Min withdrawal: <b>${fmtMoney(minWd)}</b></span></div>
      <div class="room-box mb-3"><div class="room-row"><span class="rk">Available</span><span class="rv">${fmtMoney(balance)}</span></div></div>
      <div class="field"><label>Amount (₹) <span class="req">*</span></label><input type="number" id="wdAmt" class="input" min="${minWd}" placeholder="Min ₹${minWd}"></div>
      <div class="field"><label>Your UPI ID <span class="req">*</span></label><input type="text" id="wdDetail" class="input" placeholder="yourname@upi"></div>
    `,
		footerHTML: `<button class="btn btn-ghost" style="flex:1;" data-x="c">Cancel</button><button class="btn btn-primary" style="flex:1;" data-x="ok"><i class="fa-solid fa-arrow-up"></i> Request</button>`,
		onMount: (el, close) => {
			const mfoot = el.querySelector(".mfoot");
			if (mfoot) mfoot.classList.add("mfoot-row");
			el.querySelector("[data-x=\"c\"]").onclick = close;
			el.querySelector("[data-x=\"ok\"]").onclick = async () => {
				const amt = Number(el.querySelector("#wdAmt").value);
				const detail = el.querySelector("#wdDetail").value.trim();
				if (!amt || amt < minWd) {
					toast("error", "Too Low", "Min is " + fmtMoney(minWd));
					return;
				}
				if (amt > balance) {
					toast("error", "Insufficient", "Not enough balance");
					return;
				}
				if (!detail) {
					toast("error", "Required", "Enter your UPI ID");
					return;
				}
				try {
					State.localWalletActionTs = Date.now();
					if (!(await runTransaction(ref(db, "wallets/" + State.user.uid + "/balance"), (cur) => {
						const curr = Number(cur) || 0;
						if (curr < amt) return;
						return curr - amt;
					})).committed) {
						toast("error", "Failed", "Could not process");
						return;
					}
					await runTransaction(ref(db, "wallets/" + State.user.uid + "/reserved"), (cur) => (Number(cur) || 0) + amt);
					const wdRef = push(ref(db, "withdrawalRequests"));
					await set(wdRef, {
						id: wdRef.key,
						userId: State.user.uid,
						userName: State.profile?.displayName || "",
						amount: amt,
						payoutMethod: "UPI",
						payoutDetail: detail,
						status: "pending",
						createdAt: Date.now()
					});
					const txRef = push(ref(db, "walletTransactions"));
					await set(txRef, {
						id: txRef.key,
						userId: State.user.uid,
						type: "withdrawal",
						amount: -amt,
						currency: "INR",
						relatedId: wdRef.key,
						status: "pending",
						createdAt: Date.now()
					});
					const notifRef = push(ref(db, "notifications/" + State.user.uid));
					await set(notifRef, {
						id: notifRef.key,
						type: "withdrawal_request",
						title: "Withdrawal Requested",
						body: `Your withdrawal of ₹${amt} is pending admin approval.`,
						read: false,
						createdAt: Date.now()
					});
					toast("success", "Requested", "Admin will process soon");
					close();
				} catch (e) {
					toast("error", "Failed", e.message);
				}
			};
		}
	});
}
function renderTransactions() {
	const host = $("#txList");
	if (!host) return;
	const list = (State.transactions || []).filter((t) => isWithinRetention(t.createdAt) && !State.localDeletedTxs.includes(t.id)).slice(0, 50);
	if (!list.length) {
		host.innerHTML = `<div class="empty-state"><p>No transactions.</p></div>`;
		return;
	}
	host.innerHTML = list.map((t) => {
		const icon = {
			deposit: "fa-arrow-down",
			entry_fee: "fa-ticket",
			refund: "fa-rotate-left",
			referral: "fa-share-nodes",
			referral_bonus: "fa-gift",
			kill_reward: "fa-crosshairs",
			prize: "fa-medal",
			match_reward: "fa-trophy",
			spin_reward: "fa-dharmachakra",
			daily_bonus: "fa-gift",
			ad_reward: "fa-tv",
			withdrawal: "fa-arrow-up",
			withdrawal_refund: "fa-rotate-left",
			admin_set: "fa-pen-to-square",
			vip_purchase: "fa-crown",
			diamond_earn: "fa-gem",
			diamond_spend: "fa-gem",
			admin_diamond_gift: "fa-gift",
			admin_diamond_set: "fa-gem",
			team_pass: "fa-crown",
			match_cancelled: "fa-ban"
		}[t.type] || "fa-receipt";
		let cls = t.amount >= 0 ? "pos" : "neg";
		let color = t.amount >= 0 ? "var(--ok)" : "var(--er)";
		let bg = t.amount >= 0 ? "var(--oks)" : "var(--ers)";
		let richBody = "";
		let title = (t.type || "Transaction").replace(/_/g, " ").toUpperCase();
		let displayAmount = "";
		const isDiamonds = t.currency === "DIAMONDS" || [
			"spin_reward",
			"daily_bonus",
			"ad_reward",
			"admin_diamond_gift",
			"admin_diamond_set"
		].includes(t.type);
		const displayVal = isDiamonds ? t.diamonds || t.amount : t.amount;
		if (isDiamonds) {
			cls = displayVal >= 0 ? "pos" : "neg";
			color = displayVal >= 0 ? "var(--ok)" : "var(--er)";
			bg = displayVal >= 0 ? "var(--oks)" : "var(--ers)";
			displayAmount = `${displayVal >= 0 ? "+" : ""}${displayVal} 💎`;
		} else displayAmount = `${displayVal >= 0 ? "+" : ""}${fmtMoney(displayVal)}`;
		if (t.type === "match_reward" && t.matchTitle) {
			title = `Match Reward — ${t.matchTitle}`;
			let rankTxt = `Rank: ${t.rank || "-"}`;
			if (Number(t.rank) === 1) rankTxt = "🥇 Rank: 1st";
			else if (Number(t.rank) === 2) rankTxt = "🥈 Rank: 2nd";
			else if (Number(t.rank) === 3) rankTxt = "🥉 Rank: 3rd";
			richBody = `<div style="font-size:.75rem;color:var(--txd);margin-top:2px;display:flex;gap:10px;flex-wrap:wrap">
        <span>${rankTxt}</span>
        <span>🎯 ${t.kills || 0} kills</span>
      </div>`;
		} else if (t.type === "spin_reward") title = "🎡 Spin & Win Reward";
		else if (t.type === "daily_bonus") title = "🎁 Daily Login Bonus";
		else if (t.type === "ad_reward") title = "📺 Ad Watch Reward";
		else if (t.type === "vip_purchase") {
			title = "👑 VIP Purchase";
			displayAmount = t.currency === "DIAMONDS" ? `${displayVal > 0 ? "+" : ""}${displayVal} 💎` : `${displayVal >= 0 ? "+" : ""}${fmtMoney(displayVal)}`;
		} else if (t.type === "team_pass") title = "👥 Team Maintenance Pass";
		else if (t.type === "admin_diamond_gift") title = "🎁 Diamonds Gifted by Admin";
		else if (t.type === "admin_diamond_set") title = displayVal > 0 ? "💎 Diamonds Added by Admin" : "💎 Diamonds Deducted by Admin";
		else if (t.type === "refund") title = "💸 Match Refund";
		else if (t.type === "match_cancelled") title = "🚫 Match Cancelled";
		if (!richBody) richBody = `<small>${fmtDateTime(t.createdAt)} · ${esc(t.status || "")}</small>`;
		return `<div class="list-item">
      <div class="li-icon" style="background:${bg};color:${color}"><i class="fa-solid ${icon}"></i></div>
      <div class="li-body">
        <b>${esc(title)}</b>
        ${richBody}
      </div>
      <span class="amount ${cls}" style="margin-right:8px;">${displayAmount}</span>
      <button class="delete-tx-btn" onclick="deleteTx('${t.id}')"><i class="fa-solid fa-trash"></i></button>
    </div>`;
	}).join("");
}
window.deleteTx = (id) => {
	if (!State.localDeletedTxs.includes(id)) {
		State.localDeletedTxs.push(id);
		localStorage.setItem("deleted_txs", JSON.stringify(State.localDeletedTxs));
		renderTransactions();
		toast("success", "Deleted", "Transaction removed from your history");
	}
};
var CHAT_WALLPAPERS = [
	{
		id: "default",
		name: "Classic White",
		vipOnly: false,
		img: "",
		defaultPos: 50
	},
	{
		id: "naruto",
		name: "Naruto",
		vipOnly: true,
		img: "assets/wallpapers/wp_naruto.jpg?v=2",
		defaultPos: 50
	},
	{
		id: "sasuke",
		name: "Sasuke",
		vipOnly: true,
		img: "assets/wallpapers/wp_sasuke.jpg?v=2",
		defaultPos: 50
	},
	{
		id: "luffy",
		name: "Luffy",
		vipOnly: true,
		img: "assets/wallpapers/wp_luffy.jpg?v=2",
		defaultPos: 50
	},
	{
		id: "goku",
		name: "Goku",
		vipOnly: true,
		img: "assets/wallpapers/wp_goku.jpg?v=2",
		defaultPos: 50
	},
	{
		id: "itachi_moon",
		name: "Itachi Moon",
		vipOnly: true,
		img: "assets/wallpapers/wp_itachi_moon.jpg?v=2",
		defaultPos: 50
	},
	{
		id: "kakashi",
		name: "Kakashi",
		vipOnly: true,
		img: "assets/wallpapers/wp_kakashi.jpg?v=2",
		defaultPos: 50
	},
	{
		id: "tanjiro",
		name: "Tanjiro",
		vipOnly: true,
		img: "assets/wallpapers/wp_tanjiro.jpg?v=2",
		defaultPos: 50
	},
	{
		id: "strawhat_ship",
		name: "Straw Hat",
		vipOnly: true,
		img: "assets/wallpapers/wp_strawhat_ship.jpg?v=2",
		defaultPos: 50
	},
	{
		id: "akatsuki_cloud",
		name: "Akatsuki",
		vipOnly: true,
		img: "assets/wallpapers/wp_akatsuki_cloud.jpg?v=2",
		defaultPos: 50
	},
	{
		id: "shenron",
		name: "Shenron",
		vipOnly: true,
		img: "assets/wallpapers/wp_shenron.jpg?v=2",
		defaultPos: 50
	}
];
function getEffectiveChatWallpaper() {
	if (!isVipActive()) return {
		type: "default",
		id: "default",
		pos: 50,
		dim: 14
	};
	let wp = State.profile?.chatWallpaper || State.chatWallpaper || null;
	if (!wp && State.user) try {
		const cached = JSON.parse(localStorage.getItem("pe_chat_wp_" + State.user.uid) || "null");
		if (cached && typeof cached === "object") wp = cached;
	} catch (e) {}
	if (!wp || wp.type === "default" || wp.id === "default") return {
		type: "default",
		id: "default",
		pos: 50,
		dim: 14
	};
	if (wp.type === "custom" && wp.dataUrl) return {
		type: "custom",
		id: "custom",
		dataUrl: wp.dataUrl,
		pos: Number.isFinite(Number(wp.pos)) ? Number(wp.pos) : 50,
		dim: Number.isFinite(Number(wp.dim)) ? Number(wp.dim) : 18
	};
	const preset = CHAT_WALLPAPERS.find((w) => w.id === wp.id && w.id !== "default");
	if (preset) return {
		type: "preset",
		id: preset.id,
		pos: Number.isFinite(Number(wp.pos)) ? Number(wp.pos) : preset.defaultPos,
		dim: Number.isFinite(Number(wp.dim)) ? Number(wp.dim) : 14
	};
	return {
		type: "default",
		id: "default",
		pos: 50,
		dim: 14
	};
}
function applyWallpaperStyleToEl(canvasEl, wp) {
	if (!canvasEl) return;
	canvasEl.style.background = "";
	canvasEl.style.backgroundColor = "";
	canvasEl.style.backgroundImage = "";
	canvasEl.style.backgroundSize = "";
	canvasEl.style.backgroundPosition = "";
	canvasEl.style.backgroundRepeat = "";
	canvasEl.style.removeProperty("--wp-dim");
	if (!wp || wp.type === "default" || wp.id === "default") {
		canvasEl.classList.remove("has-wallpaper");
		canvasEl.classList.remove("has-wp");
		return;
	}
	const posX = Number.isFinite(Number(wp.pos)) ? Math.max(0, Math.min(100, Number(wp.pos))) : 50;
	const dimPct = Number.isFinite(Number(wp.dim)) ? Math.max(0, Math.min(60, Number(wp.dim))) : 14;
	let imgSrc = "";
	if (wp.type === "custom" && wp.dataUrl) imgSrc = wp.dataUrl;
	else {
		const def = CHAT_WALLPAPERS.find((w) => w.id === wp.id);
		if (def && def.img) imgSrc = def.img;
	}
	if (!imgSrc) {
		canvasEl.classList.remove("has-wallpaper");
		canvasEl.classList.remove("has-wp");
		return;
	}
	canvasEl.classList.add("has-wallpaper");
	canvasEl.classList.add("has-wp");
	canvasEl.style.setProperty("--wp-dim", (dimPct / 100).toFixed(2));
	canvasEl.style.backgroundColor = "#0f172a";
	canvasEl.style.backgroundImage = `url("${imgSrc}")`;
	canvasEl.style.backgroundSize = "cover";
	canvasEl.style.backgroundPosition = wp.type === "custom" ? `${posX}% center` : `center ${posX}%`;
	canvasEl.style.backgroundRepeat = "no-repeat";
}
function applyChatWallpaperToOpenChats() {
	const wp = getEffectiveChatWallpaper();
	document.querySelectorAll(".chat-canvas-wrap").forEach((el) => applyWallpaperStyleToEl(el, wp));
}
async function saveChatWallpaper(wpObj) {
	if (!State.user) return;
	State.chatWallpaper = wpObj;
	if (State.profile) State.profile.chatWallpaper = wpObj;
	try {
		localStorage.setItem("pe_chat_wp_" + State.user.uid, JSON.stringify(wpObj));
	} catch (e) {}
	applyChatWallpaperToOpenChats();
	try {
		await update(ref(db, "users/" + State.user.uid), { chatWallpaper: wpObj });
	} catch (e) {
		console.warn("Could not sync chat wallpaper:", e);
	}
}
function openChatWallpaperPicker() {
	const vip = isVipActive();
	let draft = { ...getEffectiveChatWallpaper() };
	const animePresets = CHAT_WALLPAPERS.filter((w) => w.id !== "default");
	const getDraftName = (wp) => {
		if (!wp || wp.type === "default") return "Classic White";
		if (wp.type === "custom") return "Custom Photo";
		return CHAT_WALLPAPERS.find((w) => w.id === wp.id)?.name || "Wallpaper";
	};
	openModal({
		title: "Chat Background",
		extraClass: "chat-wp-modal",
		bodyHTML: `
    <div class="wp-preview-shell">
      <div class="wp-preview-head">
        <span><i class="fa-solid fa-earth-asia" style="color:#0284c7;margin-right:5px;"></i>Live Chat Preview</span>
        <span id="wpPreviewLabel" style="color:var(--ac2);font-size:.66rem;">${esc(getDraftName(draft))}</span>
      </div>
      <div class="wp-preview-box ${draft.type !== "default" ? "has-wp" : ""}" id="wpLivePreview">
        <div class="chat-msg" style="max-width:80%;pointer-events:none;padding:7px 11px;">
          <div class="chat-msg-header"><span>PBXJOBAN</span><i class="fa-solid fa-circle-check blue-tick"></i></div>
          <div class="chat-msg-text" style="font-size:.77rem;">Squad ready for 8 PM custom? 🔥</div>
        </div>
        <div class="chat-msg mine" style="max-width:80%;pointer-events:none;padding:7px 11px;">
          <div class="chat-msg-text" style="font-size:.77rem;">Yes bro! Wallpaper looks super crisp ✨</div>
        </div>
      </div>
    </div>

    <div class="wp-adjust-box" id="wpAdjustBox" style="display:${draft.type === "default" ? "none" : "flex"};">
      <div class="wp-adj-row">
        <span><i class="fa-solid fa-arrows-left-right"></i> Position</span>
        <input type="range" id="wpPosRange" min="0" max="100" value="${Number(draft.pos ?? 50)}">
        <span class="wp-adj-val" id="wpPosVal">${Number(draft.pos ?? 50)}%</span>
      </div>
      <div class="wp-adj-row">
        <span><i class="fa-solid fa-circle-half-stroke"></i> Dim</span>
        <input type="range" id="wpDimRange" min="0" max="50" value="${Number(draft.dim ?? 14)}">
        <span class="wp-adj-val" id="wpDimVal">${Number(draft.dim ?? 14)}%</span>
      </div>
    </div>

    <div class="wp-top-actions">
      <button type="button" class="wp-action-card ${draft.type === "default" ? "active" : ""}" id="wpDefaultBtn">
        <div class="wp-action-ic" style="background:var(--sf);border:1px solid var(--bd);color:var(--txd);"><i class="fa-regular fa-square"></i></div>
        <div style="min-width:0;">
          <b>Classic White</b>
          <small>Default · Free</small>
        </div>
      </button>
      <button type="button" class="wp-action-card ${draft.type === "custom" ? "active" : ""}" id="wpCustomUploadBar">
        <div class="wp-action-ic" style="background:#111827;color:#e6c273;"><i class="fa-solid fa-cloud-arrow-up"></i></div>
        <div style="min-width:0;">
          <b>Custom Photo</b>
          <small>${vip ? "From Gallery" : "VIP Only"}</small>
        </div>
      </button>
    </div>
    <input type="file" id="wpFileInput" accept="image/*" style="display:none;">

    <div style="font-size:.68rem;font-weight:800;color:var(--txm);text-transform:uppercase;letter-spacing:.6px;margin-bottom:8px;display:flex;justify-content:space-between;align-items:center;">
      <span>10 Anime Backgrounds</span>
      <span style="font-weight:600;text-transform:none;letter-spacing:0;">Tap to preview</span>
    </div>
    <div class="wp-grid" id="wpPresetGrid">
      ${animePresets.map((w) => {
			const isLocked = w.vipOnly && !vip;
			const isActive = draft.type === "preset" && draft.id === w.id;
			return `
          <div class="wp-tile ${isActive ? "active" : ""}" data-wpid="${w.id}">
            <img src="${w.img}" alt="${esc(w.name)}" loading="lazy">
            ${isActive ? "<span class=\"wp-tile-badge ok\"><i class=\"fa-solid fa-check\"></i></span>" : isLocked ? "<span class=\"wp-tile-badge vip\"><i class=\"fa-solid fa-lock\"></i> VIP</span>" : ""}
            <div class="wp-tile-name"><span>${esc(w.name)}</span></div>
          </div>
        `;
		}).join("")}
    </div>
    <p style="font-size:.66rem;color:var(--txm);margin:10px 0 0;line-height:1.4;text-align:center;">
      Applies full-size to both <b>World Chat</b> & <b>Direct Admin Chat</b>. Resets to Classic White if VIP expires.
    </p>
  `,
		footerHTML: `<button class="btn btn-ghost" style="flex:0 0 auto;" data-x="cancel">Cancel</button><button class="btn btn-primary" style="flex:1;" data-x="apply"><i class="fa-solid fa-check"></i> Apply Background</button>`,
		onMount: (el, close) => {
			const mfoot = el.querySelector(".mfoot");
			if (mfoot) mfoot.classList.add("mfoot-row");
			const livePrev = el.querySelector("#wpLivePreview");
			const prevLabel = el.querySelector("#wpPreviewLabel");
			const adjustBox = el.querySelector("#wpAdjustBox");
			const posRange = el.querySelector("#wpPosRange");
			const posVal = el.querySelector("#wpPosVal");
			const dimRange = el.querySelector("#wpDimRange");
			const dimVal = el.querySelector("#wpDimVal");
			const defaultBtn = el.querySelector("#wpDefaultBtn");
			const customBtn = el.querySelector("#wpCustomUploadBar");
			const refreshPreviewUI = () => {
				applyWallpaperStyleToEl(livePrev, draft);
				if (prevLabel) prevLabel.textContent = getDraftName(draft);
				if (adjustBox) adjustBox.style.display = draft.type === "default" ? "none" : "flex";
				if (posRange) posRange.value = String(draft.pos ?? 50);
				if (posVal) posVal.textContent = `${draft.pos ?? 50}%`;
				if (dimRange) dimRange.value = String(draft.dim ?? 14);
				if (dimVal) dimVal.textContent = `${draft.dim ?? 14}%`;
				defaultBtn.classList.toggle("active", draft.type === "default");
				customBtn.classList.toggle("active", draft.type === "custom");
				el.querySelectorAll(".wp-tile").forEach((t) => {
					const isAct = draft.type === "preset" && draft.id === t.dataset.wpid;
					t.classList.toggle("active", isAct);
					const oldBadge = t.querySelector(".wp-tile-badge");
					if (oldBadge) oldBadge.remove();
					if (isAct) t.insertAdjacentHTML("afterbegin", "<span class=\"wp-tile-badge ok\"><i class=\"fa-solid fa-check\"></i></span>");
					else if (!isVipActive()) t.insertAdjacentHTML("afterbegin", "<span class=\"wp-tile-badge vip\"><i class=\"fa-solid fa-lock\"></i> VIP</span>");
				});
			};
			refreshPreviewUI();
			posRange.oninput = () => {
				draft.pos = Number(posRange.value);
				posVal.textContent = `${draft.pos}%`;
				applyWallpaperStyleToEl(livePrev, draft);
			};
			dimRange.oninput = () => {
				draft.dim = Number(dimRange.value);
				dimVal.textContent = `${draft.dim}%`;
				applyWallpaperStyleToEl(livePrev, draft);
			};
			defaultBtn.onclick = () => {
				draft = {
					type: "default",
					id: "default",
					pos: 50,
					dim: 14
				};
				refreshPreviewUI();
			};
			el.querySelectorAll(".wp-tile").forEach((tile) => {
				tile.onclick = () => {
					const id = tile.dataset.wpid;
					const def = CHAT_WALLPAPERS.find((w) => w.id === id);
					if (!def) return;
					if (def.vipOnly && !isVipActive()) {
						close();
						setTimeout(() => openVipGateModal("wallpapers", def.name), 150);
						return;
					}
					draft = {
						type: "preset",
						id,
						pos: def.defaultPos,
						dim: 14
					};
					refreshPreviewUI();
				};
			});
			const fileInput = el.querySelector("#wpFileInput");
			customBtn.onclick = () => {
				if (!isVipActive()) {
					close();
					setTimeout(() => openVipGateModal("wallpapers", "Custom Photo Wallpaper"), 150);
					return;
				}
				fileInput.click();
			};
			fileInput.onchange = async (ev) => {
				const file = ev.target.files?.[0];
				if (!file) return;
				if (!isVipActive()) {
					openVipGateModal("wallpapers");
					return;
				}
				try {
					toast("info", "Loading Preview…", "Preparing your custom background.");
					draft = {
						type: "custom",
						id: "custom",
						dataUrl: await processImageFileToDataURL(file, 1080, .8),
						pos: 50,
						dim: 18
					};
					refreshPreviewUI();
				} catch (err) {
					toast("error", "Upload Failed", err.message || "Could not process image.");
				} finally {
					fileInput.value = "";
				}
			};
			el.querySelector("[data-x=\"cancel\"]").onclick = close;
			el.querySelector("[data-x=\"apply\"]").onclick = async () => {
				await saveChatWallpaper(draft);
				toast("success", "Background Applied", `${getDraftName(draft)} is now live in World & Admin Chat.`);
				close();
			};
		}
	});
}
var MAIL_EXPIRY_MS = 6048e5;
function getMailExpiryTs(m) {
	if (!m) return 0;
	if (Number(m.expiresAt || 0) > 0) return Number(m.expiresAt);
	const created = Number(m.createdAt || 0);
	return created > 0 ? created + MAIL_EXPIRY_MS : Date.now() + MAIL_EXPIRY_MS;
}
function isMailExpired(m, nowTs = Date.now()) {
	if (!m || m.status !== "unclaimed") return false;
	return nowTs >= getMailExpiryTs(m);
}
function formatMailCountdown(expiresAt, nowTs = Date.now()) {
	const diff = Math.max(0, Number(expiresAt || 0) - nowTs);
	if (diff <= 0) return {
		label: "Expired",
		urgent: true
	};
	const totalMins = Math.floor(diff / 6e4);
	const days = Math.floor(totalMins / 1440);
	const hours = Math.floor(totalMins % 1440 / 60);
	const mins = totalMins % 60;
	if (days >= 1) return {
		label: `${days}d ${hours}h left`,
		urgent: false
	};
	if (hours >= 1) return {
		label: `${hours}h ${mins}m left`,
		urgent: true
	};
	return {
		label: `${Math.max(1, mins)}m left`,
		urgent: true
	};
}
function purgeExpiredMailFromDb(uid, mail) {
	if (!uid || !mail || !mail.id) return;
	remove(ref(db, `users/${uid}/mailbox/${mail.id}`)).catch(() => {
		update(ref(db, `users/${uid}/mailbox/${mail.id}`), {
			deleted: true,
			expiredAt: Date.now()
		}).catch(() => {});
	});
	if (mail.id === "welcome_vip_7d") {
		update(ref(db, "users/" + uid), { welcomeVipMailExpired: true }).catch(() => {});
		if (State.profile) State.profile.welcomeVipMailExpired = true;
	}
}
function getCombinedMailboxItems() {
	const deletedLocal = new Set(State.localDeletedMails || []);
	const items = [];
	const seenKeys = /* @__PURE__ */ new Set();
	const nowTs = Date.now();
	const uid = State.user?.uid;
	(State.mailbox || []).forEach((m) => {
		if (!m || m.deleted || deletedLocal.has(m.id)) return;
		if (m.status === "unclaimed" && isMailExpired(m, nowTs)) {
			if (uid) purgeExpiredMailFromDb(uid, m);
			return;
		}
		seenKeys.add(m.id);
		items.push({
			...m,
			source: "mailbox",
			expiresAt: getMailExpiryTs(m)
		});
	});
	(State.transactions || []).forEach((tx) => {
		if (!tx || tx.type !== "admin_diamond_gift") return;
		const amt = Number(tx.diamonds || tx.amount || 0);
		if (amt <= 0) return;
		const mid = "tx_gift_" + tx.id;
		if (deletedLocal.has(mid) || seenKeys.has(mid)) return;
		items.push({
			id: mid,
			source: "history",
			type: "diamonds",
			title: "Diamond Gift from Admin",
			body: tx.note || `Admin gifted you ${amt.toLocaleString("en-IN")} Diamonds! Credited directly to your account.`,
			amount: amt,
			status: "received",
			sender: "Punjab Esports Admin",
			createdAt: Number(tx.createdAt || Date.now())
		});
	});
	items.sort((a, b) => {
		const aUn = a.status === "unclaimed" ? 1 : 0;
		const bUn = b.status === "unclaimed" ? 1 : 0;
		if (aUn !== bUn) return bUn - aUn;
		return Number(b.createdAt || 0) - Number(a.createdAt || 0);
	});
	return items;
}
function updateMailboxBadge() {
	const dot = $("#mailboxDot");
	if (!dot) return;
	const unclaimed = getCombinedMailboxItems().filter((m) => m.status === "unclaimed").length;
	dot.hidden = unclaimed === 0;
	dot.textContent = unclaimed > 9 ? "9+" : String(unclaimed);
}
async function ensureWelcomeVipMailbox(uid) {
	if (!uid || !State.profile) return;
	if (!!State.profile.hasUsedVipTrial || Number(State.profile.vipExpiry || 0) > 0) return;
	try {
		const mailRef = ref(db, `users/${uid}/mailbox/welcome_vip_7d`);
		const snap = await get(mailRef);
		let mailData = snap.exists() ? snap.val() : null;
		if (mailData && mailData.status === "unclaimed" && isMailExpired(mailData)) {
			purgeExpiredMailFromDb(uid, {
				id: "welcome_vip_7d",
				...mailData
			});
			return;
		}
		if (!mailData && !State.profile.welcomeVipMailDeleted && !State.profile.welcomeVipMailExpired) {
			const nowTs = Date.now();
			mailData = {
				id: "welcome_vip_7d",
				type: "vip_trial",
				title: "7-Day Free VIP Welcome Gift",
				body: "Welcome to Punjab Esports! Enjoy 7 Days of Free VIP — claim within 7 days from your Mailbox before this gift automatically expires.",
				days: 7,
				status: "unclaimed",
				sender: "Punjab Esports Team",
				createdAt: nowTs,
				expiresAt: nowTs + MAIL_EXPIRY_MS
			};
			await set(mailRef, mailData);
		}
		if (mailData && !mailData.deleted && mailData.status === "unclaimed" && !isMailExpired(mailData) && !State.shownWelcomeVipModal) {
			State.shownWelcomeVipModal = true;
			setTimeout(() => {
				if (!isVipActive() && !State.profile?.hasUsedVipTrial) openWelcomeVipClaimPopup(mailData);
			}, 650);
		}
	} catch (e) {
		console.warn("Welcome VIP mailbox check failed:", e);
	}
}
function openWelcomeVipClaimPopup(mail) {
	openModal({
		title: "Welcome Gift Waiting",
		extraClass: "vip-celeb-modal",
		bodyHTML: `
      <div class="vip-hero-stage" style="margin-bottom:12px;">
        <div class="vip-hero-aura"></div>
        <span class="vip-spark s1"></span><span class="vip-spark s2"></span><span class="vip-spark s3"></span>
        <div class="vip-hero-row">
          <div class="vip-emblem"><span class="vip-emblem-ring"></span><i class="fa-solid fa-gift"></i></div>
          <div style="min-width:0;flex:1;">
            <div class="vip-eyebrow">New Member Reward</div>
            <h2 class="vip-hero-title" style="font-size:1.14rem;">7-Day Free VIP Pass</h2>
            <p class="vip-hero-sub">Claim now, or keep it saved in your <b>Mailbox</b> — auto-expires in 7 days if unclaimed.</p>
          </div>
        </div>
      </div>
      <div class="vip-celeb-grid" style="margin-top:0;margin-bottom:10px;">
        <div class="vip-celeb-item"><div class="vip-celeb-ic" style="background:rgba(2,132,199,.12);color:#0284c7;"><i class="fa-solid fa-circle-check"></i></div><div><b>Blue Tick</b><small>Verified Badge</small></div></div>
        <div class="vip-celeb-item"><div class="vip-celeb-ic" style="background:rgba(16,185,129,.12);color:#10b981;"><i class="fa-solid fa-earth-asia"></i></div><div><b>World & Admin Chat</b><small>Full-Screen VIP</small></div></div>
        <div class="vip-celeb-item"><div class="vip-celeb-ic" style="background:rgba(217,119,6,.12);color:#d97706;"><i class="fa-solid fa-palette"></i></div><div><b>All 9 Themes</b><small>+ 10 HD Walls</small></div></div>
        <div class="vip-celeb-item"><div class="vip-celeb-ic" style="background:rgba(234,88,12,.12);color:#ea580c;"><i class="fa-solid fa-shield-halved"></i></div><div><b>Team Branding</b><small>Custom Logo</small></div></div>
      </div>
      <p style="font-size:.71rem;color:var(--txm);text-align:center;margin:0;line-height:1.42;">
        <i class="fa-regular fa-clock" style="color:var(--ac);"></i> Saved gifts stay in your <b style="color:var(--tx);">Mailbox</b> for <b style="color:var(--tx);">7 days</b>. Unclaimed gifts are removed automatically after 7 days.
      </p>
    `,
		footerHTML: `<button class="btn btn-outline" style="flex:0 0 auto;" data-x="later">Save in Mailbox</button><button class="btn vip-gold-btn" style="flex:1;" data-x="claim"><i class="fa-solid fa-gift"></i> Claim 7 Days VIP</button>`,
		onMount: (el, close) => {
			const mfoot = el.querySelector(".mfoot");
			if (mfoot) mfoot.classList.add("mfoot-row");
			el.querySelector("[data-x=\"later\"]").onclick = () => {
				close();
				toast("info", "Saved in Mailbox", "Claim within 7 days from the Mailbox icon before it expires.");
			};
			el.querySelector("[data-x=\"claim\"]").onclick = async () => {
				const btn = el.querySelector("[data-x=\"claim\"]");
				btn.disabled = true;
				btn.innerHTML = "<i class=\"fa-solid fa-spinner spin\"></i> Claiming…";
				const ok = await claimMailItem(mail);
				close();
				if (!ok) toast("error", "Claim Failed", "This gift may have expired or already been claimed.");
			};
		}
	});
}
async function claimMailItem(mail) {
	if (!State.user || !mail || mail.status !== "unclaimed") return false;
	const uid = State.user.uid;
	if (isMailExpired(mail)) {
		purgeExpiredMailFromDb(uid, mail);
		toast("warning", "Gift Expired", "This gift was not claimed within 7 days and has been removed.");
		updateMailboxBadge();
		return false;
	}
	const mailRef = ref(db, `users/${uid}/mailbox/${mail.id}`);
	try {
		let wasExpired = false;
		const lockRes = await runTransaction(mailRef, (cur) => {
			if (!cur || cur.status !== "unclaimed") return;
			if (isMailExpired(cur)) {
				wasExpired = true;
				return;
			}
			return {
				...cur,
				status: "claimed",
				claimedAt: Date.now()
			};
		});
		if (wasExpired) {
			purgeExpiredMailFromDb(uid, mail);
			toast("warning", "Gift Expired", "This gift expired after 7 days and was removed from your Mailbox.");
			updateMailboxBadge();
			return false;
		}
		if (!lockRes.committed) {
			toast("info", "Already Claimed", "This gift has already been claimed or removed.");
			return false;
		}
		const type = String(mail.type || "").toLowerCase();
		if (type === "vip_trial" || type === "vip") {
			const days = Math.max(1, Number(mail.days || 7));
			const addMs = days * 24 * 60 * 60 * 1e3;
			let finalExpiry = Date.now() + addMs;
			await runTransaction(ref(db, "users/" + uid), (cur) => {
				if (!cur) return cur;
				finalExpiry = Math.max(Date.now(), Number(cur.vipExpiry || 0)) + addMs;
				return {
					...cur,
					vipExpiry: finalExpiry,
					hasUsedVipTrial: type === "vip_trial" ? true : cur.hasUsedVipTrial || false
				};
			});
			if (State.profile) {
				State.profile.vipExpiry = finalExpiry;
				if (type === "vip_trial") State.profile.hasUsedVipTrial = true;
			}
			loadProfileUI();
			triggerVipCelebration(days, finalExpiry);
			return true;
		}
		if (type === "diamonds") {
			const amt = Math.max(0, Number(mail.amount || mail.diamonds || 0));
			if (amt > 0) {
				await runTransaction(ref(db, "users/" + uid + "/diamonds"), (cur) => (Number(cur) || 0) + amt);
				const txRef = push(ref(db, "walletTransactions"));
				await set(txRef, {
					id: txRef.key,
					userId: uid,
					type: "diamond_earn",
					amount: amt,
					diamonds: amt,
					currency: "DIAMONDS",
					note: mail.title || "Mailbox Diamond Gift",
					status: "completed",
					createdAt: Date.now()
				});
				toast("success", `+${amt.toLocaleString("en-IN")} 💎 Claimed!`, "Diamonds added to your account.");
				playNotifSound();
			}
			return true;
		}
		if (type === "wallet" || type === "rupees") {
			const amt = Math.max(0, Number(mail.amount || 0));
			if (amt > 0) {
				State.localWalletActionTs = Date.now();
				await runTransaction(ref(db, "wallets/" + uid + "/balance"), (cur) => Math.round(((Number(cur) || 0) + amt) * 100) / 100);
				const txRef = push(ref(db, "walletTransactions"));
				await set(txRef, {
					id: txRef.key,
					userId: uid,
					type: "reward",
					amount: amt,
					currency: "INR",
					note: mail.title || "Mailbox Gift Reward",
					status: "completed",
					createdAt: Date.now()
				});
				toast("success", `+${fmtMoney(amt)} Claimed!`, "Added to your wallet balance.");
				playNotifSound();
			}
			return true;
		}
		toast("success", "Mail Marked Read", "");
		return true;
	} catch (e) {
		console.warn("Mail claim error:", e);
		return false;
	}
}
async function deleteMailItem(mail) {
	if (!State.user || !mail) return;
	const uid = State.user.uid;
	if (mail.status === "unclaimed") {
		if (!await confirmDialog("Delete Unclaimed Gift?", "You have not claimed this gift yet. Delete it permanently?", true)) return;
	}
	if (mail.source === "mailbox") {
		await update(ref(db, `users/${uid}/mailbox/${mail.id}`), {
			deleted: true,
			deletedAt: Date.now()
		});
		if (mail.id === "welcome_vip_7d") await update(ref(db, "users/" + uid), { welcomeVipMailDeleted: true });
	} else if (!State.localDeletedMails.includes(mail.id)) {
		State.localDeletedMails.push(mail.id);
		try {
			localStorage.setItem("deleted_mails", JSON.stringify(State.localDeletedMails));
		} catch (e) {}
	}
	updateMailboxBadge();
}
function openMailbox() {
	let activeFilter = "all";
	let countdownTimer = null;
	const renderMailBody = (el, close) => {
		const allItems = getCombinedMailboxItems();
		const unclaimedCount = allItems.filter((m) => m.status === "unclaimed").length;
		const historyCount = allItems.filter((m) => m.status !== "unclaimed").length;
		const filtered = allItems.filter((m) => {
			if (activeFilter === "unclaimed") return m.status === "unclaimed";
			if (activeFilter === "claimed") return m.status !== "unclaimed";
			return true;
		});
		const listHost = el.querySelector("#mailListHost");
		const clearBtn = el.querySelector("#mailClearHistoryBtn");
		const claimAllBtn = el.querySelector("#mailClaimAllBtn");
		const summaryPill = el.querySelector("#mailSummaryPill");
		const ctAll = el.querySelector("#mailCtAll");
		const ctUn = el.querySelector("#mailCtUn");
		const ctHist = el.querySelector("#mailCtHist");
		if (summaryPill) summaryPill.textContent = unclaimedCount > 0 ? `${unclaimedCount} Pending` : "All Caught Up";
		if (ctAll) ctAll.textContent = String(allItems.length);
		if (ctUn) ctUn.textContent = String(unclaimedCount);
		if (ctHist) ctHist.textContent = String(historyCount);
		if (claimAllBtn) claimAllBtn.style.display = unclaimedCount > 1 ? "inline-flex" : "none";
		if (clearBtn) clearBtn.style.display = historyCount > 0 ? "inline-flex" : "none";
		if (!filtered.length) {
			listHost.innerHTML = `
        <div class="mail-empty">
          <i class="fa-solid fa-envelope-open-text"></i>
          <h4>${activeFilter === "unclaimed" ? "No pending gifts right now" : activeFilter === "claimed" ? "No claimed history yet" : "Your Mailbox is empty"}</h4>
          <p>VIP passes, Admin Diamond rewards & special gifts arrive here. Unclaimed gifts auto-expire after 7 days.</p>
        </div>`;
			return;
		}
		const nowTs = Date.now();
		listHost.innerHTML = `<div class="mail-list">${filtered.map((m) => {
			const t = String(m.type || "").toLowerCase();
			const icCls = t === "vip_trial" || t === "vip" ? "vip" : t === "diamonds" ? "dia" : t === "wallet" || t === "rupees" ? "wal" : "msg";
			const icFa = icCls === "vip" ? "fa-crown" : icCls === "dia" ? "fa-gem" : icCls === "wal" ? "fa-wallet" : "fa-envelope";
			const rewardTxt = icCls === "vip" ? `<i class="fa-solid fa-crown"></i> ${Number(m.days || 7)} ${Number(m.days || 7) === 1 ? "Day" : "Days"} VIP` : icCls === "dia" ? `<i class="fa-solid fa-gem"></i> +${Number(m.amount || m.diamonds || 0).toLocaleString("en-IN")} Diamonds` : icCls === "wal" ? `<i class="fa-solid fa-indian-rupee-sign"></i> +${fmtMoney(m.amount || 0)}` : `<i class="fa-solid fa-bell"></i> Notice`;
			const isUnclaimed = m.status === "unclaimed";
			const cd = isUnclaimed ? formatMailCountdown(getMailExpiryTs(m), nowTs) : null;
			return `
        <div class="mail-card ${isUnclaimed ? "unclaimed" : ""}" data-mailid="${esc(m.id)}">
          <div class="mail-card-top">
            <div class="mail-ic ${icCls}"><i class="fa-solid ${icFa}"></i></div>
            <div class="mail-meta">
              <div class="mail-title-row">
                <div class="mail-title">${esc(m.title || "Official Reward")}</div>
                ${isUnclaimed && cd ? `<span class="mail-expiry-chip ${cd.urgent ? "urgent" : ""}"><i class="fa-regular fa-clock"></i> ${cd.label}</span>` : ""}
              </div>
              <div class="mail-from">
                <span class="mail-sender-tag"><i class="fa-solid fa-shield-halved"></i> ${esc(m.sender || "Punjab Esports")}</span>
                <span>· ${fmtRelativeTime(m.createdAt)}</span>
              </div>
            </div>
          </div>
          ${m.body ? `<div class="mail-body">${esc(m.body)}</div>` : ""}
          <div class="mail-foot">
            <span class="mail-reward-pill ${icCls}">${rewardTxt}</span>
            <div class="mail-actions">
              ${isUnclaimed ? `<button type="button" class="mail-claim-btn" data-claim="${esc(m.id)}"><i class="fa-solid fa-gift"></i> Claim</button>` : `<span class="mail-claimed-tag"><i class="fa-solid fa-check"></i> ${m.status === "received" ? "Received" : "Claimed"}</span>`}
              <button type="button" class="mail-del-btn" data-del="${esc(m.id)}" title="Delete from mailbox"><i class="fa-solid fa-trash"></i></button>
            </div>
          </div>
        </div>`;
		}).join("")}</div>`;
		listHost.querySelectorAll("[data-claim]").forEach((btn) => {
			btn.onclick = async () => {
				const target = allItems.find((x) => x.id === btn.dataset.claim);
				if (!target) return;
				btn.disabled = true;
				btn.innerHTML = "<i class=\"fa-solid fa-spinner spin\"></i>";
				if (await claimMailItem(target) && (target.type === "vip_trial" || target.type === "vip")) close();
				else renderMailBody(el, close);
			};
		});
		listHost.querySelectorAll("[data-del]").forEach((btn) => {
			btn.onclick = async () => {
				const target = allItems.find((x) => x.id === btn.dataset.del);
				if (!target) return;
				await deleteMailItem(target);
				renderMailBody(el, close);
			};
		});
	};
	openModal({
		title: `<i class="fa-solid fa-envelope-open-text" style="color:var(--ac);"></i><span>Player Mailbox</span>`,
		extraClass: "mail-modal",
		bodyHTML: `
      <div class="mail-summary-strip">
        <div class="mail-summary-left">
          <div class="mail-summary-ic"><i class="fa-solid fa-inbox"></i></div>
          <div style="min-width:0;">
            <div class="mail-summary-title">Rewards & Official Gifts</div>
            <div class="mail-summary-sub">Unclaimed items auto-remove after 7 days</div>
          </div>
        </div>
        <span class="mail-summary-pill" id="mailSummaryPill">0 Pending</span>
      </div>
      <div class="mail-tabs" id="mailFilterBar">
        <button type="button" class="mail-tab active" data-mf="all">All <span class="mail-tab-ct" id="mailCtAll">0</span></button>
        <button type="button" class="mail-tab" data-mf="unclaimed">Pending <span class="mail-tab-ct" id="mailCtUn">0</span></button>
        <button type="button" class="mail-tab" data-mf="claimed">History <span class="mail-tab-ct" id="mailCtHist">0</span></button>
      </div>
      <div id="mailListHost"></div>
    `,
		footerHTML: `
      <button class="btn btn-outline btn-sm" id="mailClearHistoryBtn" style="display:none;"><i class="fa-solid fa-broom"></i> Clear History</button>
      <button class="btn btn-primary btn-sm" id="mailClaimAllBtn" style="display:none;"><i class="fa-solid fa-gift"></i> Claim All</button>
      <button class="btn btn-ghost btn-sm" data-x="close">Close</button>
    `,
		onMount: (el, close) => {
			const mfoot = el.querySelector(".mfoot");
			if (mfoot) mfoot.classList.add("mfoot-row");
			const wrappedClose = () => {
				if (countdownTimer) {
					clearInterval(countdownTimer);
					countdownTimer = null;
				}
				close();
			};
			el.querySelector("[data-x=\"close\"]").onclick = wrappedClose;
			el.querySelectorAll("[data-mf]").forEach((tab) => {
				tab.onclick = () => {
					activeFilter = tab.dataset.mf;
					el.querySelectorAll("[data-mf]").forEach((t) => t.classList.remove("active"));
					tab.classList.add("active");
					renderMailBody(el, wrappedClose);
				};
			});
			el.querySelector("#mailClaimAllBtn").onclick = async () => {
				const pending = getCombinedMailboxItems().filter((m) => m.status === "unclaimed");
				let claimedVip = false;
				for (const item of pending) if (await claimMailItem(item) && (item.type === "vip_trial" || item.type === "vip")) claimedVip = true;
				if (claimedVip) wrappedClose();
				else renderMailBody(el, wrappedClose);
			};
			el.querySelector("#mailClearHistoryBtn").onclick = async () => {
				const hist = getCombinedMailboxItems().filter((m) => m.status !== "unclaimed");
				if (!hist.length) return;
				if (!await confirmDialog("Clear Mailbox History", `Remove ${hist.length} claimed/received item${hist.length > 1 ? "s" : ""} from your mailbox?`, true)) return;
				for (const item of hist) if (item.source === "mailbox") await update(ref(db, `users/${State.user.uid}/mailbox/${item.id}`), {
					deleted: true,
					deletedAt: Date.now()
				});
				else if (!State.localDeletedMails.includes(item.id)) State.localDeletedMails.push(item.id);
				try {
					localStorage.setItem("deleted_mails", JSON.stringify(State.localDeletedMails));
				} catch (e) {}
				updateMailboxBadge();
				renderMailBody(el, wrappedClose);
				toast("success", "Mailbox History Cleared", "Pending gifts remain safe.");
			};
			renderMailBody(el, wrappedClose);
			countdownTimer = setInterval(() => {
				if (!document.body.contains(el)) {
					clearInterval(countdownTimer);
					countdownTimer = null;
					return;
				}
				renderMailBody(el, wrappedClose);
			}, 3e4);
		}
	});
}
var CHAT_EMOJIS = [
	"😀",
	"😃",
	"😄",
	"😁",
	"😆",
	"😅",
	"😂",
	"🤣",
	"😊",
	"😇",
	"🙂",
	"😉",
	"😌",
	"😍",
	"🥰",
	"😘",
	"😋",
	"😛",
	"😜",
	"🤪",
	"😎",
	"🤩",
	"🥳",
	"😏",
	"😒",
	"😔",
	"🥺",
	"😢",
	"😭",
	"😤",
	"😠",
	"😡",
	"🤯",
	"😳",
	"😱",
	"🤗",
	"🤔",
	"🤫",
	"😶",
	"🙄",
	"😴",
	"😈",
	"💀",
	"👻",
	"🔥",
	"⚡",
	"🏆",
	"🥇",
	"💎",
	"👑",
	"🎯",
	"🎮",
	"💪",
	"👏",
	"🙌",
	"🤝",
	"🙏",
	"👍",
	"👎",
	"✌️",
	"🤞",
	"❤️",
	"💯"
];
function openWorldChat() {
	if (!isVipActive()) {
		openVipGateModal("worldchat");
		return;
	}
	openModal({
		title: "World Chat",
		extraClass: "chat-modal chat-full-modal",
		bodyHTML: `
      <div class="chat-topbar">
        <button type="button" class="chat-back-btn" id="wcBackBtn" aria-label="Back"><i class="fa-solid fa-arrow-left"></i></button>
        <div class="chat-room-av world"><i class="fa-solid fa-earth-asia"></i></div>
        <div class="chat-room-meta">
          <b>World Chat</b>
          <small><span class="live-dot"></span> Live Global Room</small>
        </div>
        <div class="chat-hd-actions">
          <button type="button" class="chat-hd-btn" id="wcWallpaperBtn" title="Chat Background"><i class="fa-solid fa-image"></i></button>
          <button type="button" class="chat-hd-btn danger" id="clearMyChatBtn" title="Clear Chat"><i class="fa-solid fa-trash"></i></button>
        </div>
      </div>

      <div class="chat-subbar">
        <span class="chat-subbar-info"><i class="fa-solid fa-shield-halved" style="color:var(--ac2);"></i> Need help from Admin?</span>
        <button type="button" class="chat-switch-pill" id="switchToDmBtn">
          <i class="fa-solid fa-headset"></i> <span>Admin Chat</span> <i class="fa-solid fa-chevron-right" style="font-size:.62rem;"></i>
        </button>
      </div>

      <div class="chat-canvas-wrap" id="wcCanvasWrap">
        <div id="chatMessages"></div>
      </div>

      <div class="chat-composer-bar">
        <div class="chat-input-area">
          <button type="button" class="emoji-btn-chat" id="chatEmojiBtn" aria-label="Emoji"><i class="fa-regular fa-face-smile"></i></button>
          <input type="text" id="chatInput" class="input" placeholder="Message World Chat…" maxlength="140">
          <button type="button" class="btn btn-primary" id="sendChatBtn" aria-label="Send"><i class="fa-solid fa-paper-plane"></i></button>
          <div class="emoji-picker-popup" id="chatEmojiPicker"></div>
        </div>
      </div>
    `,
		onMount: (el, close) => {
			applyWallpaperStyleToEl(el.querySelector("#wcCanvasWrap"), getEffectiveChatWallpaper());
			renderChatMessages();
			el.querySelector("#wcBackBtn").onclick = () => close();
			el.querySelector("#wcWallpaperBtn").onclick = () => openChatWallpaperPicker();
			const emojiBtn = el.querySelector("#chatEmojiBtn");
			const emojiPicker = el.querySelector("#chatEmojiPicker");
			const input = el.querySelector("#chatInput");
			emojiPicker.innerHTML = CHAT_EMOJIS.map((e) => `<span style="font-size:1.45rem;cursor:pointer;padding:4px;text-align:center;" data-emoji="${e}">${e}</span>`).join("");
			emojiBtn.onclick = (e) => {
				e.stopPropagation();
				emojiPicker.classList.toggle("show");
			};
			const closeEmoji = (e) => {
				if (!emojiBtn.contains(e.target) && !emojiPicker.contains(e.target)) emojiPicker.classList.remove("show");
			};
			el.addEventListener("click", closeEmoji);
			emojiPicker.querySelectorAll("[data-emoji]").forEach((sp) => {
				sp.onclick = () => {
					input.value += sp.dataset.emoji;
					input.focus();
					emojiPicker.classList.remove("show");
				};
			});
			const sendFn = async () => {
				if (!isVipActive()) {
					close();
					openVipGateModal("worldchat");
					return;
				}
				const text = input.value.trim();
				if (!text) return;
				input.value = "";
				const msgRef = push(ref(db, "worldChat"));
				const newMsg = {
					id: msgRef.key,
					userId: State.user.uid,
					userName: State.profile.displayName,
					userVip: isVipActive(),
					text,
					createdAt: Date.now(),
					deleted: false
				};
				State.chatMessages.push(newMsg);
				renderChatMessages();
				try {
					await set(msgRef, newMsg);
				} catch (e) {
					State.chatMessages = State.chatMessages.filter((m) => m.id !== newMsg.id);
					renderChatMessages();
					toast("error", "Failed to send", "");
				}
			};
			el.querySelector("#sendChatBtn").onclick = sendFn;
			input.onkeydown = (e) => {
				if (e.key === "Enter") sendFn();
			};
			el.querySelector("#clearMyChatBtn").onclick = async () => {
				if (!await confirmDialog("Clear Chat", "Clear all messages from your view?")) return;
				State.localDeletedChats = State.chatMessages.map((m) => m.id);
				localStorage.setItem("deleted_chats", JSON.stringify(State.localDeletedChats));
				renderChatMessages();
				toast("info", "Chat Cleared", "");
			};
			el.querySelector("#switchToDmBtn").onclick = () => {
				close();
				setTimeout(() => openAdminDM(), 120);
			};
		}
	});
}
function renderChatMessages() {
	const host = $("#chatMessages");
	if (!host) return;
	const fiveDaysAgo = Date.now() - 432e6;
	const validMsgs = State.chatMessages.filter((m) => m.createdAt > fiveDaysAgo && !State.localDeletedChats.includes(m.id));
	if (!validMsgs.length) {
		host.innerHTML = `<div class="chat-empty-hint"><i class="fa-solid fa-comments" style="font-size:1.5rem;margin-bottom:6px;display:block;opacity:.65;"></i>No messages yet. Say hi to Punjab Esports players!</div>`;
		return;
	}
	host.innerHTML = validMsgs.map((m) => {
		const isMine = m.userId === State.user.uid;
		const isAdminMsg = !isMine && (m.isAdmin === true || m.role === "admin" || m.from === "admin" || m.userId === "admin" || /^admin\b/i.test(String(m.userName || "").trim()) || /punjab esports admin/i.test(String(m.userName || "")));
		const headerHTML = isAdminMsg ? `<span class="admin-logo-crest"><i class="fa-solid fa-crown"></i></span><span class="admin-name-txt">${esc(m.userName || "Punjab Esports")}</span><span class="admin-role-pill"><i class="fa-solid fa-shield-halved"></i> ADMIN</span>` : `<span>${isMine ? "You" : esc(m.userName)}</span>${m.userVip ? "<i class=\"fa-solid fa-circle-check blue-tick\"></i>" : ""}`;
		return `<div class="chat-msg ${isMine ? "mine" : ""} ${isAdminMsg ? "admin-msg" : ""}" data-id="${m.id}" data-text="${esc(m.text)}" data-mine="${isMine}">
      <div class="chat-msg-header">${headerHTML}</div>
      <div class="chat-msg-text">${esc(m.text)} ${m.isEdited ? "<span style=\"font-size:0.65rem;opacity:.75;\">(edited)</span>" : ""}</div>
      <div class="chat-msg-time">${fmtTimeOnly(m.createdAt)}</div>
    </div>`;
	}).join("");
	host.querySelectorAll(".chat-msg.mine").forEach((msgEl) => {
		let pressTimer;
		const startPress = () => {
			pressTimer = setTimeout(() => showMsgOptions(msgEl.dataset.id, msgEl.dataset.text, false), 550);
		};
		const cancelPress = () => clearTimeout(pressTimer);
		msgEl.addEventListener("mousedown", startPress);
		msgEl.addEventListener("touchstart", startPress, { passive: true });
		msgEl.addEventListener("mouseup", cancelPress);
		msgEl.addEventListener("mouseleave", cancelPress);
		msgEl.addEventListener("touchend", cancelPress);
		msgEl.addEventListener("touchmove", cancelPress, { passive: true });
	});
	host.scrollTop = host.scrollHeight;
}
async function openAdminDM() {
	if (!isVipActive()) {
		openVipGateModal("admindm");
		return;
	}
	const uid = State.user.uid;
	const dmRef = ref(db, "adminMessages/" + uid);
	openModal({
		title: "Direct Admin Chat",
		extraClass: "dm-modal chat-full-modal",
		bodyHTML: `
      <div class="chat-topbar">
        <button type="button" class="chat-back-btn" id="dmBackBtn" aria-label="Back"><i class="fa-solid fa-arrow-left"></i></button>
        <div class="chat-room-av admin"><i class="fa-solid fa-headset"></i></div>
        <div class="chat-room-meta">
          <b>Direct Admin Support <i class="fa-solid fa-circle-check blue-tick" style="font-size:.78rem;"></i></b>
          <small><span class="live-dot"></span> Priority VIP Support</small>
        </div>
        <div class="chat-hd-actions">
          <button type="button" class="chat-hd-btn" id="dmWallpaperBtn" title="Chat Background"><i class="fa-solid fa-image"></i></button>
        </div>
      </div>

      <div class="chat-subbar">
        <span class="chat-subbar-info"><i class="fa-solid fa-lock" style="color:#6366f1;"></i> Private chat with Admin</span>
        <button type="button" class="chat-switch-pill to-world" id="switchToWorldBtn">
          <i class="fa-solid fa-earth-asia"></i> <span>World Chat</span> <i class="fa-solid fa-chevron-right" style="font-size:.62rem;"></i>
        </button>
      </div>

      <div class="chat-canvas-wrap" id="dmCanvasWrap">
        <div id="dmMessages"></div>
      </div>

      <div class="chat-composer-bar">
        <div class="chat-input-area">
          <button type="button" class="emoji-btn-chat" id="dmEmojiBtn" aria-label="Emoji"><i class="fa-regular fa-face-smile"></i></button>
          <input type="text" id="dmInput" class="input" placeholder="Write to Admin…" maxlength="300">
          <button type="button" class="btn btn-primary" id="dmSendBtn" aria-label="Send"><i class="fa-solid fa-paper-plane"></i></button>
          <div class="emoji-picker-popup" id="dmEmojiPicker"></div>
        </div>
      </div>
    `,
		onMount: (el, close) => {
			applyWallpaperStyleToEl(el.querySelector("#dmCanvasWrap"), getEffectiveChatWallpaper());
			const msgsHost = el.querySelector("#dmMessages");
			const emojiBtn = el.querySelector("#dmEmojiBtn");
			const emojiPicker = el.querySelector("#dmEmojiPicker");
			const input = el.querySelector("#dmInput");
			el.querySelector("#dmBackBtn").onclick = () => close();
			el.querySelector("#dmWallpaperBtn").onclick = () => openChatWallpaperPicker();
			el.querySelector("#switchToWorldBtn").onclick = () => {
				close();
				setTimeout(() => openWorldChat(), 120);
			};
			emojiPicker.innerHTML = CHAT_EMOJIS.map((e) => `<span style="font-size:1.45rem;cursor:pointer;padding:4px;text-align:center;" data-emoji="${e}">${e}</span>`).join("");
			emojiBtn.onclick = (e) => {
				e.stopPropagation();
				emojiPicker.classList.toggle("show");
			};
			el.addEventListener("click", (e) => {
				if (!emojiBtn.contains(e.target) && !emojiPicker.contains(e.target)) emojiPicker.classList.remove("show");
			});
			emojiPicker.querySelectorAll("[data-emoji]").forEach((sp) => {
				sp.onclick = () => {
					input.value += sp.dataset.emoji;
					input.focus();
					emojiPicker.classList.remove("show");
				};
			});
			const fiveDaysAgo = Date.now() - 432e6;
			State.dmListener = onValue(dmRef, (snap) => {
				let messages = [];
				if (snap.exists()) {
					const v = snap.val();
					Object.keys(v).forEach((k) => {
						if (isObj(v[k]) && !v[k].deleted && v[k].createdAt > fiveDaysAgo) messages.push({
							id: k,
							...v[k]
						});
					});
				}
				messages.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
				if (!messages.length) {
					msgsHost.innerHTML = `<div class="chat-empty-hint"><i class="fa-solid fa-headset" style="font-size:1.5rem;margin-bottom:6px;display:block;opacity:.65;"></i>Message Punjab Esports Admin directly here. Replies appear live in this chat.</div>`;
					return;
				}
				msgsHost.innerHTML = messages.map((m) => {
					const fromMe = m.from === "user";
					const isAdminReply = !fromMe;
					const headerHTML = fromMe ? `<span>You</span>` : `<span class="admin-logo-crest"><i class="fa-solid fa-crown"></i></span><span class="admin-name-txt">Official Admin</span><span class="admin-role-pill"><i class="fa-solid fa-shield-halved"></i> ADMIN</span>`;
					return `<div class="chat-msg ${fromMe ? "mine" : ""} ${isAdminReply ? "admin-msg" : ""}" data-id="${m.id}" data-text="${esc(m.text)}" data-mine="${fromMe}">
            <div class="chat-msg-header">${headerHTML}</div>
            <div class="chat-msg-text">${esc(m.text)} ${m.isEdited ? "<span style=\"font-size:0.65rem;opacity:.75;\">(edited)</span>" : ""}</div>
            <div class="chat-msg-time">${fmtTimeOnly(m.createdAt)}</div>
          </div>`;
				}).join("");
				msgsHost.querySelectorAll(".chat-msg.mine").forEach((msgEl) => {
					let pressTimer;
					const startPress = () => {
						pressTimer = setTimeout(() => showMsgOptions(msgEl.dataset.id, msgEl.dataset.text, true), 550);
					};
					const cancelPress = () => clearTimeout(pressTimer);
					msgEl.addEventListener("mousedown", startPress);
					msgEl.addEventListener("touchstart", startPress, { passive: true });
					msgEl.addEventListener("mouseup", cancelPress);
					msgEl.addEventListener("mouseleave", cancelPress);
					msgEl.addEventListener("touchend", cancelPress);
					msgEl.addEventListener("touchmove", cancelPress, { passive: true });
				});
				msgsHost.scrollTop = msgsHost.scrollHeight;
			});
			const sendFn = async () => {
				if (!isVipActive()) {
					close();
					openVipGateModal("admindm");
					return;
				}
				const text = input.value.trim();
				if (!text) return;
				input.value = "";
				const pushRef = push(dmRef);
				const tempMsg = {
					id: pushRef.key,
					text,
					from: "user",
					userId: uid,
					userName: State.profile.displayName,
					createdAt: Date.now()
				};
				try {
					await set(pushRef, tempMsg);
					const txRef = push(ref(db, "notifications/" + uid));
					await set(txRef, {
						id: txRef.key,
						type: "admin_dm",
						title: "Message sent to Admin",
						body: text,
						read: false,
						createdAt: Date.now()
					});
				} catch (e) {
					toast("error", "Failed", e.message);
				}
			};
			el.querySelector("#dmSendBtn").onclick = sendFn;
			input.onkeydown = (e) => {
				if (e.key === "Enter") sendFn();
			};
		}
	});
}
window.currentEditingMsg = null;
window.showMsgOptions = (id, text, isDm) => {
	window.currentEditingMsg = {
		id,
		text,
		isDm
	};
	const closeBtnId = "closeMsgOpt_" + Date.now();
	openModal({
		title: "Message Options",
		bodyHTML: `
       <div style="display:flex; flex-direction:column; gap:10px;">
         <button class="btn btn-outline" style="justify-content:flex-start;" id="editMsgBtn"><i class="fa-solid fa-pen"></i> Edit Message</button>
         <button class="btn btn-danger" style="justify-content:flex-start;" id="deleteMsgBtn"><i class="fa-solid fa-trash"></i> Delete for Everyone</button>
       </div>
    `,
		footerHTML: `<button class="btn btn-ghost w-100" id="${closeBtnId}" data-x="c">Cancel</button>`,
		onMount: (el, close) => {
			el.querySelector(`#${closeBtnId}`).onclick = close;
			el.querySelector("#editMsgBtn").onclick = () => {
				close();
				setTimeout(() => window.editChatMsg(), 100);
			};
			el.querySelector("#deleteMsgBtn").onclick = () => {
				close();
				setTimeout(() => window.deleteChatMsg(), 100);
			};
		}
	});
};
window.editChatMsg = () => {
	const { id, text, isDm } = window.currentEditingMsg;
	if (!id) return;
	openModal({
		title: "Edit Message",
		bodyHTML: `<div class="field"><label>New Message</label><input type="text" id="editMsgInput" class="input" value="${esc(text)}" maxlength="100"></div>`,
		footerHTML: `<button class="btn btn-ghost" data-x="c">Cancel</button><button class="btn btn-primary" data-x="ok">Save</button>`,
		onMount: (el, close) => {
			el.querySelector("[data-x=\"c\"]").onclick = close;
			el.querySelector("[data-x=\"ok\"]").onclick = async () => {
				const newText = el.querySelector("#editMsgInput").value.trim();
				if (!newText) return;
				const path = isDm ? `adminMessages/${State.user.uid}/${id}` : `worldChat/${id}`;
				await update(ref(db, path), {
					text: newText,
					isEdited: true
				});
				if (!isDm) {
					const msg = State.chatMessages.find((m) => m.id === id);
					if (msg) {
						msg.text = newText;
						msg.isEdited = true;
						renderChatMessages();
					}
				}
				toast("success", "Edited", "Message updated");
				close();
			};
		}
	});
};
window.deleteChatMsg = async () => {
	const { id, isDm } = window.currentEditingMsg;
	if (!id) return;
	if (!await confirmDialog("Delete Message", "This will remove the message for everyone.", true)) return;
	const path = isDm ? `adminMessages/${State.user.uid}/${id}` : `worldChat/${id}`;
	await update(ref(db, path), { deleted: true });
	toast("success", "Deleted", "Message removed.");
};
function openNotifications() {
	const list = State.notifications || [];
	const unread = list.filter((n) => !n.read).length;
	const getGroupBucket = (ts) => {
		const t = Number(ts || 0);
		if (!t) return "Earlier";
		const d = new Date(t);
		const now = /* @__PURE__ */ new Date();
		const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
		const startYesterday = startToday - 864e5;
		if (d.getTime() >= startToday) return "Today";
		if (d.getTime() >= startYesterday) return "Yesterday";
		return "Earlier";
	};
	const renderFilteredList = (filterKey) => {
		const filtered = list.filter((n) => {
			if (filterKey === "unread") return !n.read;
			if (filterKey === "wallet") {
				const m = getNotifMeta(n.type, n.title, n.body);
				return [
					"diamond",
					"balance",
					"deposit",
					"withdraw",
					"vip"
				].includes(m.cls);
			}
			if (filterKey === "matches") {
				const m = getNotifMeta(n.type, n.title, n.body);
				return [
					"registration",
					"reward",
					"team",
					"reject"
				].includes(m.cls) || !!n.matchId;
			}
			return true;
		});
		if (!filtered.length) return `<div class="notif-empty"><i class="fa-regular fa-bell-slash"></i><h4>${filterKey === "unread" ? "All caught up!" : "No notifications here"}</h4><p>Updates about wallet, diamonds, VIP, matches & support appear here.</p></div>`;
		const groups = {
			Today: [],
			Yesterday: [],
			Earlier: []
		};
		filtered.forEach((n) => groups[getGroupBucket(n.createdAt)].push(n));
		let out = "";
		[
			"Today",
			"Yesterday",
			"Earlier"
		].forEach((g) => {
			if (groups[g].length) {
				out += `<div class="notif-group-lbl"><span>${g}</span><span>${groups[g].length}</span></div>`;
				out += `<div class="notif-list">` + groups[g].map(notifItemHTML).join("") + `</div>`;
			}
		});
		return out;
	};
	openModal({
		title: `Notifications${unread ? ` <span class="notif-header-count">${unread} new</span>` : ""}`,
		bodyHTML: `
    <div id="nativeNotifPermMount"></div>
    ${list.length ? `
    <div class="notif-filter-bar">
      <button type="button" class="notif-ftab active" data-nf="all">All (${list.length})</button>
      ${unread ? `<button type="button" class="notif-ftab" data-nf="unread">Unread (${unread})</button>` : ""}
      <button type="button" class="notif-ftab" data-nf="wallet">Wallet & VIP</button>
      <button type="button" class="notif-ftab" data-nf="matches">Matches & Squad</button>
    </div>
    <div id="notifListMount">${renderFilteredList("all")}</div>
  ` : `<div class="notif-empty"><i class="fa-regular fa-bell-slash"></i><h4>No notifications yet</h4><p>Updates about matches, rewards, wallet & VIP will appear here.</p></div>`}`,
		extraClass: "notif-modal",
		footerHTML: `
      <div style="display:flex; gap:8px; width:100%; flex-direction:column;">
        ${list.length > 0 || unread > 0 ? `<div style="display:flex; gap:8px; width:100%;">
          ${list.length > 0 ? `<button class="btn btn-danger" style="flex:1; min-height:36px; font-size:0.77rem; padding:6px 10px;" id="clearAllNotifsBtn"><i class="fa-solid fa-trash"></i> Clear All</button>` : ""}
          ${unread > 0 ? `<button class="btn btn-success" style="flex:1; min-height:36px; font-size:0.77rem; padding:6px 10px;" id="markAllReadBtn"><i class="fa-solid fa-check-double"></i> Mark Read</button>` : ""}
        </div>` : ""}
        <button class="btn btn-primary" style="width:100%; min-height:38px; font-size:0.84rem;" data-x="close">Close</button>
      </div>
    `,
		onMount: (el, close) => {
			const cb = el.querySelector("[data-x=\"close\"]");
			if (cb) cb.onclick = close;
			const nativePlugin = getNativeNotifPlugin();
			const permMount = el.querySelector("#nativeNotifPermMount");
			if (nativePlugin && permMount) nativePlugin.getStatus().then((st) => {
				if (st && !st.notificationsEnabled) {
					permMount.innerHTML = `
              <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;padding:10px 12px;margin-bottom:10px;border-radius:12px;background:var(--sf2);border:1px solid var(--bd);">
                <div style="display:flex;align-items:center;gap:9px;min-width:0;">
                  <i class="fa-solid fa-bell" style="color:var(--ac);font-size:.95rem;flex-shrink:0;"></i>
                  <div style="min-width:0;">
                    <div style="font-size:.78rem;font-weight:800;color:var(--tx);line-height:1.2;">Phone Notifications Off</div>
                    <div style="font-size:.69rem;color:var(--txm);line-height:1.25;">Allow notifications to get alerts even when the app is closed.</div>
                  </div>
                </div>
                <button type="button" class="btn btn-primary" id="enableNativeNotifBtn" style="min-height:32px;padding:4px 12px;font-size:.73rem;flex-shrink:0;">Enable</button>
              </div>
            `;
					const enableBtn = permMount.querySelector("#enableNativeNotifBtn");
					if (enableBtn) enableBtn.onclick = async () => {
						await nativePlugin.requestPermission().catch(() => {});
						setTimeout(async () => {
							if ((await nativePlugin.getStatus().catch(() => null))?.notificationsEnabled) {
								permMount.innerHTML = "";
								toast("success", "Notifications Enabled", "You will now receive alerts even when the app is closed.");
							}
						}, 800);
					};
				}
			}).catch(() => {});
			const bindNotifClicks = () => {
				el.querySelectorAll(".notif-item").forEach((item) => {
					item.onclick = async () => {
						const id = item.dataset.notifId;
						const notif = list.find((n) => n.id === id);
						if (!id) return;
						try {
							await update(ref(db, "notifications/" + State.user.uid + "/" + id), { read: true });
						} catch (e) {}
						if (notif) notif.read = true;
						item.classList.remove("unread");
						const dot = item.querySelector(".notif-unread-dot");
						if (dot) dot.remove();
						if (notif && notif.matchId) {
							close();
							setTimeout(() => openMatchDetails(notif.matchId), 240);
						} else if (notif && notif.type === "admin_dm") {
							close();
							setTimeout(() => openAdminDM(), 240);
						} else if (notif && (notif.type === "team_invite" || String(notif.type || "").includes("team"))) {
							close();
							setTimeout(() => {
								navigate("mymatches");
								switchMyTab("team");
							}, 240);
						} else if (notif && (String(notif.type || "").includes("vip") || String(notif.title || "").toLowerCase().includes("vip"))) {
							close();
							setTimeout(() => openVipStore(), 240);
						}
					};
				});
			};
			bindNotifClicks();
			el.querySelectorAll(".notif-ftab").forEach((tab) => {
				tab.onclick = () => {
					el.querySelectorAll(".notif-ftab").forEach((t) => t.classList.remove("active"));
					tab.classList.add("active");
					const mount = el.querySelector("#notifListMount");
					if (mount) {
						mount.innerHTML = renderFilteredList(tab.dataset.nf);
						bindNotifClicks();
					}
				};
			});
			const clearBtn = el.querySelector("#clearAllNotifsBtn");
			if (clearBtn) clearBtn.onclick = async () => {
				if (!await confirmDialog("Clear All", "Delete all notifications?", true)) return;
				try {
					await remove(ref(db, "notifications/" + State.user.uid));
					toast("success", "Cleared", "All notifications removed.");
					close();
				} catch (e) {
					toast("error", "Failed", "");
				}
			};
			const markBtn = el.querySelector("#markAllReadBtn");
			if (markBtn) markBtn.onclick = async () => {
				const updates = {};
				list.filter((n) => !n.read).forEach((n) => {
					updates["notifications/" + State.user.uid + "/" + n.id + "/read"] = true;
				});
				if (Object.keys(updates).length) await update(ref(db), updates);
				toast("success", "All Caught Up", "Marked all notifications as read.");
				close();
			};
		}
	});
}
function extractNotifValueChip(n, meta) {
	const txt = `${n.title || ""} ${n.body || ""}`;
	const lower = txt.toLowerCase();
	const rupeeMatch = txt.match(/₹\s*(\d+(?:\.\d+)?)/);
	if (rupeeMatch) {
		const isNeg = /deduct|debit|withdraw|fee|paid|minus|sent/.test(lower) && !/refund|credit|added|received|won|bonus/.test(lower);
		return `<span class="notif-val-chip ${isNeg ? "neg" : "pos"}">${isNeg ? "-" : "+"}₹${rupeeMatch[1]}</span>`;
	}
	const diaMatch = txt.match(/(\d+(?:,\d+)*)\s*diamond/i);
	if (diaMatch) {
		const isNeg = /deduct|spent|removed/.test(lower);
		return `<span class="notif-val-chip ${isNeg ? "neg" : "dia"}"><i class="fa-solid fa-gem"></i> ${isNeg ? "-" : "+"}${diaMatch[1]}</span>`;
	}
	if (meta.cls === "vip") {
		const dayMatch = txt.match(/(\d+)\s*day/i);
		if (dayMatch) return `<span class="notif-val-chip vip"><i class="fa-solid fa-crown"></i> ${dayMatch[1]}D VIP</span>`;
	}
	return "";
}
function notifItemHTML(n) {
	const meta = getNotifMeta(n.type, n.title, n.body);
	const unread = !n.read;
	const cleanTitle = String(n.title || "Notification").replace(/^[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\s]+/u, "").trim() || "Notification";
	const valChip = extractNotifValueChip(n, meta);
	let cue = "";
	if (n.matchId) cue = `<span class="notif-action-cue">View Match <i class="fa-solid fa-chevron-right"></i></span>`;
	else if (n.type === "admin_dm") cue = `<span class="notif-action-cue">Open Chat <i class="fa-solid fa-chevron-right"></i></span>`;
	else if (n.type === "team_invite" || String(n.type || "").includes("team")) cue = `<span class="notif-action-cue">View Squad <i class="fa-solid fa-chevron-right"></i></span>`;
	else if (meta.cls === "vip") cue = `<span class="notif-action-cue">VIP Store <i class="fa-solid fa-chevron-right"></i></span>`;
	return `<div class="notif-item ${unread ? "unread" : ""}" data-notif-id="${esc(n.id || "")}">
    <div class="notif-icon ${meta.cls}"><i class="fa-solid ${meta.icon}"></i></div>
    <div class="notif-content">
      <div class="notif-top-meta">
        <span class="notif-cat c-${meta.cls}">${meta.label}</span>
        <span class="notif-time-wrap">${esc(fmtRelativeTime(n.createdAt))}${unread ? " <span class=\"notif-unread-dot\"></span>" : ""}</span>
      </div>
      <div class="notif-title">${esc(cleanTitle)}</div>
      ${n.body ? `<div class="notif-body">${esc(n.body)}</div>` : ""}
      ${valChip || cue ? `<div class="notif-foot-row">${valChip}${cue}</div>` : ""}
    </div>
  </div>`;
}
function getNotifMeta(type, title, body = "") {
	const t = String(type || "").toLowerCase();
	const T = String(title || "").toLowerCase();
	const all = `${t} ${T} ${String(body || "").toLowerCase()}`;
	if (all.includes("diamond") || all.includes("💎")) return {
		cls: "diamond",
		icon: "fa-gem",
		label: "Diamonds"
	};
	if (t.includes("vip") || T.includes("vip") || T.includes("premium")) return {
		cls: "vip",
		icon: "fa-crown",
		label: "VIP Premium"
	};
	if (t.includes("cancelled") || t.includes("canceled") || T.includes("cancel")) return {
		cls: "reject",
		icon: "fa-ban",
		label: "Match Cancelled"
	};
	if (T.includes("reject") || T.includes("fail")) return {
		cls: "reject",
		icon: "fa-circle-exclamation",
		label: "Alert"
	};
	if (t.includes("withdraw") || T.includes("withdraw")) return {
		cls: "withdraw",
		icon: "fa-money-bill-transfer",
		label: "Withdrawal"
	};
	if (t.includes("deposit") || T.includes("deposit")) return {
		cls: "deposit",
		icon: "fa-circle-arrow-down",
		label: "Deposit"
	};
	if (t.includes("balance") || T.includes("balance") || T.includes("wallet") || t.includes("admin_set") || t.includes("refund")) return {
		cls: "balance",
		icon: "fa-wallet",
		label: "Wallet Update"
	};
	if (t.includes("match_result") || T.includes("result") || T.includes("won")) return {
		cls: "reward",
		icon: "fa-trophy",
		label: "Match Result"
	};
	if (t.includes("registration") || T.includes("registration") || T.includes("joined") || T.includes("room")) return {
		cls: "registration",
		icon: "fa-gamepad",
		label: "Tournament"
	};
	if (t.includes("prize") || t.includes("reward") || T.includes("prize") || T.includes("reward") || t.includes("referral")) return {
		cls: "reward",
		icon: "fa-medal",
		label: "Reward"
	};
	if (t.includes("team") || T.includes("team") || T.includes("squad")) return {
		cls: "team",
		icon: "fa-users",
		label: "Squad"
	};
	if (t.includes("admin_dm") || T.includes("message") || T.includes("reply")) return {
		cls: "dm",
		icon: "fa-headset",
		label: "Admin Support"
	};
	return {
		cls: "info",
		icon: "fa-bell",
		label: "Update"
	};
}
function getMinVipPriceText() {
	const vals = Object.values(State.vipSettings?.plans || {});
	if (!vals.length) return "Plans start at ₹2 or 100 💎";
	return `Plans start at just ₹${Math.min(...vals.map((p) => Number(p.rupees || 9999)))} or ${Math.min(...vals.map((p) => Number(p.diamonds || p.coins || 99999))).toLocaleString("en-IN")} 💎`;
}
function buildVipFeaturePreview(key, extraLabel = "") {
	const p = State.profile || {};
	const playerName = esc(p.displayName || "PBXANMOL");
	const playerInitial = esc((p.displayName || "P").charAt(0).toUpperCase());
	const avatarMarkup = p.photoUrl && (p.photoUrl.startsWith("data:image") || /^https?:\/\//i.test(p.photoUrl)) ? `<img src="${esc(p.photoUrl)}" alt="">` : playerInitial;
	if (key === "bluetick") return {
		title: "Verified Blue Tick Badge",
		desc: "Your official verified tick shines on Home bar, Profile & World Chat.",
		screen: `
        <div class="vp-screen">
          <div class="vp-mini-bar">
            <span style="display:flex;align-items:center;gap:5px;">Good morning, ${playerName} <i class="fa-solid fa-circle-check" style="color:#00a3ff;font-size:.82rem;"></i></span>
            <span style="font-size:.6rem;color:#00a3ff;font-weight:800;">VIP</span>
          </div>
          <div class="vp-mini-profile">
            <div class="vp-mini-av">${avatarMarkup}</div>
            <div>
              <div class="vp-mini-name">${playerName} <i class="fa-solid fa-circle-check" style="color:#00a3ff;"></i></div>
              <div class="vp-mini-sub">FF UID: ${esc(p.freeFireUid || "10064022939")} · Verified Player</div>
            </div>
          </div>
        </div>`
	};
	if (key === "worldchat") return {
		title: "Live World Chat Room",
		desc: "Full-screen live chat with Free Fire players, emojis & verified Blue Tick.",
		screen: `
        <div class="vp-screen">
          <div class="vp-mini-bar">
            <span style="display:flex;align-items:center;gap:5px;"><i class="fa-solid fa-earth-asia" style="color:#0284c7;"></i> World Chat</span>
            <span style="color:#16a34a;font-size:.64rem;">● Live</span>
          </div>
          <div class="vp-chat-list">
            <div class="vp-bubble">
              <div class="vpb-hd">PBXJOBAN <i class="fa-solid fa-circle-check" style="color:#00a3ff;"></i></div>
              Squad ready for 8 PM Bermuda Custom? 🔥
            </div>
            <div class="vp-bubble mine">
              <div class="vpb-hd">${playerName} <i class="fa-solid fa-circle-check" style="color:#00a3ff;"></i></div>
              Yes bro! Joining slot #4 right now 💪
            </div>
          </div>
        </div>`
	};
	if (key === "admindm") return {
		title: "Direct Admin Support Chat",
		desc: "Private 1-on-1 full-screen support chat directly with Punjab Esports Admin.",
		screen: `
        <div class="vp-screen">
          <div class="vp-mini-bar">
            <span style="display:flex;align-items:center;gap:5px;"><i class="fa-solid fa-headset" style="color:#4f46e5;"></i> Direct Admin Support</span>
            <span style="color:#b45309;font-size:.62rem;font-weight:800;">Official</span>
          </div>
          <div class="vp-chat-list">
            <div class="vp-bubble mine">
              <div class="vpb-hd">You</div>
              Bro, room ID kab tak aayega?
            </div>
            <div class="vp-bubble" style="background:linear-gradient(145deg,#1b1710,#12151f);border:1.5px solid rgba(230,194,115,.72);border-left:3.5px solid #e6c273;color:#ffffff;box-shadow:0 6px 16px rgba(180,130,30,.22);">
              <div class="vpb-hd" style="color:#f3d58d;gap:5px;">
                <span class="admin-logo-crest" style="width:17px;height:17px;font-size:.56rem;"><i class="fa-solid fa-crown"></i></span>
                <span style="color:#fff8dc;font-weight:800;">Official Admin</span>
                <span class="admin-role-pill" style="font-size:.5rem;padding:1px 5px;"><i class="fa-solid fa-shield-halved"></i> ADMIN</span>
              </div>
              Match start se 10 min pehle live ho jayega! ✅
            </div>
          </div>
        </div>`
	};
	if (key === "themes") {
		const previewThemes = THEME_DEFS.filter((t) => t.id !== "mono").slice(0, 6);
		return {
			title: extraLabel ? `Unlock "${extraLabel}" + All 9 Themes` : "All 9 Premium App Themes",
			desc: "Free accounts get Stealth B&W. VIP unlocks Royal Gold, AMOLED, Cyber, Fire, Neon & more.",
			screen: `
        <div class="vp-screen">
          <div class="vp-mini-bar">
            <span><i class="fa-solid fa-palette" style="color:#7c3aed;"></i> Appearance Themes</span>
            <span style="color:#b45309;font-size:.63rem;font-weight:800;">9 VIP Themes</span>
          </div>
          <div class="vp-theme-grid">
            ${previewThemes.map((t) => `
              <div class="vp-th-chip">
                <div class="vp-th-dots">${t.dots.map((c) => `<span style="background:${c}"></span>`).join("")}</div>
                <small>${esc(t.name)}</small>
              </div>
            `).join("")}
          </div>
        </div>`
		};
	}
	if (key === "wallpapers") return {
		title: extraLabel ? `Unlock "${extraLabel}" + 10 Wallpapers` : "10 HD Anime Wallpapers + Custom Photo",
		desc: "Full-height 9:16 HD anime artworks for World Chat & Admin DM, plus custom gallery photo upload.",
		screen: `
        <div class="vp-screen" style="background:linear-gradient(rgba(10,12,20,.14),rgba(10,12,20,.24)),url('assets/wallpapers/wp_naruto.jpg?v=2') center 45%/cover no-repeat;border-color:rgba(230,194,115,.4);color:#fff;">
          <div class="vp-mini-bar" style="border-color:rgba(255,255,255,.22);color:#fff;text-shadow:0 1px 4px rgba(0,0,0,.55);">
            <span><i class="fa-solid fa-image" style="color:#f3d58d;"></i> Chat Background</span>
            <span style="color:#f3d58d;font-size:.62rem;font-weight:800;">10 HD Anime</span>
          </div>
          <div class="vp-chat-list">
            <div class="vp-bubble" style="background:rgba(14,18,28,.82);border-color:rgba(255,255,255,.18);color:#fff;">
              <div class="vpb-hd" style="color:#e2e8f0;">PBXJOBAN <i class="fa-solid fa-circle-check" style="color:#00a3ff;"></i></div>
              Naruto chat background looks crazy crisp! 🔥
            </div>
            <div class="vp-bubble mine" style="background:#111827;border-color:rgba(230,194,115,.45);color:#fff;">
              <div class="vpb-hd" style="color:#e6c273;">${playerName}</div>
              Works in World Chat & Admin DM ✨
            </div>
          </div>
        </div>`
	};
	return {
		title: "Custom Team Logo & Rename",
		desc: "Upload your custom Squad Logo from gallery & edit your Team Name anytime.",
		screen: `
      <div class="vp-screen">
        <div class="vp-mini-bar">
          <span><i class="fa-solid fa-users" style="color:#b45309;"></i> Edit Squad Branding</span>
          <span style="color:#b45309;font-size:.63rem;font-weight:800;">VIP Leader</span>
        </div>
        <div class="vp-team-card">
          <div class="vp-team-logo"><i class="fa-solid fa-shield-halved"></i></div>
          <div style="flex:1;min-width:0;">
            <div style="font-size:.82rem;font-weight:800;color:#0f172a;">Team ${playerName}</div>
            <div style="font-size:.64rem;color:#64748b;">HD Custom Squad Logo + Editable Name</div>
            <div class="vp-team-btn"><i class="fa-solid fa-cloud-arrow-up"></i> Upload Custom Logo</div>
          </div>
        </div>
      </div>`
	};
}
function openVipGateModal(featureKey = "worldchat", extraLabel = "") {
	const prev = buildVipFeaturePreview(featureKey, extraLabel);
	const priceNote = getMinVipPriceText();
	openModal({
		title: {
			worldchat: "World Chat — VIP Required",
			admindm: "Admin Support — VIP Required",
			themes: "Premium Themes — VIP Required",
			wallpapers: "Chat Wallpapers — VIP Required",
			team: "Squad Branding — VIP Required"
		}[featureKey] || "VIP Membership Required",
		extraClass: "vip-gate-modal",
		bodyHTML: `
      <div class="vip-hero-stage" style="padding:14px;">
        <div class="vip-hero-aura"></div>
        <span class="vip-spark s1"></span><span class="vip-spark s2"></span><span class="vip-spark s3"></span>
        <div class="vip-hero-row">
          <div class="vip-emblem" style="width:44px;height:44px;font-size:1.1rem;"><span class="vip-emblem-ring"></span><i class="fa-solid fa-crown"></i></div>
          <div style="min-width:0;flex:1;">
            <div class="vip-eyebrow">Official Membership</div>
            <h2 class="vip-hero-title" style="font-size:.98rem;">${esc(prev.title)}</h2>
            <p class="vip-hero-sub">${esc(prev.desc)}</p>
          </div>
        </div>
      </div>

      <div class="vip-preview-stage" style="margin-bottom:12px;">
        ${prev.screen}
      </div>

      <div class="vip-sec-label"><span>All 6 Membership Benefits</span></div>
      <div class="vip-celeb-grid" style="margin-top:0;margin-bottom:12px;">
        <div class="vip-celeb-item"><div class="vip-celeb-ic" style="background:rgba(2,132,199,.12);color:#0284c7;"><i class="fa-solid fa-circle-check"></i></div><div><b>Blue Tick</b><small>Everywhere</small></div></div>
        <div class="vip-celeb-item"><div class="vip-celeb-ic" style="background:rgba(16,185,129,.12);color:#10b981;"><i class="fa-solid fa-earth-asia"></i></div><div><b>World Chat</b><small>Full-Screen</small></div></div>
        <div class="vip-celeb-item"><div class="vip-celeb-ic" style="background:rgba(99,102,241,.12);color:#6366f1;"><i class="fa-solid fa-headset"></i></div><div><b>Admin DM</b><small>Direct Chat</small></div></div>
        <div class="vip-celeb-item"><div class="vip-celeb-ic" style="background:rgba(217,119,6,.12);color:#d97706;"><i class="fa-solid fa-palette"></i></div><div><b>All 9 Themes</b><small>App Colors</small></div></div>
        <div class="vip-celeb-item"><div class="vip-celeb-ic" style="background:rgba(219,39,119,.12);color:#db2777;"><i class="fa-solid fa-image"></i></div><div><b>Wallpapers</b><small>10 HD + Photo</small></div></div>
        <div class="vip-celeb-item"><div class="vip-celeb-ic" style="background:rgba(234,88,12,.12);color:#ea580c;"><i class="fa-solid fa-shield-halved"></i></div><div><b>Team Logo</b><small>& Rename</small></div></div>
      </div>

      <div style="text-align:center;font-size:.71rem;font-weight:700;color:var(--tx);background:var(--acs);border:1px solid color-mix(in srgb,var(--ac) 28%,var(--bd));border-radius:10px;padding:7px 10px;">
        ${priceNote}
      </div>
    `,
		footerHTML: `<button class="btn btn-ghost" style="flex:0 0 auto;" data-x="c">Later</button><button class="btn vip-gold-btn" style="flex:1;" data-x="go"><i class="fa-solid fa-crown"></i> View VIP Plans</button>`,
		onMount: (el, close) => {
			const mfoot = el.querySelector(".mfoot");
			if (mfoot) mfoot.classList.add("mfoot-row");
			el.querySelector("[data-x=\"c\"]").onclick = close;
			el.querySelector("[data-x=\"go\"]").onclick = () => {
				close();
				setTimeout(() => openVipStore(), 160);
			};
		}
	});
}
function openVipStore() {
	const vipActive = isVipActive();
	const expiryTxt = vipActive ? fmtDate(State.profile.vipExpiry) : null;
	const userDiamonds = Number(State.profile?.diamonds || 0);
	const walletBal = Number(State.wallet?.balance || 0);
	const plansArr = Object.entries(State.vipSettings?.plans || {}).sort((a, b) => Number(b[1].days || 0) - Number(a[1].days || 0));
	const bestPlanEntry = plansArr[0];
	let preselectedPlan = bestPlanEntry ? bestPlanEntry[0] : null;
	let plansHtml = "";
	for (const [key, p] of plansArr) {
		const diamonds = Number(p.diamonds || p.coins || 0);
		const days = Number(p.days || 0);
		const isBest = bestPlanEntry && bestPlanEntry[0] === key;
		const perDay = days > 0 ? Math.max(1, Math.round(Number(p.rupees || 0) / days)) : Number(p.rupees || 0);
		const isSel = preselectedPlan === key;
		plansHtml += `
      <div class="vip-plan-card ${isSel ? "selected" : ""}" data-plan="${key}" role="button" tabindex="0">
        <div class="vip-plan-left">
          <div class="vip-plan-radio">${isSel ? "<i class=\"fa-solid fa-check\"></i>" : ""}</div>
          <div class="vip-plan-info">
            <b>
              <span>${days} ${days === 1 ? "Day" : "Days"} VIP Pass</span>
              ${isBest ? "<span class=\"vip-badge-premium\">Best Value</span>" : ""}
            </b>
            <small>~₹${perDay}/day · Instant activation</small>
          </div>
        </div>
        <div class="vip-plan-price">
          <strong>₹${Number(p.rupees || 0)}</strong>
          <span>or ${diamonds.toLocaleString("en-IN")} 💎</span>
        </div>
      </div>
    `;
	}
	const initialPrev = buildVipFeaturePreview("bluetick");
	const html = `
    <div class="vip-hero-stage">
      <div class="vip-hero-aura"></div>
      <span class="vip-spark s1"></span><span class="vip-spark s2"></span><span class="vip-spark s3"></span>
      <div class="vip-hero-row">
        <div class="vip-emblem"><span class="vip-emblem-ring"></span><i class="fa-solid fa-crown"></i></div>
        <div style="min-width:0;flex:1;">
          <div class="vip-eyebrow">Official Membership</div>
          <h2 class="vip-hero-title">Punjab Esports VIP</h2>
          <p class="vip-hero-sub">6 exclusive upgrades for verified identity, full-screen chat & customization.</p>
        </div>
      </div>
      <div class="vip-bal-bar">
        <div class="vip-bal-chip"><i class="fa-solid fa-gem"></i> ${userDiamonds.toLocaleString("en-IN")}</div>
        <div class="vip-bal-chip"><i class="fa-solid fa-wallet"></i> ₹${walletBal.toFixed(0)}</div>
        ${vipActive ? `<div class="vip-active-banner"><i class="fa-solid fa-circle-check"></i> Till ${expiryTxt}</div>` : ""}
      </div>
    </div>

    <div class="vip-sec-label">
      <span>VIP Benefits & Preview</span>
      <span style="font-size:.63rem;color:var(--txm);text-transform:none;letter-spacing:0;">Tap a feature</span>
    </div>
    <div class="vip-prev-tabs" id="vipPrevTabs">
      <button type="button" class="vip-ptab active" data-pkey="bluetick"><i class="fa-solid fa-circle-check" style="color:#0284c7;"></i> Blue Tick</button>
      <button type="button" class="vip-ptab" data-pkey="worldchat"><i class="fa-solid fa-earth-asia" style="color:#10b981;"></i> World Chat</button>
      <button type="button" class="vip-ptab" data-pkey="admindm"><i class="fa-solid fa-headset" style="color:#6366f1;"></i> Admin DM</button>
      <button type="button" class="vip-ptab" data-pkey="themes"><i class="fa-solid fa-palette" style="color:#d97706;"></i> 9 Themes</button>
      <button type="button" class="vip-ptab" data-pkey="wallpapers"><i class="fa-solid fa-image" style="color:#db2777;"></i> Wallpapers</button>
      <button type="button" class="vip-ptab" data-pkey="team"><i class="fa-solid fa-shield-halved" style="color:#ea580c;"></i> Team Logo</button>
    </div>
    <div class="vip-preview-stage" id="vipPreviewStage">
      ${initialPrev.screen}
      <div class="vip-preview-caption">
        <div>
          <b>${esc(initialPrev.title)}</b>
          <small>${esc(initialPrev.desc)}</small>
        </div>
      </div>
    </div>

    <div class="vip-sec-label">
      <span>Select Membership Plan</span>
      <span style="font-size:.63rem;color:var(--txd);text-transform:none;letter-spacing:0;font-weight:700;">Pay in ₹ or 💎</span>
    </div>
    ${plansHtml || "<p class=\"muted tc\" style=\"font-size:.8rem;\">No plans configured right now.</p>"}

    <div class="vip-compare-box">
      <div class="vip-compare-head">
        <b><i class="fa-solid fa-list-check" style="color:var(--ac);"></i> Membership Details</b>
        <div class="vip-compare-tabs" role="tablist">
          <button type="button" class="vip-ctab active" data-vtab="get">Included (6)</button>
          <button type="button" class="vip-ctab" data-vtab="free">Fair Play</button>
        </div>
      </div>
      <div class="vip-compare-list" id="vipCmpGet">
        <div class="vip-cmp-row is-yes"><i class="fa-solid fa-check"></i><span><b>Verified Blue Tick</b> on Home, Profile & World Chat</span></div>
        <div class="vip-cmp-row is-yes"><i class="fa-solid fa-check"></i><span><b>Full-Screen World Chat</b> with live players & Emojis</span></div>
        <div class="vip-cmp-row is-yes"><i class="fa-solid fa-check"></i><span><b>Direct Admin Support Chat</b> for fast private 1-on-1 help</span></div>
        <div class="vip-cmp-row is-yes"><i class="fa-solid fa-check"></i><span><b>All 9 Locked App Themes</b> unlocked instantly</span></div>
        <div class="vip-cmp-row is-yes"><i class="fa-solid fa-check"></i><span><b>10 HD Anime Wallpapers + Custom Photo</b> for World & Admin Chat</span></div>
        <div class="vip-cmp-row is-yes"><i class="fa-solid fa-check"></i><span><b>Custom Team Logo & Rename</b> anytime for your squad</span></div>
      </div>
      <div class="vip-compare-list" id="vipCmpFree" style="display:none;">
        <div class="vip-cmp-row is-no"><i class="fa-solid fa-minus"></i><span>Free accounts keep <b>Stealth B&W</b> theme & <b>Classic White</b> chat background</span></div>
        <div class="vip-cmp-row is-no"><i class="fa-solid fa-minus"></i><span><b>100% Fair Play</b> — tournament fees, slots & prizes stay equal for every player</span></div>
      </div>
      <div class="vip-fair-note">
        <i class="fa-solid fa-shield-halved"></i>
        <span>Renewing while VIP is active automatically extends your expiry date.</span>
      </div>
    </div>
  `;
	const initPlan = preselectedPlan ? State.vipSettings?.plans?.[preselectedPlan] : null;
	const initBtnText = initPlan ? `Continue · ${initPlan.days}D (₹${initPlan.rupees})` : "Continue";
	openModal({
		title: "VIP Membership",
		extraClass: "vip-store-modal",
		bodyHTML: html,
		footerHTML: `<button class="btn btn-ghost" style="flex:0 0 auto;" data-x="c">Close</button><button class="btn vip-gold-btn" style="flex:1;" data-x="buy" ${preselectedPlan ? "" : "disabled"}>${initBtnText}</button>`,
		onMount: (el, close) => {
			const mfoot = el.querySelector(".mfoot");
			if (mfoot) mfoot.classList.add("mfoot-row");
			let selectedPlan = preselectedPlan;
			const buyBtn = el.querySelector("[data-x=\"buy\"]");
			el.querySelector("[data-x=\"c\"]").onclick = close;
			el.querySelectorAll(".vip-ptab").forEach((ptab) => {
				ptab.onclick = () => {
					el.querySelectorAll(".vip-ptab").forEach((t) => t.classList.remove("active"));
					ptab.classList.add("active");
					const stage = el.querySelector("#vipPreviewStage");
					const data = buildVipFeaturePreview(ptab.dataset.pkey);
					if (stage) stage.innerHTML = `${data.screen}<div class="vip-preview-caption"><div><b>${esc(data.title)}</b><small>${esc(data.desc)}</small></div></div>`;
				};
			});
			el.querySelectorAll(".vip-ctab").forEach((tab) => {
				tab.onclick = () => {
					el.querySelectorAll(".vip-ctab").forEach((t) => t.classList.remove("active"));
					tab.classList.add("active");
					const mode = tab.dataset.vtab;
					const getList = el.querySelector("#vipCmpGet");
					const freeList = el.querySelector("#vipCmpFree");
					if (getList) getList.style.display = mode === "get" ? "flex" : "none";
					if (freeList) freeList.style.display = mode === "free" ? "flex" : "none";
				};
			});
			const selectPlanCard = (card) => {
				el.querySelectorAll(".vip-plan-card").forEach((c) => {
					c.classList.remove("selected");
					const r = c.querySelector(".vip-plan-radio");
					if (r) r.innerHTML = "";
				});
				card.classList.add("selected");
				const r = card.querySelector(".vip-plan-radio");
				if (r) r.innerHTML = "<i class=\"fa-solid fa-check\"></i>";
				selectedPlan = card.dataset.plan;
				const p = State.vipSettings.plans[selectedPlan];
				if (buyBtn && p) {
					buyBtn.disabled = false;
					buyBtn.innerHTML = `Continue · ${p.days}D (₹${p.rupees})`;
				}
			};
			el.querySelectorAll(".vip-plan-card").forEach((card) => {
				card.onclick = () => selectPlanCard(card);
			});
			if (buyBtn) buyBtn.onclick = () => {
				if (!selectedPlan) return;
				const p = State.vipSettings.plans[selectedPlan];
				const diamondPrice = Number(p.diamonds || p.coins || 0);
				close();
				setTimeout(() => openVipPaymentMethod(selectedPlan, p, diamondPrice), 150);
			};
		}
	});
}
function openVipPaymentMethod(planKey, p, diamondPrice) {
	const walletBal = Number(State.wallet.balance || 0);
	const userDiamonds = Number(State.profile?.diamonds || 0);
	const canRupees = walletBal >= Number(p.rupees || 0);
	const canDiamonds = userDiamonds >= diamondPrice;
	openModal({
		title: "Choose Payment Method",
		bodyHTML: `
      <div style="text-align:center;margin-bottom:14px;">
        <div style="font-size:1.08rem;font-weight:700;color:var(--ac2);">${p.days} ${Number(p.days) === 1 ? "Day" : "Days"} VIP Pass</div>
        <div style="font-size:0.78rem;color:var(--txm);margin-top:4px;">Choose how you want to pay</div>
      </div>
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:16px;">
        <button class="btn btn-outline" id="payRupeesBtn" style="flex-direction:column; padding:16px; ${!canRupees ? "opacity:0.5;" : ""}">
          <i class="fa-solid fa-indian-rupee-sign" style="font-size:1.5rem; margin-bottom:8px; color:var(--ok);"></i>
          <b>₹${p.rupees}</b>
          <small style="font-size:0.7rem; margin-top:4px;">Pay with Rupees</small>
          <small style="font-size:0.65rem;color:${canRupees ? "var(--ok)" : "var(--er)"};margin-top:2px;">Bal: ₹${walletBal.toFixed(2)}</small>
        </button>
        <button class="btn btn-outline" id="payDiamondsBtn" style="flex-direction:column; padding:16px; ${!canDiamonds ? "opacity:0.5;" : ""}">
          <i class="fa-solid fa-gem" style="font-size:1.5rem; margin-bottom:8px; color:#38bdf8;"></i>
          <b>${diamondPrice.toLocaleString("en-IN")} 💎</b>
          <small style="font-size:0.7rem; margin-top:4px;">Pay with Diamonds</small>
          <small style="font-size:0.65rem;color:${canDiamonds ? "var(--ok)" : "var(--er)"};margin-top:2px;">Have: ${userDiamonds.toLocaleString("en-IN")}</small>
        </button>
      </div>
      <p style="font-size:0.72rem; text-align:center; color:var(--txm); margin:0;">Diamonds can be earned from matches, rewards & admin gifts.</p>
    `,
		footerHTML: `<button class="btn btn-ghost w-100" id="vipPayCancel">Cancel</button>`,
		onMount: (el, close) => {
			el.querySelector("#vipPayCancel").onclick = close;
			el.querySelector("#payRupeesBtn").onclick = () => {
				if (!canRupees) {
					toast("error", "Insufficient Balance", "Add money to your wallet.");
					return;
				}
				close();
				setTimeout(() => payVip(planKey, "rupees", p), 100);
			};
			el.querySelector("#payDiamondsBtn").onclick = () => {
				if (!canDiamonds) {
					toast("error", "Insufficient Diamonds", "Earn more diamonds from matches & rewards.");
					return;
				}
				close();
				setTimeout(() => payVip(planKey, "diamonds", p), 100);
			};
		}
	});
}
window.payVip = async (planKey, method, p) => {
	const diamondPrice = Number(p.diamonds || p.coins || 0);
	try {
		if (method === "rupees") {
			if (Number(State.wallet.balance || 0) < p.rupees) {
				toast("error", "Insufficient Balance", "Add money to your wallet.");
				return;
			}
			State.localWalletActionTs = Date.now();
			if (!(await runTransaction(ref(db, "wallets/" + State.user.uid + "/balance"), (cur) => {
				const c = Number(cur) || 0;
				if (c < p.rupees) return;
				return c - p.rupees;
			})).committed) return toast("error", "Failed", "");
		} else {
			if (Number(State.profile.diamonds || 0) < diamondPrice) {
				toast("error", "Insufficient Diamonds", "You don't have enough diamonds.");
				return;
			}
			if (!(await runTransaction(ref(db, "users/" + State.user.uid + "/diamonds"), (cur) => {
				const c = Number(cur) || 0;
				if (c < diamondPrice) return;
				return c - diamondPrice;
			})).committed) return toast("error", "Failed", "");
		}
		const currentExpiry = Number(State.profile.vipExpiry || 0);
		const newExpiry = Math.max(Date.now(), currentExpiry) + p.days * 24 * 60 * 60 * 1e3;
		await update(ref(db, "users/" + State.user.uid), { vipExpiry: newExpiry });
		State.profile.vipExpiry = newExpiry;
		loadProfileUI();
		refreshTheme();
		const txRef = push(ref(db, "walletTransactions"));
		await set(txRef, {
			id: txRef.key,
			userId: State.user.uid,
			type: "vip_purchase",
			amount: method === "rupees" ? -p.rupees : 0,
			currency: method === "rupees" ? "INR" : "DIAMONDS",
			diamonds: method === "diamonds" ? -diamondPrice : 0,
			status: "completed",
			createdAt: Date.now()
		});
		triggerVipCelebration(p.days, newExpiry);
	} catch (e) {
		toast("error", "Failed", "Could not complete transaction.");
	}
};
function triggerVipCelebration(days, expiryTs = null) {
	playNotifSound();
	if (navigator.vibrate) try {
		navigator.vibrate([
			200,
			100,
			200,
			100,
			500
		]);
	} catch (e) {}
	if (typeof confetti === "function") {
		var duration = 2800;
		var animationEnd = Date.now() + duration;
		var defaults = {
			startVelocity: 30,
			spread: 360,
			ticks: 60,
			zIndex: 1e4
		};
		function randomInRange(min, max) {
			return Math.random() * (max - min) + min;
		}
		var interval = setInterval(function() {
			var timeLeft = animationEnd - Date.now();
			if (timeLeft <= 0) return clearInterval(interval);
			var particleCount = 45 * (timeLeft / duration);
			confetti(Object.assign({}, defaults, {
				particleCount,
				origin: {
					x: randomInRange(.1, .3),
					y: Math.random() - .2
				}
			}));
			confetti(Object.assign({}, defaults, {
				particleCount,
				origin: {
					x: randomInRange(.7, .9),
					y: Math.random() - .2
				}
			}));
		}, 250);
	}
	const dayLabel = `${days} ${Number(days) === 1 ? "Day" : "Days"} VIP Pass`;
	const validTxt = expiryTs ? fmtDate(expiryTs) : State.profile?.vipExpiry ? fmtDate(State.profile.vipExpiry) : "";
	openModal({
		title: "VIP Activated!",
		extraClass: "vip-celeb-modal",
		bodyHTML: `
      <div class="vip-hero-stage" style="margin-bottom:12px;">
        <div class="vip-hero-aura"></div>
        <span class="vip-spark s1"></span><span class="vip-spark s2"></span><span class="vip-spark s3"></span>
        <div class="vip-hero-row">
          <div class="vip-emblem"><span class="vip-emblem-ring"></span><i class="fa-solid fa-crown"></i></div>
          <div style="min-width:0;flex:1;">
            <div class="vip-eyebrow">Official Membership</div>
            <h2 class="vip-hero-title" style="font-size:1.15rem;">Welcome to VIP</h2>
            <p class="vip-hero-sub">Activated <b>${dayLabel}</b>${validTxt ? ` · Valid till ${validTxt}` : ""}</p>
          </div>
        </div>
      </div>

      <div class="vip-sec-label"><span>All 6 Unlocked Perks</span></div>
      <div class="vip-celeb-grid" style="margin-top:0;">
        <div class="vip-celeb-item">
          <div class="vip-celeb-ic" style="background:rgba(2,132,199,.12);color:#0284c7;"><i class="fa-solid fa-circle-check"></i></div>
          <div><b>Verified Blue Tick</b><small>Home, Profile & Chat</small></div>
        </div>
        <div class="vip-celeb-item">
          <div class="vip-celeb-ic" style="background:rgba(16,185,129,.12);color:#10b981;"><i class="fa-solid fa-earth-asia"></i></div>
          <div><b>World Chat</b><small>Full-Screen + Emojis</small></div>
        </div>
        <div class="vip-celeb-item">
          <div class="vip-celeb-ic" style="background:rgba(99,102,241,.12);color:#6366f1;"><i class="fa-solid fa-headset"></i></div>
          <div><b>Direct Admin DM</b><small>Private Support Chat</small></div>
        </div>
        <div class="vip-celeb-item">
          <div class="vip-celeb-ic" style="background:rgba(217,119,6,.12);color:#d97706;"><i class="fa-solid fa-palette"></i></div>
          <div><b>All 9 App Themes</b><small>Gold, Cyber, Neon & more</small></div>
        </div>
        <div class="vip-celeb-item">
          <div class="vip-celeb-ic" style="background:rgba(219,39,119,.12);color:#db2777;"><i class="fa-solid fa-image"></i></div>
          <div><b>Chat Wallpapers</b><small>10 HD Anime + Upload</small></div>
        </div>
        <div class="vip-celeb-item">
          <div class="vip-celeb-ic" style="background:rgba(234,88,12,.12);color:#ea580c;"><i class="fa-solid fa-shield-halved"></i></div>
          <div><b>Custom Team Logo</b><small>& Squad Name Edit</small></div>
        </div>
      </div>
    `,
		footerHTML: `<button class="btn btn-outline" style="flex:0 0 auto;" data-x="themes"><i class="fa-solid fa-palette"></i> Themes</button><button class="btn vip-gold-btn" style="flex:1;" data-x="close">Let's Go</button>`,
		onMount: (el, close) => {
			const mfoot = el.querySelector(".mfoot");
			if (mfoot) mfoot.classList.add("mfoot-row");
			el.querySelector("[data-x=\"close\"]").onclick = close;
			const thBtn = el.querySelector("[data-x=\"themes\"]");
			if (thBtn) thBtn.onclick = () => {
				close();
				navigate("profile");
				setTimeout(() => {
					$("#themeGrid")?.scrollIntoView({
						behavior: "smooth",
						block: "center"
					});
				}, 200);
			};
		}
	});
}
function renderThemeGrid() {
	const host = $("#themeGrid");
	if (!host) return;
	const isLocked = themeState.mode === "global";
	const current = computeActiveTheme();
	const vip = isVipActive();
	if (isLocked) {
		host.innerHTML = `<div class="alert info"><i class="fa-solid fa-lock"></i><span>Theme is managed by admin.</span></div>`;
		return;
	}
	host.innerHTML = THEME_DEFS.filter((t) => themeState.enabled[t.id] !== false).map((t) => {
		const locked = t.id !== "mono" && !vip;
		return `
    <div class="theme-swatch ${t.id === current ? "active" : ""} ${locked ? "locked" : ""}" data-theme-pick="${t.id}">
      <div class="ts-dots">${t.dots.map((c) => `<span style="background:${c}"></span>`).join("")}</div>
      <small>${esc(t.name)}</small>
      ${t.id === "mono" ? "<span class=\"ts-tag free\">Default</span>" : ""}
      ${locked ? "<span class=\"ts-tag vip-lock\"><i class=\"fa-solid fa-lock\"></i> VIP</span>" : ""}
    </div>
  `;
	}).join("");
	host.querySelectorAll("[data-theme-pick]").forEach((el) => {
		el.onclick = async () => {
			const picked = el.dataset.themePick;
			const isVipOnly = picked !== "mono";
			const def = THEME_DEFS.find((t) => t.id === picked);
			if (isVipOnly && !isVipActive()) {
				openVipGateModal("themes", def ? def.name : "Premium");
				return;
			}
			try {
				await set(ref(db, "users/" + State.user.uid + "/theme"), picked);
				themeState.userTheme = picked;
				applyTheme(picked);
				renderThemeGrid();
				toast("success", "Theme Applied", def ? `${def.name} is now active.` : "");
			} catch (e) {
				toast("error", "Cannot save", "");
			}
		};
	});
}
function loadProfileExtras() {
	renderReferralStats();
}
async function shareReferral() {
	const code = State.profile?.referralCode || "PUNJAB";
	const rs = State.referralSettings || {};
	let downloadLink = rs.downloadLink || "https://punjabesports.app/download";
	let signupBonus = rs.signupBonus || "₹2";
	let referralBonus = rs.referralBonus || "₹2";
	openShareSheet((rs.customMessage || DEFAULT_REFERRAL_MSG).replace(/\{code\}/g, code).replace(/\{downloadLink\}/g, downloadLink).replace(/\{signupBonus\}/g, signupBonus).replace(/\{referralBonus\}/g, referralBonus), downloadLink);
}
function openShareSheet(text, link) {
	const encText = encodeURIComponent(text);
	const encLink = encodeURIComponent(link);
	const encSubject = encodeURIComponent("Join Punjab Esports & Win Real Cash!");
	const shortLink = link.startsWith("http") ? link : "https://" + link;
	const supportGmail = String(State.supportConfig?.gmail || "pbanmol025@gmail.com").trim();
	openModal({
		title: "Share Punjab Esports",
		bodyHTML: `
      <div class="alert info" style="margin-bottom:12px;padding:10px;"><i class="fa-solid fa-share-nodes"></i><span>Share with friends and earn rewards</span></div>
      <div class="share-grid">
        <a class="share-btn whatsapp" href="https://wa.me/?text=${encText}" target="_blank" rel="noopener"><i class="fa-brands fa-whatsapp"></i><span>WhatsApp</span></a>
        <a class="share-btn telegram" href="https://t.me/share/url?url=${encLink}&text=${encText}" target="_blank" rel="noopener"><i class="fa-brands fa-telegram"></i><span>Telegram</span></a>
        <a class="share-btn instagram" href="https://www.instagram.com/" target="_blank" rel="noopener"><i class="fa-brands fa-instagram"></i><span>Instagram</span></a>
        <a class="share-btn gmail" id="shareGmailBtn" href="${`mailto:?subject=${encSubject}&body=${encText}`}"><i class="fa-solid fa-envelope"></i><span>Gmail</span></a>
      </div>
      <div style="font-size:.72rem;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:var(--txm);margin-bottom:6px;display:flex;align-items:center;gap:6px;"><i class="fa-solid fa-eye"></i> Preview Message</div>
      <div class="share-preview">${esc(text)}</div>
      <button class="btn btn-primary btn-block" id="copyFullText" style="margin-bottom:8px;"><i class="fa-solid fa-copy"></i> Copy Full Message</button>
      <button class="btn btn-outline btn-block" id="copyLinkOnly"><i class="fa-solid fa-link"></i> Copy Link Only</button>
      ${supportGmail ? `<div style="text-align:center;font-size:.72rem;color:var(--txm);margin-top:10px;">Official Support Gmail: <a href="mailto:${esc(supportGmail)}?subject=${encodeURIComponent("Punjab Esports Support")}" style="color:var(--ac2);font-weight:600;">${esc(supportGmail)}</a></div>` : ""}
    `,
		footerHTML: `<button class="btn btn-ghost w-100" data-x="close">Close</button>`,
		onMount: (el, close) => {
			el.querySelector("[data-x=\"close\"]").onclick = close;
			el.querySelector("#copyFullText").onclick = () => {
				navigator.clipboard?.writeText(text).then(() => toast("success", "Message copied", "")).catch(() => toast("error", "Copy failed", ""));
			};
			el.querySelector("#copyLinkOnly").onclick = () => {
				navigator.clipboard?.writeText(shortLink).then(() => toast("success", "Link copied", "")).catch(() => toast("error", "Copy failed", ""));
			};
		}
	});
}
function openEditProfile() {
	const p = State.profile || {};
	isVipActive();
	const emojiPickerHTML = `<div class="emoji-grid" style="display:grid; margin-top:10px;">${[
		"😀",
		"😎",
		"🔥",
		"💀",
		"🥶",
		"🤡",
		"👽",
		"🤖",
		"💩",
		"👻",
		"👾",
		"🎮",
		"🎯",
		"🏆",
		"🥇",
		"🎬",
		"💎",
		"👑",
		"⚡",
		"🌙",
		"🦁",
		"🐯",
		"🐉",
		"🦅",
		"🦊",
		"🐺",
		"🦈",
		"🐼",
		"🐨",
		"🐸",
		"🦄",
		"🍕",
		"🍔",
		"🍟",
		"🥤",
		"🍺",
		"🚀",
		"🛸",
		"✈️",
		"🏎️",
		"🏍️",
		"🎸",
		"🎧",
		"🎤",
		"💣",
		"🔫",
		"🛡️",
		"⚔️",
		"🏹",
		"💪",
		"✌️",
		"🤘",
		"🤙",
		"👊",
		"🎲",
		"🏮",
		"🃏",
		"🔮",
		"💯",
		"💸",
		"💰",
		"💵",
		"🤝",
		"🙏"
	].map((e) => `<div class="emoji-btn" data-emoji="${e}">${e}</div>`).join("")}</div>`;
	openModal({
		title: "Edit Profile",
		bodyHTML: `
      <div class="field"><label>Free Fire Username</label><input type="text" id="epName" class="input" value="${esc(p.displayName || "")}" maxlength="40"></div>
      <div class="field"><label>Free Fire UID</label><input type="text" id="epFfUid" class="input" value="${esc(p.freeFireUid || "")}" maxlength="20"></div>
      
      <div class="field">
        <label>Profile Image</label>
        <div style="display:flex; gap:10px; align-items:center;">
          <button type="button" id="btnTriggerPhotoUpload" class="btn btn-outline btn-sm" style="flex:1; cursor:pointer; display:inline-flex; align-items:center; justify-content:center; gap:6px;">
            <i class="fa-solid fa-cloud-arrow-up"></i> <span id="epPhotoLabel">Upload Image</span>
          </button>
          <input type="file" id="epPhotoFile" accept="image/*" style="display:none;">
          <button type="button" class="btn btn-outline btn-sm" id="toggleEmojiPicker"><i class="fa-solid fa-face-smile"></i> Emoji</button>
        </div>
        <div id="epPhotoPreviewWrap" style="margin-top:8px;display:${p.photoUrl && p.photoUrl.startsWith("data:image") ? "flex" : "none"};align-items:center;gap:10px;">
          <img id="epPhotoPreview" src="${p.photoUrl && p.photoUrl.startsWith("data:image") ? p.photoUrl : ""}" alt="Preview" style="width:44px;height:44px;border-radius:50%;object-fit:cover;border:1.5px solid var(--ac);">
          <small style="color:var(--txd);font-size:0.75rem;">Current / selected photo</small>
        </div>
        <div style="font-size:0.7rem; color:var(--txm); margin-top:4px;">* Pick any photo from your gallery — all image sizes (MB+) are supported.</div>
      </div>
      
      <div id="emojiPicker" style="display:none; margin-bottom:14px;">
         ${emojiPickerHTML}
      </div>

      <input type="hidden" id="epEmoji" value="${esc(p.profileEmoji || "")}">
    `,
		footerHTML: `<button class="btn btn-ghost" data-x="c">Cancel</button><button class="btn btn-primary" data-x="ok"><i class="fa-solid fa-floppy-disk"></i> Save</button>`,
		onMount: (el, close) => {
			el.querySelector("[data-x=\"c\"]").onclick = close;
			let base64Image = null;
			const fileInput = el.querySelector("#epPhotoFile");
			const triggerBtn = el.querySelector("#btnTriggerPhotoUpload");
			const previewWrap = el.querySelector("#epPhotoPreviewWrap");
			const previewImg = el.querySelector("#epPhotoPreview");
			if (triggerBtn && fileInput) triggerBtn.onclick = () => {
				if (!isNativeAndroidApp() && localStorage.getItem("pe_media_permission") !== "granted") promptMediaPermissionDialog(true, () => fileInput.click());
				else fileInput.click();
			};
			if (fileInput) fileInput.onchange = async (ev) => {
				const file = ev.target.files[0];
				if (!file) return;
				const labelSpan = el.querySelector("#epPhotoLabel");
				if (labelSpan) labelSpan.textContent = "Processing...";
				try {
					base64Image = await processImageFileToDataURL(file, 512, .85);
					if (previewImg && previewWrap) {
						previewImg.src = base64Image;
						previewWrap.style.display = "flex";
					}
					if (labelSpan) labelSpan.textContent = file.name.length > 16 ? file.name.substring(0, 13) + "..." : file.name;
					toast("success", "Image Selected", "Ready to save.");
				} catch (err) {
					base64Image = null;
					fileInput.value = "";
					if (labelSpan) labelSpan.textContent = "Upload Image";
					toast("error", "Image Error", "Could not read that photo. Please try another.");
				}
			};
			const toggleEmojiBtn = el.querySelector("#toggleEmojiPicker");
			const picker = el.querySelector("#emojiPicker");
			toggleEmojiBtn.onclick = () => {
				picker.style.display = picker.style.display === "none" ? "block" : "none";
			};
			el.querySelectorAll("#emojiPicker [data-emoji]").forEach((eb) => {
				eb.onclick = () => {
					const emoji = eb.dataset.emoji;
					el.querySelector("#epEmoji").value = emoji;
					if (fileInput) fileInput.value = "";
					const labelSpan = el.querySelector("#epPhotoLabel");
					if (labelSpan) labelSpan.textContent = "Upload Image";
					base64Image = null;
					if (previewWrap) previewWrap.style.display = "none";
					toast("success", "Emoji Selected", emoji);
					picker.style.display = "none";
				};
			});
			el.querySelector("[data-x=\"ok\"]").onclick = async () => {
				const name = el.querySelector("#epName").value.trim();
				const ff = el.querySelector("#epFfUid").value.trim();
				const chosenEmoji = el.querySelector("#epEmoji").value;
				if (name.length < 2) {
					toast("error", "Invalid Name", "");
					return;
				}
				if (ff && !/^\d{6,15}$/.test(ff)) {
					toast("error", "Invalid FF UID", "");
					return;
				}
				let finalPhotoUrl = p.photoUrl || "";
				let finalEmoji = chosenEmoji || "";
				if (base64Image) {
					finalPhotoUrl = base64Image;
					finalEmoji = "";
				} else if (finalEmoji) finalPhotoUrl = "";
				else if (p.photoUrl) finalPhotoUrl = p.photoUrl;
				try {
					await update(ref(db, "users/" + State.user.uid), {
						displayName: name,
						freeFireUid: ff,
						photoUrl: finalPhotoUrl,
						profileEmoji: finalEmoji,
						updatedAt: Date.now()
					});
					await update(ref(db, "publicProfiles/" + State.user.uid), {
						displayName: name,
						freeFireUid: ff,
						photoUrl: finalPhotoUrl,
						profileEmoji: finalEmoji
					});
					State.profile = {
						...State.profile,
						displayName: name,
						freeFireUid: ff,
						photoUrl: finalPhotoUrl,
						profileEmoji: finalEmoji
					};
					if (State.profile.email && finalPhotoUrl) saveAccountAvatarCache(State.profile.email, finalPhotoUrl);
					loadProfileUI();
					updateGreeting();
					toast("success", "Saved", "Profile updated.");
					close();
				} catch (e) {
					toast("error", "Failed", e.message);
				}
			};
		}
	});
}
function openRules() {
	openModal({
		title: "Terms & Fair Play Policy",
		bodyHTML: `<div class="rules-body"><h4>1. Fair Play</h4><p>No hacking, cheating, teaming, or unauthorized tools.</p><h4>2. Entry & Rewards</h4><p>Entry fees deducted on confirmed registration. Rewards credited after admin verification.</p><h4>3. Refunds</h4><p>Cancelled matches refunded per admin policy. If admin cancels a match, the entry fee is auto-refunded to the payer.</p><h4>4. Withdrawals</h4><p>Minimum withdrawal set by admin. Manual UPI payout.</p><h4>5. VIP & Premium</h4><p>VIP features are time-bound. Once expired, access to themes, chat, blue tick, and Direct Admin DM will be revoked automatically. Diamonds are non-refundable once spent.</p><h4>6. Teams</h4><p>Squads can be created for free. Duo & Squad matches require an active ₹5/month Maintenance Pass. First-time users get a 7-day free trial. Pass payments are non-refundable.</p><h4>7. Account</h4><p>You are responsible for your account credentials.</p></div>`,
		footerHTML: `<button class="btn btn-primary w-100" data-x="close">Close</button>`,
		onMount: (el, close) => {
			el.querySelector("[data-x=\"close\"]").onclick = close;
		}
	});
}
window.PE = {
	State,
	toast,
	openModal,
	confirmDialog,
	playNotifSound,
	openVipStore,
	openAdminDM,
	loadMyTeam,
	renderMyTeam,
	switchMyTab
};
console.log("%cPunjab Esports v1.0.0 — Stealth Black", "color:#111111;font-weight:bold;font-size:14px");
