// Fixed list so "valorant" and "Valorant" don't get separate clip numbers. Edit to add games.
export const GAMES = ["Valorant", "Minecraft", "Arc Raiders", "The Finals", "Roblox", "Other"] as const;
export const MAX_BYTES = 2 * 1024 ** 3; // 2 GB; R2 free tier is 10 GB total and files are deleted after upload
export const VIDEO_TYPES = ["video/mp4", "video/quicktime", "video/webm", "video/x-matroska"];

// Shown publicly on /privacy and /terms (the YouTube audit wants a contact). The owner fills this in.
export const CONTACT_EMAIL = "bananasaroundtheworld@gmail.com";
