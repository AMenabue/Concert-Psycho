"use client";

import { PassportCardGlows, RedStatCardGlows } from "@/components/home/flighty-card-glows";
import { FLIGHTY_HOME_ASSETS } from "@/lib/flighty/home-assets";
import { ChevronRight, Music, Plus, Settings as SettingsIcon, Users, XCircle } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef } from "react";
import type { FlightyAppHomePayload } from "./app-home-payload";
import { DashboardRedStatCard } from "@/components/home/red-stat-card";

const mono = "font-[family-name:var(--font-flighty-chivo),ui-monospace,monospace]";

/** iOS-like: scroll senza barra visibile (touch / trackpad) */
const hideScroll =
  "[scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden";

const learnMoreBase =
  "box-border flex h-[42px] w-[min(364px,calc(100%-28px))] shrink-0 items-center justify-between rounded-[8px] border-0 px-5 py-[9px] backdrop-blur-[19.5px] bg-[rgba(255,255,255,0.08)] " +
  "shadow-[inset_0_1px_0_rgba(255,255,255,0.2),inset_1px_0_0_rgba(255,255,255,0.06)]";

/** Pill “Learn more” sulla card gradient (testo blu come il resto della card). */
const learnMoreOnLight =
  "box-border flex h-[42px] w-[min(364px,calc(100%-28px))] shrink-0 items-center justify-between rounded-[8px] border border-[rgba(0,60,99,0.14)] px-5 py-[9px] backdrop-blur-[19.5px] bg-[rgba(255,255,255,0.42)] " +
  "shadow-[inset_0_1px_0_rgba(255,255,255,0.65),inset_1px_0_0_rgba(255,255,255,0.35)]";

const learnMoreRed =
  "box-border flex h-[42px] w-[min(364px,calc(100%-28px))] shrink-0 items-center justify-between rounded-[8px] border-0 px-5 py-[9px] backdrop-blur-[19.5px] bg-[rgba(255,255,255,0.08)] " +
  "shadow-[inset_0_1px_0_rgba(255,220,220,0.18),inset_1px_0_0_rgba(255,255,255,0.06)]";

const sheetShadow =
  "shadow-[0px_4px_4px_rgba(0,0,0,0.25),0px_-204px_82px_rgba(0,0,0,0.01),0px_-115px_69px_rgba(0,0,0,0.05),0px_-51px_51px_rgba(0,0,0,0.09)]";

export type FlightyFrame82Props = {
  variant?: "dark" | "light";
  /** Sostituisce il wrapper esterno (es. sheet fixed dalla home con mappa). */
  rootLayoutClassName?: string;
  /**
   * Dentro lo sheet home: padding come Frame 82 Figma (`20px 19px`), senza i 55px del frame
   * iPhone standalone; sfondo scroll allineato al tema.
   */
  embedInSheet?: boolean;
  /** Swipe verso il basso sulla fascia superiore: espande la mappa. */
  onRevealMap?: () => void;
  /** Swipe verso l'alto quando la sheet è già abbassata: torna alla posizione base (home). */
  onCollapseMap?: () => void;
  /** Pulsante X (home): stesso comportamento del tasto mappa (toggle). */
  onMapToggle?: () => void;
  /** Home: freccia su/giù al posto della X (`mapExpanded` = sheet abbassato / mappa visibile). */
  useChevronMapToggle?: boolean;
  /** Solo con `useChevronMapToggle`: `true` = mappa espansa → freccia su; `false` = sheet alto → freccia giù. */
  mapExpanded?: boolean;
  /** Home: quando la mappa è a tutto schermo, disabilita lo scroll delle schede sotto. */
  cardsScrollLocked?: boolean;
  /** Home app (localhost /): testi, link e dati reali; assente = prototipo Figma originale. */
  appHome?: FlightyAppHomePayload | null;
};

export function FlightyFrame82({
  variant = "dark",
  rootLayoutClassName,
  embedInSheet = false,
  onRevealMap,
  onCollapseMap,
  onMapToggle,
  useChevronMapToggle = false,
  mapExpanded = false,
  cardsScrollLocked = false,
  appHome = null,
}: FlightyFrame82Props) {
  const L = variant === "light";
  const H = appHome;
  const isAppHome = H != null;
  const swipeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!onRevealMap && !onCollapseMap) return;
    const el = swipeRef.current;
    if (!el) return;
    let y0: number | null = null;
    const onStart = (e: TouchEvent) => {
      y0 = e.touches[0]?.clientY ?? null;
    };
    const onEnd = (e: TouchEvent) => {
      if (y0 == null) return;
      const y1 = e.changedTouches[0]?.clientY;
      if (y1 == null) return;
      const dy = y1 - y0;
      const threshold = 56;
      if (!mapExpanded && dy > threshold) onRevealMap?.();
      else if (mapExpanded && dy < -threshold) onCollapseMap?.();
      y0 = null;
    };
    el.addEventListener("touchstart", onStart, { passive: true });
    el.addEventListener("touchend", onEnd, { passive: true });
    return () => {
      el.removeEventListener("touchstart", onStart);
      el.removeEventListener("touchend", onEnd);
    };
  }, [onRevealMap, onCollapseMap, mapExpanded]);

  const outerStandalone = L
    ? `backdrop-blur-[35.25px] bg-[rgba(252,252,252,0.99)] border-4 border-[rgba(212,212,212,0.46)] border-solid flex flex-col items-center px-[19px] pt-[55px] pb-5 relative rounded-t-[15px] w-full min-h-[100dvh] max-w-[430px] mx-auto ${sheetShadow}`
    : `backdrop-blur-[35.25px] bg-[rgba(19,19,19,0.99)] border-2 border-[rgba(31,31,31,0.46)] border-solid flex flex-col items-center px-[19px] py-5 relative rounded-t-[15px] w-full min-h-[100dvh] max-w-[430px] mx-auto ${sheetShadow}`;

  /** Figma Frame 82: `padding: 20px 19px` — embed allineato; standalone iPhone usa pt 55. */
  const embedTopPad = embedInSheet ? "pt-[20px]" : "pt-[55px]";
  const embedBottomPad = embedInSheet ? "pb-0" : "pb-5";
  const outerClass = rootLayoutClassName
    ? `${rootLayoutClassName} flex min-h-0 w-full flex-1 flex-col overflow-hidden px-[19px] ${embedTopPad} ${embedBottomPad}`
    : outerStandalone;

  const innerScrollH = rootLayoutClassName
    ? "relative min-h-0 w-full flex-1 shrink-0 flex flex-col"
    : "h-[min(958px,calc(100dvh-40px))] relative shrink-0 w-full flex flex-col justify-start";

  const stickyBar = L ? "bg-[rgba(252,252,252,0.96)]" : "bg-[rgba(19,19,19,0.96)]";
  const scrollSurface = L ? "bg-[rgba(252,252,252,0.99)]" : "bg-[rgba(19,19,19,0.99)]";
  const profileName = L ? "text-[rgba(0,0,0,0.99)]" : "text-[rgba(255,255,255,0.99)]";
  const profileSub = L ? "text-[rgba(6,6,6,0.47)]" : "text-[rgba(255,255,255,0.47)]";
  const tabBtn = L
    ? "bg-[#EEEEEE] border-[#C7C7C7] hover:bg-[#E8E8E8]"
    : "bg-[#262626] border-[#414141] hover:bg-[#303030]";
  const tabText = L ? "text-[#313131]" : "text-[#ebebeb]";
  const tabIcon = L ? "brightness-0" : "";
  const yearPill = L ? "bg-[#EFEFEF] border-[#D8D8D8]" : "bg-[#262626] border-[#414141]";
  /** Etichette anni: leggere come nel frame. */
  const allTimeText = L ? "text-black font-light" : "text-white font-light";
  const yearText = L ? "text-[#777] font-light" : "text-[#777] font-light";
  /** Sotto l’ultima card: padding scroll (embed); striscia nera aggiunta in coda al contenuto. */
  const scrollInnerPad = embedInSheet ? "pb-6" : "pb-8";
  const passportFrameClass = embedInSheet
    ? "bg-[#170144] relative min-h-[298px] flex-1 w-full overflow-hidden rounded-[16px]"
    : "bg-[#170144] relative h-[298px] w-full overflow-hidden rounded-[16px] shrink-0";

  return (
    <div className={outerClass} data-node-id="4004:1898">
      <div className={innerScrollH} data-node-id="4004:1899">
        <div className="relative flex flex-col gap-[23px] items-stretch w-full max-w-[392px] mx-auto flex-1 min-h-0" data-node-id="4004:1900">
          <div
            ref={swipeRef}
            className="flex flex-col gap-[13px] items-start justify-center relative shrink-0 w-full touch-pan-y"
            data-node-id="4004:1901"
          >
            {isAppHome ? (
              <>
                <div
                  className={`flex w-full justify-between items-center gap-[121px] shrink-0 h-[50px] sticky top-0 z-10 ${stickyBar}`}
                  data-node-id="4004:1902"
                >
                  <div className="flex gap-[12px] items-center relative shrink-0 min-w-0 flex-1" data-node-id="4004:1903">
                    <div className="relative flex size-[50px] shrink-0 items-center justify-center overflow-hidden rounded-full border border-[#414141] bg-[#262626]">
                      {H.avatarUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          alt=""
                          className="size-full object-cover"
                          src={H.avatarUrl}
                          width={50}
                          height={50}
                        />
                      ) : (
                        <Music className="size-[22px] text-white/90" strokeWidth={2} aria-hidden />
                      )}
                    </div>
                    <div
                      className="flex max-w-[184px] min-w-0 flex-1 flex-col gap-[3px] items-start text-left leading-normal not-italic relative shrink-0"
                      data-node-id="4004:1905"
                    >
                      <p
                        className={`font-semibold min-h-[23px] relative shrink-0 text-[20px] leading-[24px] w-full truncate ${profileName}`}
                        data-node-id="4004:1906"
                      >
                        {H.displayName}
                      </p>
                      <p
                        className={`font-light min-h-[16px] relative shrink-0 text-[14px] leading-[17px] w-full ${profileSub}`}
                        data-node-id="4004:1907"
                      >
                        {H.tagline}
                      </p>
                    </div>
                  </div>
                  {onMapToggle || onRevealMap ? (
                    <button
                      type="button"
                      onClick={onMapToggle ?? onRevealMap}
                      className="relative ml-auto flex size-[26px] shrink-0 items-center justify-center text-white/90 hover:text-white"
                      aria-label={
                        onMapToggle
                          ? mapExpanded
                            ? "Mostra di nuovo la scheda"
                            : "Mostra la heat map"
                          : "Mostra mappa"
                      }
                      data-node-id="4004:1908"
                    >
                      {useChevronMapToggle && onMapToggle ? (
                        <svg
                          width={22}
                          height={22}
                          viewBox="0 0 24 24"
                          fill="none"
                          aria-hidden
                          className={`transition-transform duration-300 ease-out ${mapExpanded ? "rotate-180" : ""}`}
                        >
                          <path
                            d="M6 9l6 6 6-6"
                            stroke="currentColor"
                            strokeWidth="2.25"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      ) : (
                        <XCircle className={`size-[26px] ${L ? "opacity-90" : ""}`} strokeWidth={1.75} aria-hidden />
                      )}
                    </button>
                  ) : (
                    <Link
                      href="/"
                      className="relative ml-auto shrink-0 size-[26px] text-white/80 hover:text-white"
                      aria-label="Chiudi anteprima"
                      data-node-id="4004:1908"
                    >
                      <XCircle className="size-[26px]" strokeWidth={1.75} aria-hidden />
                    </Link>
                  )}
                </div>
                <div
                  className={`flex w-full gap-[19px] items-center shrink-0 sticky top-0 z-10 h-[38px] ${stickyBar}`}
                  data-node-id="4004:1912"
                >
                  <Link
                    href="/concerts/new"
                    className={`box-border flex h-[38px] w-[170px] shrink-0 items-center gap-[11px] rounded-[11px] border border-solid py-[9px] pl-[15px] pr-[10px] ${tabBtn}`}
                  >
                    <Plus className="size-[20px] shrink-0 text-white" strokeWidth={2} aria-hidden />
                    <div
                      className={`relative flex h-[20px] shrink-0 flex-col justify-center text-left text-[16px] font-light leading-[19px] not-italic whitespace-nowrap ${tabText}`}
                    >
                      <p>Add Concert</p>
                    </div>
                  </Link>
                  <Link
                    href="/settings"
                    className={`box-border flex h-[38px] w-[126px] shrink-0 items-center gap-[11px] rounded-[11px] border border-solid py-[9px] pl-[15px] pr-[10px] ${tabBtn}`}
                  >
                    <SettingsIcon className="size-[20px] shrink-0 text-white" strokeWidth={2} aria-hidden />
                    <div
                      className={`relative flex h-[20px] shrink-0 flex-col justify-center text-left text-[16px] font-light leading-[19px] not-italic whitespace-nowrap ${tabText}`}
                    >
                      <p>Settings</p>
                    </div>
                  </Link>
                </div>
              </>
            ) : (
              <>
                <div
                  className={`flex w-full justify-between items-center gap-[121px] shrink-0 h-[50px] sticky top-0 z-10 ${stickyBar}`}
                  data-node-id="4004:1902"
                >
                  <div className="flex gap-[12px] items-center relative shrink-0 min-w-0 flex-1" data-node-id="4004:1903">
                    <div className="relative flex size-[50px] shrink-0 items-center justify-center overflow-hidden rounded-full border border-[#414141] bg-[#262626]" data-node-id="4004:1904">
                      <Music className="size-[22px] text-white/90" strokeWidth={2} aria-hidden />
                    </div>
                    <div
                      className="flex max-w-[184px] min-w-0 flex-1 flex-col gap-[3px] items-start text-left leading-normal not-italic relative shrink-0"
                      data-node-id="4004:1905"
                    >
                      <p
                        className={`font-semibold min-h-[23px] relative shrink-0 text-[20px] leading-[24px] w-full truncate ${profileName}`}
                        data-node-id="4004:1906"
                      >
                        Clint P Henderson
                      </p>
                      <p
                        className={`font-light min-h-[16px] relative shrink-0 text-[14px] leading-[17px] w-full ${profileSub}`}
                        data-node-id="4004:1907"
                      >
                        My flight log
                      </p>
                    </div>
                  </div>
                  {onMapToggle || onRevealMap ? (
                    <button
                      type="button"
                      onClick={onMapToggle ?? onRevealMap}
                      className="relative ml-auto flex size-[26px] shrink-0 items-center justify-center text-white/90 hover:text-white"
                      aria-label={
                        onMapToggle
                          ? mapExpanded
                            ? "Mostra di nuovo la scheda"
                            : "Mostra la heat map"
                          : "Mostra mappa"
                      }
                      data-node-id="4004:1908"
                    >
                      {useChevronMapToggle && onMapToggle ? (
                        <svg
                          width={22}
                          height={22}
                          viewBox="0 0 24 24"
                          fill="none"
                          aria-hidden
                          className={`transition-transform duration-300 ease-out ${mapExpanded ? "rotate-180" : ""}`}
                        >
                          <path
                            d="M6 9l6 6 6-6"
                            stroke="currentColor"
                            strokeWidth="2.25"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      ) : (
                        <XCircle className={`size-[26px] ${L ? "opacity-90" : ""}`} strokeWidth={1.75} aria-hidden />
                      )}
                    </button>
                  ) : (
                    <Link
                      href="/"
                      className="relative ml-auto shrink-0 size-[26px] text-white/80 hover:text-white"
                      aria-label="Chiudi anteprima"
                      data-node-id="4004:1908"
                    >
                      <XCircle className="size-[26px]" strokeWidth={1.75} aria-hidden />
                    </Link>
                  )}
                </div>
                <div
                  className={`flex w-full gap-[19px] items-center shrink-0 sticky top-0 z-10 h-[38px] ${stickyBar}`}
                  data-node-id="4004:1912"
                >
                  <Link
                    href="/prototype/flighty/friends"
                    className={`box-border border border-solid flex gap-[11px] items-center h-[38px] w-[170px] shrink-0 py-[9px] pl-[15px] pr-[10px] rounded-[11px] ${tabBtn}`}
                    data-node-id="4004:1913"
                  >
                    <Users className="size-[20px] shrink-0 text-white" strokeWidth={2} aria-hidden />
                    <div
                      className={`flex flex-col h-[20px] justify-center leading-[19px] not-italic relative shrink-0 text-[16px] text-left whitespace-nowrap font-light ${tabText}`}
                      data-node-id="4004:1919"
                    >
                      <p>Flighty Friends</p>
                    </div>
                  </Link>
                  <Link
                    href="/prototype/flighty/settings"
                    className={`box-border border border-solid flex gap-[11px] items-center h-[38px] w-[126px] shrink-0 py-[9px] pl-[15px] pr-[10px] rounded-[11px] ${tabBtn}`}
                    data-node-id="4004:1920"
                  >
                    <SettingsIcon className="size-[20px] shrink-0 text-white" strokeWidth={2} aria-hidden />
                    <div
                      className={`flex flex-col h-[20px] justify-center leading-[19px] not-italic relative shrink-0 text-[16px] text-left whitespace-nowrap font-light ${tabText}`}
                      data-node-id="4004:1924"
                    >
                      <p>Settings</p>
                    </div>
                  </Link>
                </div>
                <div
                  className={`flex w-full h-[38px] gap-[28px] items-center relative shrink-0 overflow-x-auto overflow-y-hidden ${hideScroll}`}
                  data-node-id="4004:1925"
                >
                  <div
                    className={`box-border border border-solid flex h-[38px] shrink-0 items-center justify-center gap-[10px] px-[14px] py-[10px] rounded-[11px] ${yearPill}`}
                    data-node-id="4004:1926"
                  >
                    <p
                      className={`leading-[18px] not-italic relative shrink-0 text-[15px] text-left whitespace-nowrap h-[18px] ${allTimeText}`}
                      data-node-id="4004:1927"
                    >
                      All-Time
                    </p>
                  </div>
                  <p
                    className={`leading-[18px] not-italic relative shrink-0 text-[15px] text-left whitespace-nowrap shrink-0 h-[18px] ${yearText}`}
                    data-node-id="4004:1928"
                  >
                    2024
                  </p>
                  <p
                    className={`leading-[18px] not-italic relative shrink-0 text-[15px] text-left whitespace-nowrap shrink-0 h-[18px] ${yearText}`}
                    data-node-id="4004:1929"
                  >
                    2023
                  </p>
                  <p
                    className={`leading-[18px] not-italic relative shrink-0 text-[15px] text-left whitespace-nowrap shrink-0 h-[18px] ${yearText}`}
                    data-node-id="4004:1930"
                  >
                    2022
                  </p>
                  <p
                    className={`leading-[18px] not-italic relative shrink-0 text-[15px] text-left whitespace-nowrap shrink-0 h-[18px] ${yearText}`}
                    data-node-id="4004:1931"
                  >
                    2021
                  </p>
                  <p
                    className={`leading-[18px] not-italic relative shrink-0 text-[15px] text-left whitespace-nowrap shrink-0 h-[18px] ${yearText}`}
                    data-node-id="4004:1932"
                  >
                    2020
                  </p>
                </div>
              </>
            )}
          </div>
          <div
            className={`flex-1 min-h-0 overflow-x-clip relative w-full flex flex-col ${hideScroll} ${scrollSurface} ${
              cardsScrollLocked
                ? "overflow-y-hidden touch-none overscroll-y-contain"
                : "overflow-y-auto"
            }`}
            data-node-id="4004:1933"
          >
            <div
              className={`flex flex-col gap-[10px] items-stretch left-0 top-0 w-full ${scrollInnerPad} ${scrollSurface} min-h-full`}
              data-node-id="4004:1934"
            >
              <div className={passportFrameClass} data-node-id="4004:1935">
                <PassportCardGlows />
                <div
                  className="absolute left-[26px] top-[26px] z-10 flex w-[min(312px,calc(100%-52px))] flex-col gap-[18px] text-left"
                  data-node-id="4004:1938"
                >
                  {isAppHome && H ? (
                    <>
                      <div className="flex max-w-[262px] flex-col gap-[6px] leading-normal not-italic" data-node-id="4004:1939">
                        <p
                          className="font-semibold text-[20px] leading-[24px] text-[rgba(255,255,255,0.99)] pr-8 whitespace-nowrap"
                          data-node-id="4004:1940"
                        >
                          Lifetime Passport
                        </p>
                        <p
                          className="font-light text-[12px] leading-[15px] text-[rgba(255,255,255,0.47)]"
                          data-node-id="4004:1941"
                        >
                          Passport · Pass · Pasaporte
                        </p>
                      </div>
                      <div
                        className="flex w-[294px] max-w-full shrink-0 flex-row items-center justify-between"
                        data-node-id="4004:1942"
                      >
                        <div className="flex w-[56px] shrink-0 flex-col gap-[10px] items-start" data-node-id="4004:1943">
                          <p
                            className="whitespace-nowrap font-light text-[14px] leading-[17px] text-[rgba(255,255,255,0.47)]"
                            data-node-id="4004:1944"
                          >
                            Concerts
                          </p>
                          <p
                            className={`${mono} font-semibold text-[28px] leading-[33px] text-white`}
                            data-node-id="4004:1945"
                          >
                            {H.concertsCount}
                          </p>
                        </div>
                        <div className="flex w-[122px] shrink-0 flex-col gap-[10px] items-start" data-node-id="4004:1946">
                          <p
                            className="whitespace-nowrap font-light text-[14px] leading-[17px] text-[rgba(255,255,255,0.47)]"
                            data-node-id="4004:1947"
                          >
                            Km Traveled
                          </p>
                          <p
                            className={`${mono} font-semibold text-[28px] leading-[33px] text-white tracking-tight`}
                            data-node-id="4004:1948"
                          >
                            {H.kmTraveledFormatted}
                          </p>
                        </div>
                      </div>
                      <div
                        className="flex w-[312px] max-w-full shrink-0 flex-row flex-nowrap gap-[67px]"
                        data-node-id="4004:1949"
                      >
                        <div
                          className="flex w-[70px] shrink-0 flex-col gap-[6px] items-start"
                          data-node-id="4004:1951"
                        >
                          <p className="whitespace-nowrap text-[14px] font-light leading-[17px] text-[rgba(255,255,255,0.47)]">
                            Music time
                          </p>
                          <p
                            className={`${mono} whitespace-nowrap font-semibold text-[24px] leading-[29px] text-white tabular-nums`}
                            data-node-id="4004:1955"
                          >
                            {H.musicTimeHours}
                          </p>
                        </div>
                        <div
                          className="flex w-[58px] shrink-0 flex-col gap-[6px] items-center"
                          data-node-id="4004:1952"
                        >
                          <p className="w-full whitespace-nowrap text-center text-[14px] font-light leading-[17px] text-[rgba(255,255,255,0.47)]">
                            Artists
                          </p>
                          <p
                            className={`${mono} w-full text-center font-semibold text-[24px] leading-[29px] text-white tabular-nums`}
                            data-node-id="4004:1956"
                          >
                            {H.artistsCount}
                          </p>
                        </div>
                        <div
                          className="flex w-[50px] shrink-0 flex-col gap-[6px] items-center"
                          data-node-id="4004:1953"
                        >
                          <p className="w-full whitespace-nowrap text-center text-[14px] font-light leading-[17px] text-[rgba(255,255,255,0.47)]">
                            Venues
                          </p>
                          <p
                            className={`${mono} w-full text-center font-semibold text-[24px] leading-[29px] text-white tabular-nums`}
                            data-node-id="4004:1957"
                          >
                            {H.venuesCount}
                          </p>
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex max-w-[262px] flex-col gap-[6px] leading-normal not-italic" data-node-id="4004:1939">
                        <p
                          className="font-semibold text-[20px] leading-[24px] text-[rgba(255,255,255,0.99)]"
                          data-node-id="4004:1940"
                        >
                          All - Time Flighty Passport
                        </p>
                        <p
                          className="font-light text-[12px] leading-[15px] text-[rgba(255,255,255,0.47)]"
                          data-node-id="4004:1941"
                        >
                          Passport ⋅ Pass ⋅ Pasaporte
                        </p>
                      </div>
                      <div
                        className="flex w-[294px] max-w-full shrink-0 flex-row items-center justify-between"
                        data-node-id="4004:1942"
                      >
                        <div className="flex w-[56px] shrink-0 flex-col gap-[10px] items-start" data-node-id="4004:1943">
                          <p
                            className="whitespace-nowrap font-light text-[14px] leading-[17px] text-[rgba(255,255,255,0.47)]"
                            data-node-id="4004:1944"
                          >
                            Flights
                          </p>
                          <p
                            className={`${mono} font-semibold text-[28px] leading-[33px] text-white`}
                            data-node-id="4004:1945"
                          >
                            306
                          </p>
                        </div>
                        <div className="flex w-[122px] shrink-0 flex-col gap-[10px] items-start" data-node-id="4004:1946">
                          <p
                            className="whitespace-nowrap font-light text-[14px] leading-[17px] text-[rgba(255,255,255,0.47)]"
                            data-node-id="4004:1947"
                          >
                            Distance (Miles)
                          </p>
                          <p
                            className={`${mono} font-semibold text-[28px] leading-[33px] text-white tracking-tight`}
                            data-node-id="4004:1948"
                          >
                            506,162
                          </p>
                        </div>
                      </div>
                      <div className="flex w-full max-w-[312px] flex-col gap-[6px]" data-node-id="4004:1949">
                        <div
                          className="flex w-[312px] max-w-full shrink-0 flex-nowrap items-center gap-[67px] text-[14px] font-light leading-[17px] text-[rgba(255,255,255,0.47)]"
                          data-node-id="4004:1950"
                        >
                          <p className="w-[70px] shrink-0 whitespace-nowrap" data-node-id="4004:1951">
                            Flight time
                          </p>
                          <p className="w-[58px] shrink-0 whitespace-nowrap" data-node-id="4004:1952">
                            Airports
                          </p>
                          <p className="w-[50px] shrink-0 whitespace-nowrap" data-node-id="4004:1953">
                            Airlines
                          </p>
                        </div>
                        <div className="relative h-[33px] w-[302px] max-w-full" data-node-id="4004:1954">
                          <p
                            className={`${mono} absolute left-0 top-[5px] font-semibold text-[24px] leading-[29px] text-white`}
                            data-node-id="4004:1955"
                          >
                            50d 21h
                          </p>
                          <p
                            className={`${mono} absolute left-[149px] top-[5px] font-semibold text-[24px] leading-[29px] text-white`}
                            data-node-id="4004:1956"
                          >
                            81
                          </p>
                          <p
                            className={`${mono} absolute left-[272px] top-[5px] font-semibold text-[24px] leading-[29px] text-white`}
                            data-node-id="4004:1957"
                          >
                            20
                          </p>
                        </div>
                      </div>
                    </>
                  )}
                </div>
                {isAppHome && H ? (
                  <Link
                    href="/passport"
                    className={`absolute left-[calc(50%-1px)] top-[238px] z-30 -translate-x-1/2 ${learnMoreBase}`}
                    data-node-id="4004:1958"
                  >
                    <span
                      className="font-light text-[14px] leading-[17px] text-white"
                      data-node-id="4004:1959"
                    >
                      Learn More
                    </span>
                    <span className="relative shrink-0 size-[24px]" data-node-id="4004:1960">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img alt="" src={FLIGHTY_HOME_ASSETS.chevronRight} width={24} height={24} />
                    </span>
                  </Link>
                ) : (
                  <button
                    type="button"
                    className={`absolute left-[calc(50%-1px)] top-[238px] z-30 -translate-x-1/2 ${learnMoreBase}`}
                    data-node-id="4004:1958"
                  >
                    <span
                      className="font-light text-[14px] leading-[17px] text-white"
                      data-node-id="4004:1959"
                    >
                      Learn More
                    </span>
                    <span className="relative shrink-0 size-[24px]" data-node-id="4004:1960">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img alt="" src={FLIGHTY_HOME_ASSETS.chevronRight} width={24} height={24} />
                    </span>
                  </button>
                )}
                {!(isAppHome && H) ? (
                  <div className="absolute right-[21px] top-[23px] z-10 h-[20px] w-[21px]" data-node-id="4004:1962" aria-hidden />
                ) : null}
              </div>
              {isAppHome && H ? (
                <DashboardRedStatCard
                  uniqueSongsCount={H.uniqueSongsCount}
                  templates={H.cardTemplates}
                  statsExploreHref="/statistics"
                />
              ) : (
                <div
                  className="bg-[#621013] relative h-[215px] w-full overflow-hidden rounded-[16px] shrink-0"
                  data-node-id="4004:1967"
                >
                  <RedStatCardGlows />
                  <button
                    type="button"
                    className={`absolute left-[calc(50%+1px)] top-[159px] z-20 -translate-x-1/2 ${learnMoreRed}`}
                    data-node-id="4004:1970"
                  >
                    <span
                      className="font-light text-[14px] leading-[17px] text-white"
                      data-node-id="4004:1971"
                    >
                      Learn More
                    </span>
                    <span className="relative shrink-0 size-[24px]" data-node-id="4004:1972">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img alt="" src={FLIGHTY_HOME_ASSETS.chevronRight} width={24} height={24} />
                    </span>
                  </button>
                  <div
                    className="absolute left-[20px] top-[18px] flex w-[89px] flex-col justify-center font-semibold leading-[76px] text-[64px] text-white"
                    style={{ fontFamily: "var(--font-flighty-chivo), ui-monospace, monospace" }}
                    data-node-id="4004:1974"
                  >
                    <p>44</p>
                  </div>
                  <div
                    className="absolute left-[20px] top-[92px] flex w-[min(292px,calc(100%-40px))] flex-col gap-px text-left text-[18px] leading-[22px] not-italic"
                    data-node-id="4004:1975"
                  >
                    <p
                      className="font-semibold text-[rgba(255,255,255,0.99)]"
                      data-node-id="4004:1976"
                    >
                      hours lost from delays
                    </p>
                    <p
                      className="font-light text-[rgba(255,255,255,0.46)]"
                      data-node-id="4004:1977"
                    >
                      Delayed flights averaged 24m late
                    </p>
                  </div>
                </div>
              )}
              {isAppHome && H ? (
                H.latest ? (
                  <div
                    className="relative h-[215px] w-full shrink-0 overflow-hidden rounded-[16px]"
                    data-node-id="4004:1983"
                    style={{
                      backgroundImage:
                        "linear-gradient(238.93deg, rgb(206, 223, 240) 4.67%, rgb(195, 199, 248) 68.8%)",
                    }}
                  >
                    <div className="absolute left-[22px] top-[24px] flex w-[min(280px,calc(100%-40px))] flex-col items-start gap-[4px] text-left leading-normal text-[#003c63]">
                      <p className="font-semibold text-[20px] leading-[24px] text-[#003c63]">Latest Concert</p>
                      <p
                        className={`${mono} line-clamp-2 font-normal text-[34px] leading-[40px] tracking-tight text-[#003c63]`}
                      >
                        {H.latest.artistName}
                      </p>
                    </div>
                    <p className="absolute left-[20px] top-[93px] font-light text-[16px] leading-[19px] text-[rgba(25,78,118,0.58)]">
                      {H.latest.venueCityLine}
                    </p>
                    <p className="absolute left-[20px] top-[118px] font-light text-[15px] leading-[19px] text-[#003c63]/80">
                      {H.latest.dateLabel}
                    </p>
                    {H.latest.tourName ? (
                      <p className="absolute left-[20px] top-[138px] max-w-[calc(100%-32px)] truncate text-[13px] font-light text-[rgba(25,78,118,0.55)]">
                        {H.latest.tourName}
                      </p>
                    ) : null}
                    <Link
                      href="/concerts"
                      className={`absolute left-[calc(50%-1px)] top-[159px] z-30 -translate-x-1/2 ${learnMoreOnLight}`}
                    >
                      <span className="font-light text-[14px] leading-[17px] text-[#003c63]">View all concerts</span>
                      <ChevronRight className="size-6 shrink-0 text-[#003c63]" strokeWidth={2} aria-hidden />
                    </Link>
                  </div>
                ) : (
                  <p className="rounded-[16px] border border-neutral-800 bg-neutral-900/50 px-4 py-6 text-center text-sm text-neutral-500">
                    No concerts yet. Use <strong>Add Concert</strong> to log your first show.
                  </p>
                )
              ) : (
                <div
                  className="relative h-[215px] w-full shrink-0 overflow-hidden rounded-[16px]"
                  data-node-id="4004:1983"
                  style={{
                    backgroundImage:
                      "linear-gradient(238.93deg, rgb(206, 223, 240) 4.67%, rgb(195, 199, 248) 68.8%)",
                  }}
                >
                  <div
                    className="absolute flex flex-col gap-[4px] items-start leading-normal left-[22px] text-[#003c63] text-left top-[24px] w-[min(210px,90%)]"
                    data-node-id="4004:1989"
                  >
                    <p
                      className="font-semibold text-[20px] leading-[24px] text-[#003c63]"
                      data-node-id="4004:1990"
                    >
                      Most Flown aircraft
                    </p>
                    <p
                      className={`${mono} font-normal text-[34px] leading-[40px] tracking-tight text-[#003c63]`}
                      data-node-id="4004:1991"
                    >
                      B737-800
                    </p>
                  </div>
                  <p
                    className="absolute left-[20px] top-[93px] font-light text-[16px] leading-[19px] text-[rgba(25,78,118,0.58)]"
                    data-node-id="4004:1992"
                  >
                    57 flights
                  </p>
                  <div
                    className="absolute left-[19px] top-[91px] h-[80px] w-[min(342px,calc(100%-38px))] rounded-lg opacity-40"
                    data-node-id="4004:1993"
                    style={{
                      background:
                        "linear-gradient(135deg, rgba(0,60,99,0.12) 0%, rgba(195,199,248,0.32) 100%)",
                    }}
                    aria-hidden
                  />
                </div>
              )}
              {embedInSheet ? (
                <div className={`h-24 w-full shrink-0 ${scrollSurface}`} aria-hidden />
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
