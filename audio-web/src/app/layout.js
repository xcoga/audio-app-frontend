"use client";
import React, { useState, useEffect } from 'react';
import styles from '../styles/navbar.module.css';
import { useRouter } from 'next/navigation';
import { checkAuthStatus, logout } from '@/utils/auth';
import Link from 'next/link';

export default function RootLayout({ children }) {
  // Authentication state
  const [isAuthState, setIsAuthState] = useState(false);
  const [username, setUsername] = useState('');
  const [mounted, setMounted] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const router = useRouter();

  // Function to update authentication state - only call this once initially
  // and then only in response to specific events
  const updateAuthState = async () => {
    try {
      // First check local session storage immediately
      if (typeof window !== 'undefined') {
        const localAuthStatus = sessionStorage.getItem('isAuthenticated') === 'true';
        const localUsername = sessionStorage.getItem('username') || '';

        // Update UI immediately with what we have in session storage
        if (localAuthStatus) {
          setIsAuthState(true);
          setUsername(localUsername);
        }
      }

      // Only verify with server if not already authenticated from session storage
      // or if forced verification is needed
      const isAuth = await checkAuthStatus();

      if (isAuth) {
        setIsAuthState(true);
        if (typeof window !== 'undefined') {
          setUsername(sessionStorage.getItem('username') || '');
        }
      } else {
        setIsAuthState(false);
        setUsername('');
      }
    } catch (error) {
      console.error("Error updating auth state:", error);

      // If server check fails, still use session storage as fallback
      if (typeof window !== 'undefined') {
        setIsAuthState(sessionStorage.getItem('isAuthenticated') === 'true');
        setUsername(sessionStorage.getItem('username') || '');
      } else {
        setIsAuthState(false);
      }
    } finally {
      setAuthChecked(true);
    }
  };

  useEffect(() => {
    // Set mounted to true to avoid hydration mismatch
    setMounted(true);

    // Only do authentication check once during initial load
    if (!authChecked) {
      // Check session storage first (immediate, no API call)
      if (typeof window !== 'undefined') {
        const storedAuthStatus = sessionStorage.getItem('isAuthenticated') === 'true';
        if (storedAuthStatus) {
          setIsAuthState(true);
          setUsername(sessionStorage.getItem('username') || '');
        }
      }

      // Then validate with server only once
      updateAuthState();
    }

    // Listen for login event
    const handleLoginEvent = () => {
      // No need to call updateAuthState here - the login component should
      // have already set the session storage values
      if (typeof window !== 'undefined') {
        setIsAuthState(true);
        setUsername(sessionStorage.getItem('username') || '');
      }
    };

    // Listen for logout event
    const handleLogoutEvent = () => {
      setIsAuthState(false);
      setUsername('');
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('login', handleLoginEvent);
      window.addEventListener('logout', handleLogoutEvent);
    }

    // Clean up event listeners
    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('login', handleLoginEvent);
        window.removeEventListener('logout', handleLogoutEvent);
      }
    };
  }, [authChecked]);

  // Function to handle logout
  const handleLogout = async () => {
    try {
      logout(); // This function already dispatches a 'logout' event
      setIsAuthState(false);
      setUsername('');

      // Redirect to login page
      router.push('/login');
    } catch (error) {
      console.error('Error during logout:', error);
      setIsAuthState(false);
      router.push('/login');
    }
  };

  // Protect against hydration issues
  if (!mounted) {
    return (
      <html lang="en">
        <body>
          <div className={styles.loadingContainer}>
            <div className={styles.loadingSpinner}></div>
          </div>
        </body>
      </html>
    );
  }

  return (
    <html lang="en">
      <body>
        <div className={styles.appContainer}>
          {/* Navbar renders when auth state is true (from either session storage or server check) */}
          {isAuthState && (
            <nav className={styles.navbar}>
              <div className={styles.navbarContainer}>
                <div className={styles.navbarLogo}>
                  <Link href="/">Audio Host App</Link>
                </div>
                <ul className={styles.navbarMenu}>
                  <li className={styles.navbarItem}>
                    <Link href="/about">About</Link>
                  </li>
                  <li className={styles.navbarItem}>
                    <Link href="/audio">Audio</Link>
                  </li>
                  <li className={styles.navbarItem}>
                    <Link href="/upload">Upload</Link>
                  </li>
                  <li className={styles.navbarItem}>
                    <Link href="/users">Users</Link>
                  </li>
                  <li className={styles.navbarItem}>
                    <span className={styles.welcomeText}>
                      Welcome, {username}
                    </span>
                  </li>
                  <li className={styles.navbarItem}>
                    <button
                      className={styles.logoutButton}
                      onClick={handleLogout}
                    >
                      Logout
                    </button>
                  </li>
                </ul>
              </div>
            </nav>
          )}
          {/* Main content */}
          <main className={styles.mainContent}>
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}