import { Skeleton } from "@/components/ui/skeleton"

export default function LoginLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-muted p-4">
      <div className="w-full max-w-md space-y-4">
        <Skeleton className="h-12 w-48 mx-auto" />
        <Skeleton className="h-96 w-full" />
      </div>
    </div>
  )
}
