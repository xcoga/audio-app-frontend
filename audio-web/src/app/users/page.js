// pages/admin/users.js
"use client"
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Head from 'next/head';
import { getCurrentUser, authFetch, logout } from '../../utils/auth';
import styles from './users.module.css';

// const SERVER_URL = "http://localhost:8000";
//This config is for AWS ECS service.
const SERVER_URL = process.env.REACT_APP_BACKEND_URL;

export default function UserManagement() {
  const router = useRouter();
  const [users, setUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);
  const [error, setError] = useState(null);

  // Form state
  const [selectedUser, setSelectedUser] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState('create');
  const [isSubmitting, setIsSubmitting] = useState(false);

  //Default form data
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    fullname: '',
    role: 'user',
    password: '',
  });



  /**
   * Checks if the current user is authenticated and has an admin role.
   * 
   * This function first attempts to fetch the current user using `getCurrentUser`. If no user is found,
   * it redirects to the login page. If the user is not an admin, an error message is shown, and the user is
   * redirected to the home page. If the user is an admin, the function proceeds to fetch additional user data
   * and update the current user state.
   * 
   * @note The function also handles loading state and catches any errors during the authentication check.
   * 
   * @returns {void}
   */
  const checkAdminStatus = async () => {
    try {
      setIsLoading(true);
      const user = await getCurrentUser();

      if (!user) {
        // Redirect to login if not authenticated
        router.push('/login');
        return;
      }

      // Check if user has admin role
      if (user.role !== 'admin') {
        setError('Unauthorized: Admin access required');
        alert("unauthorised");
        // Optionally redirect to unauthorized page
        router.push('/');
        return;
      }

      setCurrentUser(user);
      await fetchUsers();
    } catch (err) {
      console.error('Authentication error:', err);
      setError('Authentication failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Effect hook that checks the admin status whenever the router changes.
   * 
   * This effect triggers the `checkAdminStatus` function whenever there is a change in the `router` object.
   * This can be useful if the admin status needs to be re-evaluated based on navigation or route changes.
   * 
   * @note The dependency on `router` means that this effect will run every time the route or URL changes.
   */
  useEffect(() => {
    checkAdminStatus();
  }, [router]);
  /**
   * Fetches the list of users from the server.
   * 
   * This function makes an authenticated request to fetch the users from the server. If the request fails,
   * it handles different error scenarios such as token expiration (401) and permission issues (403).
   * If the request is successful, it parses the response data and updates the `users` state.
   * 
   * @note The function uses `authFetch` to make the authenticated request and handles various error status codes.
   * 
   * @returns {void}
   */
  const fetchUsers = useCallback(async () => {
    //useCallback in React caches and reuses the function, unless the dependency changes. (which is router in this case).
    try {
      const response = await authFetch(`${SERVER_URL}/users/`);

      if (!response.ok) {
        // Handle different error status codes
        if (response.status === 401) {
          // Token expired or invalid
          logout();
          router.push('/login');
          return;
        }

        if (response.status === 403) {
          setError('You do not have permission to view users');
          return;
        }

        throw new Error(`Failed to fetch users: ${response.statusText}`);
      }

      const data = await response.json();
      setUsers(data);
    } catch (err) {
      console.error('Error fetching users:', err);
      setError('Failed to load users: ' + err.message);
    }
  }, [router]);

  /**
   * Handles changes in form input fields and updates the corresponding field in the form data state.
   * 
   * This function is called on every change in the input fields of a form. It retrieves the `name`
   * and `value` from the event target (the input field), and updates the `formData` state with the
   * new value while maintaining the previous values of other fields.
   * 
   * @param {React.ChangeEvent<HTMLInputElement>} e - The event object containing the input field's
   * name and value that triggered the change.
   */
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  /**
   * Opens the modal and sets up the form data based on the mode and optional user.
   * 
   * This function is used to open a modal in different modes (e.g., create or edit user). 
   * If a user object is provided, the modal is populated with the user's data (except for the password 
   * for security reasons). If no user is provided, the modal is reset with empty or default values.
   * 
   * @param {string} mode - The mode in which the modal is opened (e.g., 'edit' or 'create').
   * @param {Object|null} user - The user object to populate the modal with, or null to reset the form.
   * @param {string} user.username - The user's username.
   * @param {string} user.email - The user's email (optional).
   * @param {string} user.fullname - The user's full name (optional).
   * @param {string} user.role - The user's role.
   */

  const openModal = (mode, user = null) => {
    setModalMode(mode);

    if (user) {
      setSelectedUser(user);
      setFormData({
        username: user.username,
        email: user.email || '',
        fullname: user.fullname || '',
        role: user.role,
        password: '', // Don't populate password for security
      });
    } else {
      setSelectedUser(null);
      setFormData({
        username: '',
        email: '',
        fullname: '',
        role: 'user',
        password: '',
      });
    }

    setIsModalOpen(true);
  };

  /**
   * Closes the modal and resets related state.
   * 
   * This function is used to close the modal and clear any selected user data and error messages. 
   * It ensures that the modal state is set to closed, and the selected user and error states are reset 
   * to their initial values.
   */
  const closeModal = () => {
    setIsModalOpen(false);
    setSelectedUser(null);
    setError(null);
  };

  /**
   * Handles the form submission for creating, editing, or deleting a user.
   * 
   * This function prevents double submission by checking the `isSubmitting` state. It first verifies the admin status of the current user 
   * before allowing any action. Depending on the `modalMode`, it either deletes, updates, or creates a user:
   * - For deletion, it sends a DELETE request to remove the selected user.
   * - For editing, it validates the form data and sends a PUT request to update the user details.
   * - For creating a new user, it validates the form data and sends a POST request to create the user.
   * 
   * After each operation, it updates the user list, closes the modal, and handles errors.
   */
  const handleSubmit = async (e) => {
    e.preventDefault();

    // Prevent double submission
    if (isSubmitting) return;

    try {
      setIsSubmitting(true);

      // Verify admin status again before performing action
      const user = await getCurrentUser(true); // Force refresh
      if (!user || user.role !== 'admin') {
        setError('Your session has expired or you no longer have admin privileges');
        setTimeout(() => {
          logout();
          router.push('/login');
        }, 2000);
        return;
      }

      if (modalMode === 'delete') {
        // Delete user
        const response = await authFetch(`${SERVER_URL}/users/${selectedUser.username}`, {
          method: 'DELETE',
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.detail || `Failed to delete user: ${response.statusText}`);
        }

        setUsers(users.filter(user => user.username !== selectedUser.username));
        closeModal();
      } else if (modalMode === 'edit') {
        // Validate form data
        if (!formData.username || !formData.email || !formData.password || !formData.fullname || !formData.role) {
          setError('Fill in all fields!');
          alert('Fill in all fields!');
          return;
        }


        const response = await authFetch(`${SERVER_URL}/users/update`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.detail || `Failed to update user: ${response.statusText}`);
        }

        const updatedUser = await response.json();
        setUsers(users.map(user =>
          user.username === selectedUser.username ? updatedUser : user
        ));
        closeModal();
      } else {
        // Create user
        // Validate form data
        if (!formData.username || !formData.email || !formData.password || !formData.fullname || !formData.role) {
          setError('fill in all fields!');
          alert('Please fill in all fields!')
          return;
        }

        const response = await authFetch(`${SERVER_URL}/users/create`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.detail || `Failed to create user: ${response.statusText}`);
        }

        const newUser = await response.json();
        setUsers([...users, newUser]);
        closeModal();
      }
    } catch (err) {
      console.error(`Error during ${modalMode}:`, err);
      setError(`Failed to ${modalMode} user: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };


  //Displays loading page if the page is still loading
  if (isLoading) {
    return <div className={styles.loadingContainer}>Loading...</div>;
  }

  //Routes to login page if there is an error or the user is not logged in
  if (error && !currentUser) {

    return (
      <div className={styles.errorContainer}>
        <p className={styles.errorText}>{error}</p>
        <button
          className={styles.retryButton}
          onClick={() => router.push('/login')}
        >
          Return to Login
        </button>
      </div>
    );
  }

  if (!currentUser || currentUser.role !== 'admin') {
    return <div className={styles.unauthorizedContainer}>Unauthorized access.</div>;
  }

  return (
    <>
      <Head>
        <title>User Management - Admin Dashboard</title>
      </Head>

      <div className={styles.container}>
        <div className={styles.header}>
          <h1 className={styles.title}>User Management</h1>
          <div className={styles.userInfo}>
            <p className={styles.userText}>
              Logged in as: <span className={styles.username}>{currentUser.username}</span>
            </p>
            <div className={styles.actions}>
              <button
                className={styles.addButton}
                onClick={() => openModal('create')}
              >
                Add New User
              </button>

            </div>
          </div>
        </div>

        {users.length === 0 ? (
          <div className={styles.emptyState}>
            <p>No users found. Create a new user to get started.</p>
          </div>
        ) : (
          <div className={styles.tableContainer}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Username</th>
                  <th>Full Name</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th className={styles.actionsColumn}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.username}>
                    <td>{user.username}</td>
                    <td>{user.fullname || '-'}</td>
                    <td>{user.email || '-'}</td>
                    <td>
                      <span className={
                        user.role === 'admin' ? styles.adminBadge : styles.userBadge
                      }>
                        {user.role}
                      </span>
                    </td>
                    <td className={styles.actions}>
                      <button
                        className={styles.editButton}
                        onClick={() => openModal('edit', user)}
                      >
                        Edit
                      </button>
                      <button
                        className={styles.deleteButton}
                        onClick={() => openModal('delete', user)}
                        disabled={user.username === currentUser.username}
                        title={user.username === currentUser.username ? "Cannot delete your own account" : ""}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>


      {/* Modal for Create/Edit/Delete */}
      {isModalOpen && (
        <div className={styles.modalBackdrop}>
          <div className={styles.modal}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>
                {modalMode === 'create' ? 'Add New User' :
                  modalMode === 'edit' ? 'Edit User' : 'Delete User'}
              </h2>
              <button
                className={styles.closeButton}
                onClick={closeModal}
              >
                &times;
              </button>
            </div>

            {error && (
              <div className={styles.modalError}>
                {error}
              </div>
            )}

            {modalMode === 'delete' ? (
              <div className={styles.deleteConfirmation}>
                <p>Are you sure you want to delete user {`"${selectedUser?.username}"`}?</p>
                <div className={styles.modalActions}>
                  <button
                    className={styles.cancelButton}
                    onClick={closeModal}
                    disabled={isSubmitting}
                  >
                    Cancel
                  </button>
                  <button
                    className={styles.confirmDeleteButton}
                    onClick={handleSubmit}
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? 'Deleting...' : 'Delete'}
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className={styles.form}>
                <div className={styles.formGroup}>
                  <label htmlFor="username">
                    Username
                  </label>
                  <input
                    type="text"
                    id="username"
                    name="username"
                    value={formData.username}
                    onChange={handleInputChange}
                    required
                    disabled={isSubmitting || modalMode === 'edit'} // Username cannot be changed once created
                    autoComplete="off"
                  />
                  {modalMode === 'edit' && (
                    <p className={styles.fieldHint}>Username cannot be changed</p>
                  )}
                </div>

                <div className={styles.formGroup}>
                  <label htmlFor="full_name">
                    Full Name
                  </label>
                  <input
                    type="text"
                    id="fullname"
                    name="fullname"
                    value={formData.fullname}
                    onChange={handleInputChange}
                    disabled={isSubmitting}
                    autoComplete="off"
                  />
                </div>

                <div className={styles.formGroup}>
                  <label htmlFor="email">
                    Email
                  </label>
                  <input
                    type="email"
                    id="email"
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    required
                    disabled={isSubmitting}
                    autoComplete="off"
                  />
                </div>

                <div className={styles.formGroup}>
                  <label htmlFor="role">
                    Role
                  </label>
                  <select
                    id="role"
                    name="role"
                    value={formData.role}
                    onChange={handleInputChange}
                    disabled={isSubmitting || (modalMode === 'edit' && selectedUser?.username === currentUser?.username)}
                  >
                    <option value="user">User</option>
                    <option value="admin">Admin</option>
                  </select>
                  {modalMode === 'edit' && selectedUser?.username === currentUser?.username && (
                    <p className={styles.fieldHint}>You cannot change your own role</p>
                  )}
                </div>

                <div className={styles.formGroup}>
                  <label htmlFor="password">
                    Password {modalMode === 'edit' ? '(Enter to change)' : ''}
                  </label>
                  <input
                    type="password"
                    id="password"
                    name="password"
                    value={formData.password}
                    onChange={handleInputChange}
                    required={modalMode === 'create'} // Only required for new users
                    disabled={isSubmitting}
                    autoComplete="new-password"
                  />
                </div>

                <div className={styles.modalActions}>
                  <button
                    type="button"
                    className={styles.cancelButton}
                    onClick={closeModal}
                    disabled={isSubmitting}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className={styles.submitButton}
                    disabled={isSubmitting}
                  >
                    {isSubmitting
                      ? (modalMode === 'create' ? 'Creating...' : 'Updating...')
                      : (modalMode === 'create' ? 'Create' : 'Update')}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}