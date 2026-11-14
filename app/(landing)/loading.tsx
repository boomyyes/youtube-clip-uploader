import "../_landing/landing.css";

// The landing page's own loading state: the same dark backdrop the banana fades in on,
// so a refresh goes straight from black to the scene instead of flashing the app's skeleton.
export default function Loading() {
  return (
    <div className="landing" role="status" aria-label="Loading">
      <div className="stage" />
    </div>
  );
}
