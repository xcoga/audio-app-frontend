"use client";  // Client-side rendering, necessary for hooks or dynamic content

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();


  //
  // const SERVER_URL = "http://localhost:8000";

  //This config is for AWS ECS service.
  const SERVER_URL = process.env.REACT_APP_BACKEND_URL;


  /**
   * Handles the login process by validating inputs, sending a request to the server,
   * and handling the response.
   * 
   * The function performs the following actions:
   * - Clears any previous error messages.
   * - Validates that both username and password are provided.
   * - Sends the username and password to the FastAPI backend for authentication using OAuth2 password flow.
   * - If successful, stores the authentication token and username in sessionStorage and emits a custom 'login' event.
   * - Redirects the user to the home page upon successful login.
   * - Displays appropriate error messages based on the response from the server, or handles network errors.
   * 
   * @note The function updates the state for loading and error messages and utilizes FastAPI's OAuth2 password flow for authentication.
   */
  const handleLogin = async () => {
    // Clear previous errors
    setError("");

    // Validate form inputs
    if (!username || !password) {
      setError("Username and password are required.");
      return;
    }

    setIsLoading(true);

    try {
      // Create form data for FastAPI's OAuth2 password flow
      const formData = new URLSearchParams();
      formData.append('username', username);
      formData.append('password', password);

      // Call the FastAPI login endpoint
      const response = await fetch(`${SERVER_URL}/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formData,
      });

      if (response.ok) {
        const data = await response.json();

        // Store token in sessionStorage (or localStorage for persistence)
        sessionStorage.setItem("token", data.access_token);
        sessionStorage.setItem("isAuthenticated", "true");
        sessionStorage.setItem("username", username);

        // Emit the event for layout.js to listen
        const event = new Event('login');
        window.dispatchEvent(event);

        console.log("Login successful, token stored:", data.access_token);

        // Redirect to home page
        router.push("/");
      } else {
        // Handle various error responses
        const errorData = await response.json().catch(() => ({}));

        if (response.status === 401) {
          setError("Invalid username or password.");
        } else {
          setError(errorData.detail || "Login failed. Please try again.");
        }
      }
    } catch (err) {
      setError("Network error. Please check your connection and try again.");
      console.error("Login error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Handles the 'Enter' key press event to trigger the login process.
   * 
   * This function listens for a key press event and checks if the pressed key is 'Enter'. 
   * If the 'Enter' key is pressed, it calls the `handleLogin` function to initiate the login process.
   * 
   * @param {Object} e - The event object representing the key press event.
   * @note This function is typically used to allow users to submit the login form by pressing the Enter key.
   */
  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleLogin();
    }
  };

  return (
    <>
      <style jsx>{`
        .login-container {
          max-width: 400px;
          margin: 40px auto;
          padding: 30px;
          border-radius: 8px;
          box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
          background-color: #fff;
        }
        
        h1 {
          text-align: center;
          margin-bottom: 24px;
          color: #333;
          font-size: 28px;
          font-weight: 600;
        }
        
        form {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }
        
        .form-group {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        
        label {
          font-size: 14px;
          font-weight: 500;
          color: #555;
        }
        
        input {
          padding: 12px 16px;
          border-radius: 4px;
          border: 1px solid #ddd;
          font-size: 16px;
          transition: border-color 0.3s;
          outline: none;
        }
        
        input:focus {
          border-color: #4285f4;
        }
        
        .error-message {
          color: #e53935;
          margin: 0;
          font-size: 14px;
          padding: 8px 12px;
          background-color: #ffebee;
          border-radius: 4px;
        }
        
        button {
          background-color: #4285f4;
          color: white;
          border: none;
          border-radius: 4px;
          padding: 14px;
          font-size: 16px;
          font-weight: 500;
          cursor: pointer;
          transition: background-color 0.3s;
          margin-top: 10px;
        }
        
        button:hover:not(:disabled) {
          background-color: #3367d6;
        }
        
        button:disabled {
          background-color: #9eb7e5;
          cursor: not-allowed;
        }
        
        .spinner {
          display: inline-block;
          width: 16px;
          height: 16px;
          border: 2px solid rgba(255, 255, 255, 0.3);
          border-radius: 50%;
          border-top-color: white;
          animation: spin 1s ease-in-out infinite;
          margin-left: 8px;
        }
        
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>

      <div className="login-container">
        <h1>Login</h1>
        <form onSubmit={(e) => e.preventDefault()}>
          <div className="form-group">
            <label>Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              onKeyPress={handleKeyPress}
              disabled={isLoading}
            />
          </div>
          <div className="form-group">
            <label>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyPress={handleKeyPress}
              disabled={isLoading}
            />
          </div>
          {error && <p className="error-message">{error}</p>}
          <button
            type="button"
            onClick={handleLogin}
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                Logging in<div className="spinner"></div>
              </>
            ) : (
              "Login"
            )}
          </button>
        </form>
      </div>
    </>
  );
}