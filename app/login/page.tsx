import LoginForm from "./login-form"

// Server wrapper: reads ALLOW_PUBLIC_REGISTER at request time so the "Sign up" link
// only appears when public self-registration is enabled.
export const dynamic = "force-dynamic"

export default function LoginPage() {
  return <LoginForm allowRegister={process.env.ALLOW_PUBLIC_REGISTER === "1"} />
}
