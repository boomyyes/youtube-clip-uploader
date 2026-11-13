// Interface icons from Iconoir (iconoir.com, MIT): thin, even strokes that suit the editorial look.
import {
  Check, Clock, Group, InfoCircle, Key, Link, LogOut, MediaVideoList, Movie, Refresh,
  ShieldCheck, Star, Trash, Upload, User, WarningTriangle, Youtube,
} from "iconoir-react";

const ICONS = {
  upload: Upload, clips: MediaVideoList, admin: ShieldCheck, account: User, signout: LogOut,
  alert: WarningTriangle, bin: Trash, check: Check, clock: Clock, film: Movie, info: InfoCircle,
  key: Key, link: Link, refresh: Refresh, star: Star, users: Group, youtube: Youtube,
};
export type IconName = keyof typeof ICONS;

export default function Icon({ name, size = 16 }: { name: IconName; size?: number }) {
  const Svg = ICONS[name];
  return <Svg className="icon" width={size} height={size} strokeWidth={1.6} aria-hidden="true" />;
}
