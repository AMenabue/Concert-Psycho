import { FLIGHTY_HOME_ASSETS } from "@/lib/flighty/home-assets";

/** Figma-exported blur ellipses + CSS wash (SVG glows sit low in viewBox — top edge needs fill). */
export function RedStatCardGlows() {
  return (
    <div
      className="pointer-events-none absolute inset-0 z-0 overflow-hidden rounded-[inherit]"
      aria-hidden
    >
      <div
        className="absolute inset-0"
        style={{
          backgroundColor: "#621013",
          backgroundImage: [
            "radial-gradient(ellipse 90% 70% at 50% -18%, rgba(189, 22, 26, 0.5) 0%, transparent 62%)",
            "radial-gradient(ellipse 70% 55% at 88% 108%, rgba(189, 22, 26, 0.55) 0%, transparent 58%)",
            "radial-gradient(ellipse 55% 85% at 4% 58%, rgba(189, 22, 26, 0.42) 0%, transparent 55%)",
          ].join(", "),
        }}
      />
      {/* Ellipse 372 — left */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        alt=""
        src={FLIGHTY_HOME_ASSETS.redGlowLeft}
        className="pointer-events-none absolute left-[-34px] top-0 z-[1] h-[215px] w-[260px] max-w-none select-none"
        draggable={false}
      />
      {/* Ellipse 373 — bottom (SVG ellipse is near cy=206; bleed upward) */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        alt=""
        src={FLIGHTY_HOME_ASSETS.redGlowBottom}
        className="pointer-events-none absolute left-1/2 top-[-28px] z-[1] h-[calc(100%+56px)] w-full min-w-[392px] max-w-none -translate-x-1/2 select-none object-cover object-center"
        draggable={false}
      />
    </div>
  );
}

export function PassportCardGlows() {
  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        alt=""
        src={FLIGHTY_HOME_ASSETS.passportGlowLeft}
        className="pointer-events-none absolute left-[-32px] top-[95px] z-0 h-[298px] w-[275px] max-w-none select-none"
        draggable={false}
      />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        alt=""
        src={FLIGHTY_HOME_ASSETS.passportGlowBottom}
        className="pointer-events-none absolute bottom-0 left-1/2 z-0 h-[243px] w-full min-w-[392px] max-w-none -translate-x-1/2 select-none"
        draggable={false}
      />
    </>
  );
}
