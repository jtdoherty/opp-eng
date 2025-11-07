import { getLoginUrl } from "@/const";
import { trpc } from "@/lib/trpc";
import { TRPCClientError } from "@trpc/client";
import { useCallback, useEffect, useMemo } from "react";

type UseAuthOptions = {
  redirectOnUnauthenticated?: boolean;
  redirectPath?: string;
};

// 1. DEFINE A MOCK USER OBJECT
const MOCK_USER = {
  openId: "mock-user-dev-12345",
  email: "developer.user@yourdomain.com",
  name: "Local Dev User",
  loginMethod: "mock",
  // Add any other required user properties here (e.g., id, roles, etc.)
};

export function useAuth(options?: UseAuthOptions) {
  const { redirectOnUnauthenticated = false, redirectPath = getLoginUrl() } =
    options ?? {};
  const utils = trpc.useUtils();

  const meQuery = trpc.auth.me.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
  });
 
  // 2. CREATE A MOCKED QUERY OBJECT
  const mockedMeQuery = {
    ...meQuery, 
    data: MOCK_USER as typeof meQuery.data, // Replace the data with the mock user
    isLoading: false, 
    error: null,
  };

  // 3. SWITCH BETWEEN THE REAL AND MOCKED QUERY
  // This ensures the mock is only active during 'pnpm vite dev'
  const finalMeQuery = 
    process.env.NODE_ENV === "development" 
      ? mockedMeQuery 
      : meQuery;
      
  // Optional: Add logging to confirm the mock is active
  if (finalMeQuery === mockedMeQuery) {
      console.warn("MOCK USER MODE: useAuth is returning a static user object.");
  }


  const logoutMutation = trpc.auth.logout.useMutation({
    onSuccess: () => {
      utils.auth.me.setData(undefined, null);
    },
  });
// ... (signIn function remains the same) ...
    const signIn = useCallback(() => {
        // 1. Get the pre-calculated login URL
        const loginUrl = getLoginUrl();

        // 2. Perform the redirect to the external OAuth portal
        if (typeof window !== "undefined") {
            window.location.href = loginUrl;
        }
    }, []);

// ... (logout function remains the same) ...
  const logout = useCallback(async () => {
    try {
      await logoutMutation.mutateAsync();
    } catch (error: unknown) {
      if (
        error instanceof TRPCClientError &&
        error.data?.code === "UNAUTHORIZED"
      ) {
        return;
      }
      throw error;
    } finally {
      utils.auth.me.setData(undefined, null);
      await utils.auth.me.invalidate();
    }
  }, [logoutMutation, utils]);

  const state = useMemo(() => {
    localStorage.setItem(
      "manus-runtime-user-info",
      // 👇 Use finalMeQuery here
      JSON.stringify(finalMeQuery.data)
    );
    return {
      // 👇 Use finalMeQuery here
      user: finalMeQuery.data ?? null,
      loading: finalMeQuery.isLoading || logoutMutation.isPending,
      error: finalMeQuery.error ?? logoutMutation.error ?? null,
      isAuthenticated: Boolean(finalMeQuery.data),
    };
  }, [
    // 👇 Update dependencies
    finalMeQuery.data,
    finalMeQuery.error,
    finalMeQuery.isLoading,
    logoutMutation.error,
    logoutMutation.isPending,
  ]);

  useEffect(() => {
    if (!redirectOnUnauthenticated) return;
    if (finalMeQuery.isLoading || logoutMutation.isPending) return; // 👇 Use finalMeQuery
    if (state.user) return;
    if (typeof window === "undefined") return;
    if (window.location.pathname === redirectPath) return;

    window.location.href = redirectPath
  }, [
    redirectOnUnauthenticated,
    redirectPath,
    logoutMutation.isPending,
    finalMeQuery.isLoading, // 👇 Use finalMeQuery
    state.user,
  ]);

  return {
    ...state,
    signIn,
    // 👇 Use finalMeQuery here
    refresh: () => finalMeQuery.refetch(),
    logout,
  };
}