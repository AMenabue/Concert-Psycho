/** Full-height subpage shell with internal scroll (concerts list, statistics). */
export const APP_SUBPAGE_MAIN_CLASS =
  "relative flex h-[100dvh] max-h-[100dvh] w-full flex-col overflow-hidden bg-[rgba(19,19,19,0.99)] text-white";

/** Scrollable subpage shell (concert detail). */
export const APP_SUBPAGE_MAIN_SCROLL_CLASS =
  "relative flex min-h-[100dvh] w-full flex-col overflow-x-hidden bg-[rgba(19,19,19,0.99)] text-white";

/** Column below the header — no horizontal padding (swiper panels handle their own). */
export const APP_SUBPAGE_BODY_CLASS =
  "relative z-10 mx-auto mt-6 flex min-h-0 w-full max-w-[430px] flex-1 flex-col";

export const HIDE_SCROLLBAR_CLASS =
  "[scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden";
