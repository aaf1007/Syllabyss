import Link from "next/link";
import { SignUp } from "@clerk/nextjs";

export default function SignUpPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4">
      <SignUp />
      <p className="max-w-sm px-4 text-center text-xs text-faint">
        By signing up you agree to our{" "}
        <Link href="/terms" className="text-signal underline underline-offset-4">
          Terms
        </Link>{" "}
        and{" "}
        <Link href="/privacy" className="text-signal underline underline-offset-4">
          Privacy Policy
        </Link>
        .
      </p>
    </div>
  );
}
