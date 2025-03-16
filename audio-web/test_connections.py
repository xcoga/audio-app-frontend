import requests
import json
import time
import os
import sys

def test_server_connection(urls):
    """
    Test connections to backend server using different URLs
    Each URL will be tested with a GET request expecting a JSON response
    Return the first working URL or None if none work
    """
    results = {}
    
    for name, url in urls.items():
        print(f"\nTesting connection to: {name} ({url})")
        try:
            start_time = time.time()
            response = requests.get(url, timeout=5)
            elapsed = time.time() - start_time
            
            print(f"Status Code: {response.status_code}")
            print(f"Response Time: {elapsed:.3f} seconds")
            
            if response.status_code == 200:
                try:
                    json_data = response.json()
                    print("JSON Response:")
                    print(json.dumps(json_data, indent=2))
                    results[name] = {
                        "status": "Success",
                        "code": response.status_code,
                        "time": elapsed,
                        "data": json_data,
                        "url": url
                    }
                except json.JSONDecodeError:
                    # If we get a 200 response but it's not JSON, still consider it a success
                    # for connection testing purposes
                    print("Warning: Received non-JSON response:")
                    print(response.text[:200] + "..." if len(response.text) > 200 else response.text)
                    results[name] = {
                        "status": "Success",  # Changed from Error to Success
                        "code": response.status_code,
                        "time": elapsed,
                        "warning": "Not a valid JSON response",
                        "url": url
                    }
            else:
                print(f"Error: Received status code {response.status_code}")
                print(response.text[:200] + "..." if len(response.text) > 200 else response.text)
                results[name] = {
                    "status": "Error",
                    "code": response.status_code,
                    "error": response.text
                }
        except requests.exceptions.ConnectionError:
            print("Error: Connection failed")
            results[name] = {
                "status": "Error",
                "error": "Connection failed"
            }
        except requests.exceptions.Timeout:
            print("Error: Request timed out")
            results[name] = {
                "status": "Error",
                "error": "Request timed out"
            }
        except Exception as e:
            print(f"Error: {str(e)}")
            results[name] = {
                "status": "Error",
                "error": str(e)
            }
    
    return results

def set_environment_variable(name, value):
    """Set an environment variable and report success"""
    os.environ[name] = value
    print(f"✅ Environment variable {name} set to {value}")
    
    # Also write to .env file for persistence
    try:
        with open('.env', 'a') as f:
            f.write(f"{name}={value}\n")
        print(f"✅ Added {name}={value} to .env file")
    except Exception as e:
        print(f"⚠️ Warning: Could not write to .env file: {str(e)}")
    
    return True

if __name__ == "__main__":
    # Define the endpoints to test - modify the path as needed for your API
    endpoints_to_test = {
        "backend": "http://backend:8000/",  
        "htx_backend": "http://htx_backend:8000/",  
        "localhost": "http://localhost:8000/",
        "0.0.0.0": "http://0.0.0.0:8000/",
    }
    
    # Add retries with delay for Docker container startup time
    max_retries = 5
    retry_delay = 3
    
    for retry in range(max_retries):
        # Run the tests
        print(f"\nAttempt {retry + 1}/{max_retries} to connect to backend server")
        results = test_server_connection(endpoints_to_test)
        
        # Print summary
        print("\n=== CONNECTION TEST SUMMARY ===")
        for name, result in results.items():
            status = "✅ PASS" if result.get("status") == "Success" else "❌ FAIL"
            print(f"{name}: {status}")
        
        # Identify the working connection
        working_connections = {name: result for name, result in results.items() 
                              if result.get("status") == "Success"}
        
        if working_connections:
            print(f"\nWorking connection(s): {', '.join(working_connections.keys())}")
            
            # Prioritize connections in this order: backend, localhost, 0.0.0.0
            preferred_order = ["0.0.0.0","htx_backend", "backend", "localhost"]
            best_connection = None
            
            for preferred in preferred_order:
                if preferred in working_connections:
                    best_connection = preferred
                    break
            
            if not best_connection:
                best_connection = list(working_connections.keys())[0]
            
            # Get the full URL from the best connection
            best_url = working_connections[best_connection]["url"]
            print(f"\n🌟 Best connection: {best_connection} ({best_url})")
            
            # Set environment variable
            set_environment_variable("REACT_APP_BACKEND_URL", best_url)
            
            # Exit with success
            print("\n✅ Connection test successful, continuing execution...\n")
            sys.exit(0)
        
        if retry < max_retries - 1:
            print(f"\nNo working connections found. Retrying in {retry_delay} seconds...")
            time.sleep(retry_delay)
        else:
            print("\n❌ All connection attempts failed. Check that your backend service is running and accessible.")
            sys.exit(1)