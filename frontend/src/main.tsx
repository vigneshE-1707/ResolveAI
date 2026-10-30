import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"

import { App } from "@/App"
import { RoleProvider } from "@/app/role-context"
import { Toaster } from "@/components/ui/sonner"
import "./index.css"

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RoleProvider>
        <App />
        <Toaster />
      </RoleProvider>
    </QueryClientProvider>
  </StrictMode>
)
