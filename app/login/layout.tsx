import { redirectIfAuthenticated } from "@/lib/auth/session-guard";

export default async function LoginLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await redirectIfAuthenticated();
  return children;
}
