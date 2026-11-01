// The game list lives in the `games` table (migration 0008); the owner edits it on /admin.
// "Other" is permanent (can't be removed) and always listed last.
export const OTHER_GAME = "Other";
export const sortGames = (names: string[]) =>
  [...names].sort((a, b) => Number(a === OTHER_GAME) - Number(b === OTHER_GAME) || a.localeCompare(b));
export const MAX_BYTES = 2 * 1024 ** 3; // 2 GB; R2 free tier is 10 GB total and files are deleted after upload
export const VIDEO_TYPES = ["video/mp4", "video/quicktime", "video/webm", "video/x-matroska"];

// Shown publicly on /privacy and /terms (the YouTube audit wants a contact). The owner fills this in.
export const CONTACT_EMAIL = "bananasaroundtheworld@gmail.com";
