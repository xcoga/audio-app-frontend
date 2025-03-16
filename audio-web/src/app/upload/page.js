// pages/upload.js
"use client"
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Head from 'next/head';
import { getCurrentUser, authFetch } from '../../utils/auth';
import styles from './upload.module.css';


// const SERVER_URL = 'http://localhost:8000';

//This config is for AWS ECS service.
const SERVER_URL = process.env.REACT_APP_BACKEND_URL;

// Audio categories enum
const AUDIO_CATEGORIES = {
  CLASSICAL: 'Classical',
  POP: 'Pop',
  JAZZ: 'Jazz',
  SOUL: 'Soul',
  EDM: 'EDM',
  OTHERS: 'Others'
};

export default function UploadPage() {
  const router = useRouter();
  const [file, setFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [audioDescription, setAudioDescription] = useState('');
  const [audioCategory, setAudioCategory] = useState('');
  const [audioLength, setAudioLength] = useState(null);

  /**
   * Handles the file selection event and processes the selected audio file.
   * 
   * This function is triggered when a user selects a file. It checks whether the selected file is an audio file,
   * retrieves its duration, and updates the state accordingly. If the file is not an audio file, an error message is displayed.
   * 
   * @param {Object} e - The event object representing the file input change event.
   * @note This function sets the selected audio file, its duration, and handles errors related to file selection or metadata loading.
   */
  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];

    if (selectedFile) {
      // Check if the file is an audio file
      if (!selectedFile.type.startsWith('audio/')) {
        setError('Please select an audio file');
        return;
      }

      setFile(selectedFile);
      setError('');

      // Get audio duration
      const audioElement = new Audio();
      const objectUrl = URL.createObjectURL(selectedFile);

      audioElement.addEventListener('loadedmetadata', () => {
        // Get duration in seconds and round to nearest integer
        const durationInSeconds = Math.round(audioElement.duration);
        setAudioLength(durationInSeconds);

        // Free up memory
        URL.revokeObjectURL(objectUrl);
      });

      audioElement.addEventListener('error', () => {
        setError('Could not read audio file length');
        URL.revokeObjectURL(objectUrl);
      });

      audioElement.src = objectUrl;
    } else {
      setAudioLength(null);
    }
  };

  /**
   * Handles changes to the audio description input field.
   * 
   * This function is triggered when the user types into the description field, updating the state with the current value.
   * It ensures that the audio description state is kept up-to-date with the input provided by the user.
   * 
   * @param {Object} e - The event object representing the input change event.
   * @note This function updates the `audioDescription` state with the input value from the user.
   */
  const handleDescriptionChange = (e) => {
    setAudioDescription(e.target.value);
  };

  /**
   * Handles changes to the audio category input field.
   * 
   * This function is triggered when the user selects a new category from the category dropdown or input field,
   * updating the state with the selected category value.
   * 
   * @param {Object} e - The event object representing the input change event.
   * @note This function updates the `audioCategory` state with the selected category value from the user.
   */
  const handleCategoryChange = (e) => {
    setAudioCategory(e.target.value);
  };

  /**
   * Handles the form submission for uploading an audio file.
   * 
   * This function is triggered when the user submits the form. It validates the required fields, such as file,
   * audio category, and user authentication. If the validation passes, it initiates the upload process using an 
   * XMLHttpRequest to send the file and metadata to the server. The upload progress is tracked, and success or 
   * error messages are displayed based on the response.
   * 
   * @param {Object} e - The event object representing the form submit event.
   * @note This function handles file uploads, progress tracking, and authentication checks.
   */
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!file) {
      setError('Please select a file to upload');
      return;
    }

    if (!audioCategory) {
      setError('Please select an audio category');
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);
    setMessage('');
    setError('');

    try {
      // Create form data object
      const formData = new FormData();
      formData.append('file', file);
      formData.append('audio_description', audioDescription);
      formData.append('audio_category', audioCategory);
      formData.append("audio_length", audioLength);

      // Get current user for authentication
      const currentUser = await getCurrentUser();
      if (!currentUser) {
        router.push('/login');
        return;
      }

      // Custom fetch with upload progress. Also possible to use axios library to do this.
      const xhr = new XMLHttpRequest();

      xhr.upload.addEventListener('progress', (event) => {
        if (event.lengthComputable) {
          const percentComplete = Math.round((event.loaded / event.total) * 100);
          setUploadProgress(percentComplete);
        }
      });

      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          const response = JSON.parse(xhr.responseText);
          setMessage(`File uploaded successfully: ${response.filename}`);
          setFile(null);
          setAudioDescription('');
          setAudioCategory('');
          setAudioLength(null);
          setUploadProgress(100);
        } else {
          let errorMsg = 'Upload failed';
          try {
            const errorData = JSON.parse(xhr.responseText);
            errorMsg = errorData.detail || errorMsg;
          } catch (e) {
            // If response is not JSON
          }
          setError(errorMsg);
        }
        setIsUploading(false);
      });

      xhr.addEventListener('error', () => {
        setError('Network error occurred while uploading');
        setIsUploading(false);
      });

      xhr.addEventListener('abort', () => {
        setError('Upload was aborted');
        setIsUploading(false);
      });

      // Open and send the request
      xhr.open('POST', `${SERVER_URL}/upload`);

      // Set auth token
      const token = sessionStorage.getItem('token');
      if (token) {
        xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      }

      xhr.send(formData);

    } catch (err) {
      console.error('Upload error:', err);
      setError(`Upload failed: ${err.message}`);
      setIsUploading(false);
    }
  };

  /**
   * Cancels the ongoing file upload process.
   * 
   * This function is used to stop the upload process manually. It sets the uploading state to false, indicating
   * that the upload is no longer in progress, and displays an error message to inform the user that the upload
   * was cancelled.
   * 
   * @note This function is typically triggered when the user decides to abort the file upload.
   */
  const cancelUpload = () => {
    // Logic to cancel upload would go here
    setIsUploading(false);
    setError('Upload cancelled');
  };

  return (
    <>
      <Head>
        <title>File Upload</title>
      </Head>

      <div className={styles.container}>
        <h1 className={styles.title}>File Upload</h1>

        {message && (
          <div className={styles.successMessage}>
            {message}
          </div>
        )}

        {error && (
          <div className={styles.errorMessage}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className={styles.uploadForm}>
          <div className={styles.formGroup}>
            <label htmlFor="file" className={styles.fileLabel}>
              {file ? file.name : 'Choose a file'}
              <input
                type="file"
                id="file"
                onChange={handleFileChange}
                className={styles.fileInput}
                disabled={isUploading}
                accept="audio/*"
              />
            </label>

            {file && (
              <div className={styles.fileInfo}>
                <span className={styles.fileName}>{file.name}</span>
                <span className={styles.fileSize}>
                  {(file.size / 1024).toFixed(2)} KB
                </span>
                {audioLength !== null && (
                  <span className={styles.fileLength}>
                    Length: {Math.floor(audioLength / 60)}:{String(audioLength % 60).padStart(2, '0')}
                  </span>
                )}
              </div>
            )}
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="category">Audio Category</label>
            <select
              id="category"
              value={audioCategory}
              onChange={handleCategoryChange}
              className={styles.select}
              disabled={isUploading}
              required
            >
              <option value="" disabled>Select a category</option>
              {Object.values(AUDIO_CATEGORIES).map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="description">Audio Description</label>
            <textarea
              id="description"
              value={audioDescription}
              onChange={handleDescriptionChange}
              className={styles.textarea}
              disabled={isUploading}
              rows={3}
              placeholder="Enter a brief description of this file..."
            />
          </div>

          {isUploading && (
            <div className={styles.progressContainer}>
              <div
                className={styles.progressBar}
                style={{ width: `${uploadProgress}%` }}
              />
              <span className={styles.progressText}>
                {uploadProgress}%
              </span>
              <button
                type="button"
                onClick={cancelUpload}
                className={styles.cancelButton}
              >
                Cancel
              </button>
            </div>
          )}

          <div className={styles.buttonGroup}>
            <button
              type="button"
              onClick={() => router.back()}
              className={styles.backButton}
              disabled={isUploading}
            >
              Back
            </button>
            <button
              type="submit"
              className={styles.uploadButton}
              disabled={!file || isUploading}
            >
              {isUploading ? 'Uploading...' : 'Upload File'}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}