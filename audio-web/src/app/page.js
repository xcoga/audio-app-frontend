"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { isAuthenticated } from "@/utils/auth";

export default function HomePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [isAuth, setIsAuth] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const checkAuth = async () => {
        try {
          const authStatus = await isAuthenticated();
          setIsAuth(authStatus);

          if (!authStatus) {
            router.push("/login");
          } else {
            // Dispatch login event to update navbar
            window.dispatchEvent(new Event("login"));
          }
        } catch (error) {
          console.error("Authentication check failed:", error);
          router.push("/login");
        } finally {
          setLoading(false);
        }
      };

      checkAuth();
    }
  }, [router]);

  // Only render content if authenticated and not loading
  if (loading) {
    return <div>Loading...</div>;
  }

  // Return null if not authenticated (prevents flashing content)
  if (!isAuth) {
    return null;
  }

  return (
    <div>
      <h1>Home page</h1>
      <p>Start using the app by uploading or viewing your audio files!</p>
    </div>
  );
}