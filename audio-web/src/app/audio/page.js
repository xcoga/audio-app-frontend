"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Music, Download, Trash, Router } from 'lucide-react';
import AudioPlayer from 'react-h5-audio-player';
import 'react-h5-audio-player/lib/styles.css';
import styles from '../../styles/audioFiles.module.css';


// Server configuration for local development
// const SERVER_URL = 'http://127.0.0.1:8000';
// const SERVER_URL = "http://localhost:8000";

//This config is for AWS ECS service.
const SERVER_URL = process.env.REACT_APP_BACKEND_URL;

const AudioFilesPage = () => {
  const [audioFiles, setAudioFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedTrack, setExpandedTrack] = useState(null);
  const [currentFolder, setCurrentFolder] = useState('admin');
  const [audioSources, setAudioSources] = useState({});
  const [fetchingAudio, setFetchingAudio] = useState(false);
  const [pendingFetches, setPendingFetches] = useState({});
  const audioElementRef = useRef(null);
  const router = useRouter();





  /**
   * Fetches a list of audio files from the server and updates the `audioFiles` state with the
   * fetched and formatted audio file details. It handles any errors by setting fallback audio files 
   * if the fetch operation fails. The loading state is managed during the fetch process.
   *
   * @function fetchAudioFiles
   * @async
   * 
   * @throws {Error} Throws an error if fetching the files fails or if the server response is in an unexpected format.
   * 
   * @returns {void} This function does not return a value. It updates the component's state (`audioFiles`, `loading`, `error`) 
   * based on the result of the fetch operation.
   */
  const fetchAudioFiles = useCallback(async () => {
    try {
      setLoading(true);

      // Get access token from sessionStorage
      const accessToken = sessionStorage.getItem("token");

      const response = await fetch(`${SERVER_URL}/list-files`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          // Add authorization header
          'Authorization': `Bearer ${accessToken}`
        },
        mode: 'cors',
        credentials: 'include' // Include cookies if using cookie-based auth
      });

      if (!response.ok) {
        router.push('/login');
        throw new Error(`Error fetching audio files: ${response.statusText}`);
      }

      // Get the response data (dictionary with files array)
      const data = await response.json();
      console.log("Server response data:", data);

      // Check if data has the files property and it's an array
      if (!data.files || !Array.isArray(data.files)) {
        console.error("Server did not return a files array:", data);
        throw new Error("Server response is not in the expected format");
      }

      // Process the files array
      const formattedFiles = data.files.map((file, index) => {
        // For strings (filenames)
        if (typeof file === 'string') {
          return {
            id: index + 1,
            title: file.replace(/\.[^/.]+$/, "").replace(/_/g, " "),
            description: '',
            artist: 'Unknown Artist',
            audio_category: '',
            duration: '--:--',
            fileName: file,
            filePath: ''
          };
        }
        // For objects with file metadata
        else if (typeof file === 'object' && file !== null) {
          return {
            id: index + 1,
            title: (file.fileName || file.title || `Track ${index + 1}`).replace(/\.[^/.]+$/, "").replace(/_/g, " "),
            description: file.audio_description || '',
            artist: file.artist || 'Unknown Artist',
            audio_category: file.audio_category || '',
            duration: file.audio_duration || '--:--',
            fileName: file.fileName || `track_${index + 1}.mp3`,
            filePath: file.filePath || ''
          };
        }
        // Fallback
        else {
          return {
            id: index + 1,
            title: `Track ${index + 1}`,
            artist: 'Unknown Artist',
            duration: '--:--',
            fileName: `track_${index + 1}.mp3`
          };
        }
      });

      setAudioFiles(formattedFiles);
    } catch (err) {
      console.error("Error fetching files:", err);
      setError(err.message);
      // Fallback data
      setAudioFiles([
        { id: 1, title: 'Trombone Duet', artist: 'John Doe', duration: '3:45', fileName: 'trombone_duet.mp3' },
        { id: 2, title: 'Piano Sonata', artist: 'Jane Smith', duration: '5:20', fileName: 'piano_sonata.mp3' },
        { id: 3, title: 'Drum Solo', artist: 'Mike Johnson', duration: '2:15', fileName: 'drum_solo.mp3' },
        { id: 4, title: 'Ambient Sounds', artist: 'Sarah Williams', duration: '4:30', fileName: 'ambient_sounds.mp3' },
        { id: 5, title: 'Electronic Beat', artist: 'David Brown', duration: '3:10', fileName: 'electronic_beat.mp3' },
      ]);
    } finally {
      setLoading(false);
    }
  }, [router, setAudioFiles, setError, setLoading]);

  /**
 * This useEffect hook fetches the list of audio files whenever the `currentFolder` state changes.
 * It triggers the `fetchAudioFiles` function to update the available audio files based on the 
 * new folder selected by the user. The hook runs every time the `currentFolder` value changes.
 */
  useEffect(() => {
    fetchAudioFiles();
  }, [currentFolder, fetchAudioFiles]);



  /**
   * Fetches an audio file from the server with proper authentication. 
   * It checks if the file is already being fetched to prevent duplicate requests. 
   * If successful, it stores the audio file's URL in the state; otherwise, it handles errors and timeouts.
   * 
   * @function fetchAudioSource
   * @param {string} fileName - The name (or path) of the audio file to fetch from the server.
   * 
   * @returns {Promise<string | null>} - Returns a promise that resolves to the audio file's URL (as a string) if the fetch is successful, or `null` if an error occurs or the fetch is aborted.
   * 
   * @throws {Error} If the fetch request fails or times out, an error is logged and the function returns `null`.
   */
  const fetchAudioSource = async (fileName) => {
    try {
      // If already fetching this file, don't start a new fetch
      if (pendingFetches[fileName]) {
        console.log(`Already fetching ${fileName}, skipping duplicate request`);
        return null;
      }

      setFetchingAudio(true);
      setPendingFetches(prev => ({
        ...prev,
        [fileName]: true
      }));

      // Get access token
      const accessToken = sessionStorage.getItem("token");

      // Extract just the filename from the path
      const actualFileName = fileName.includes('/')
        ? fileName.split('/').pop()
        : fileName;

      console.log(`Fetching audio for ${actualFileName} with authentication...`);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);

      const response = await fetch(`${SERVER_URL}/stream/${actualFileName}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`
        },
        credentials: 'include',
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Error streaming audio: ${response.status} ${response.statusText}`);
      }

      // Before creating a new blob URL, clean up any existing one
      if (audioSources[fileName]) {
        try {
          URL.revokeObjectURL(audioSources[fileName]);
        } catch (e) {
          console.warn("Error revoking URL:", e);
        }
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);

      // Store the URL in state
      setAudioSources(prev => ({
        ...prev,
        [fileName]: url
      }));

      return url;
    } catch (err) {
      console.error("Error fetching audio:", err);
      if (err.name === 'AbortError') {
        console.log("Fetch request was aborted (timeout)");
      } else if (err.name !== 'AbortError') {
        alert(`Failed to load audio: ${err.message}`);
      }
      return null;
    } finally {
      setFetchingAudio(false);
      setPendingFetches(prev => {
        const newState = { ...prev };
        delete newState[fileName];
        return newState;
      });
    }
  };


  /**
   * Toggles the playback of an audio track. Expands the selected track and plays it,
   * or collapses it and pauses the audio if it's already expanded.
   * 
   * @param {number} audioId - The ID of the audio track to toggle.
   * 
   * This function will:
   * - If the track is already expanded, it will collapse it and pause the audio.
   * - If another track is expanded, it will pause the current track before expanding and playing the new one.
   * - It will also check if the audio source for the selected track is already available. If not, it will fetch the audio file.
   */
  const toggleTrack = async (audioId) => {
    // If already expanded, collapse it
    if (expandedTrack === audioId) {
      setExpandedTrack(null);

      // If there's a current audio element, pause it
      if (audioElementRef.current) {
        try {
          audioElementRef.current.audio.current.pause();
        } catch (e) {
          console.warn("Error pausing audio:", e);
        }
      }

      return;
    }

    // If another track is expanded, pause it first
    if (expandedTrack !== null && audioElementRef.current) {
      try {
        audioElementRef.current.audio.current.pause();
      } catch (e) {
        console.warn("Error pausing previous audio:", e);
      }
    }

    // Set the new expanded track
    setExpandedTrack(audioId);

    // Find the new audio file details
    const audioFile = audioFiles.find(file => file.id === audioId);

    // If we don't already have a source for this file, fetch it
    if (audioFile && !audioSources[audioFile.fileName]) {
      await fetchAudioSource(audioFile.fileName);
    }
  };

  /**
   * Handles errors during audio playback. If an error occurs, it attempts to fetch the audio file again 
   * if it has not been fetched yet or the previous attempt failed.
   * 
   * @param {Object} e - The error object triggered by the playback failure.
   * @param {string} fileName - The name of the audio file that failed to play.
   * 
   * This function will:
   * - Log the error details to the console.
   * - If the audio source is not available or an error occurred during playback, it will revoke any existing blob URL 
   *   and attempt to fetch the audio file again.
   * - If the file is already being fetched, it prevents multiple fetch attempts.
   * - If the audio fetch fails again, an error message is logged indicating the failure.
   */
  const handlePlayError = async (e, fileName) => {
    console.error("Audio playback error:", e);

    // If we haven't tried fetching the audio yet or last attempt failed
    if (!audioSources[fileName] || e.target.error) {
      // First, clean up any existing blob URL to avoid memory leaks
      if (audioSources[fileName]) {
        URL.revokeObjectURL(audioSources[fileName]);
        // Remove the failed source
        setAudioSources(prev => {
          const newSources = { ...prev };
          delete newSources[fileName];
          return newSources;
        });
      }

      // Check if we're already trying to fetch this file
      if (pendingFetches[fileName]) {
        console.log("Already trying to fetch this file, please wait...");
        return;
      }

      console.log("Trying to fetch audio again...");
      const source = await fetchAudioSource(fileName);
      if (!source) {
        console.error(`Could not play audio file ${fileName}. Please check your authentication.`);
      }
    } else {
      console.error(`Error playing audio file ${fileName}. Please check the file path or server connection.`);
    }
  };


  /**
   * Handles the deletion of an audio file. It sends a request to the server to delete the file and updates the UI accordingly.
   * 
   * @param {string} audioFileName - The name of the audio file to delete.
   * 
   * This function will:
   * - Retrieve an access token from session storage for authentication.
   * - Send a DELETE request to the server to remove the audio file.
   * - If the deletion is successful, the function:
   *   - Removes the deleted file from the local state.
   *   - Revokes the blob URL (if any) to free up memory.
   *   - Collapses the expanded track if it was the one deleted.
   *   - Displays a success message to the user.
   * - If any error occurs, it logs the error and shows an error message to the user.
   */
  const handleDelete = async (audioFileName) => {
    try {
      // Get access token
      const accessToken = sessionStorage.getItem("token");

      // Extract just the filename from the path if needed
      const actualFileName = audioFileName.includes('/')
        ? audioFileName.split('/').pop()
        : audioFileName;

      // Show some indication that deletion is in progress
      setLoading(true);

      const response = await fetch(`${SERVER_URL}/delete/${actualFileName}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${accessToken}`
        },
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error(`Error deleting audio: ${response.status} ${response.statusText}`);
      }

      // Parse the response in case it contains useful information
      const result = await response.json().catch(() => ({}));

      if (result && result.error) {
        throw new Error(result.error);
      }

      // Success - update the UI by removing the deleted file from state
      setAudioFiles(prevFiles => prevFiles.filter(file => file.fileName !== audioFileName));

      // If we have a blob URL for this file, revoke it to free up memory
      if (audioSources[audioFileName]) {
        try {
          URL.revokeObjectURL(audioSources[audioFileName]);
          // Remove the source from state
          setAudioSources(prev => {
            const newSources = { ...prev };
            delete newSources[audioFileName];
            return newSources;
          });
        } catch (e) {
          console.warn(`Error revoking URL for ${audioFileName}:`, e);
        }
      }

      // If this was the expanded track, collapse it
      if (expandedTrack && audioFiles.find(file => file.id === expandedTrack)?.fileName === audioFileName) {
        setExpandedTrack(null);
      }

      // Show a success message
      alert(`Successfully deleted ${actualFileName}`);

    } catch (err) {
      console.error("Error deleting audio:", err);
      alert(`Failed to delete audio: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Handles the download of an audio file. It sends a request to the server to download the file and triggers a file download on the client.
   * 
   * @param {string} fileName - The name of the audio file to download.
   * @param {string} title - The title to be used for the downloaded file.
   * 
   * This function will:
   * - Retrieve an access token from session storage for authentication.
   * - Send a GET request to the server to fetch the audio file.
   * - If the request is successful, it:
   *   - Converts the audio file response into a blob.
   *   - Creates a temporary anchor element to trigger the file download with the provided title.
   *   - Automatically clicks the link to start the download and removes the link afterward.
   * - If any error occurs, it logs the error and shows an alert to the user with the error message.
   */
  const handleDownload = async (fileName, title) => {
    try {
      // Get access token
      const accessToken = sessionStorage.getItem("token");

      // Extract just the filename from the path
      const actualFileName = fileName.includes('/')
        ? fileName.split('/').pop()
        : fileName;

      console.log(`Downloading audio file ${actualFileName}...`);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);

      const response = await fetch(`${SERVER_URL}/download/${actualFileName}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`
        },
        credentials: 'include',
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Error downloading audio: ${response.status} ${response.statusText}`);
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);

      // Create a temporary anchor element to trigger the download
      const link = document.createElement('a');
      link.href = url;
      link.download = title;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error("Error downloading audio:", err);
      alert(`Failed to download audio: ${err.message}`);
    }
  };


  /**
   * Cleans up resources when the component is unmounted or when the `audioSources` state changes.
   * 
   * This effect performs the following actions:
   * - Pauses any currently playing audio if an audio element is available.
   * - Loops through all `audioSources` and revokes any blob URLs to free up memory.
   * 
   * It helps to avoid memory leaks by cleaning up resources like playing audio and blob URLs when the component is removed from the DOM.
   * 
   * @note This effect depends on the `audioSources` state. If `audioSources` changes, the cleanup will occur accordingly.
   */
  useEffect(() => {
    // Capture the current value of the ref
    const audioElement = audioElementRef.current;

    // Return the cleanup function
    return () => {
      // Use the captured value instead of accessing .current again
      if (audioElement && audioElement.audio.current) {
        try {
          audioElement.audio.current.pause();
        } catch (e) {
          console.warn("Error pausing audio on unmount:", e);
        }
      }

      // Revoke all blob URLs
      Object.entries(audioSources).forEach(([key, url]) => {
        if (url && typeof url === 'string' && url.startsWith('blob:')) {
          try {
            URL.revokeObjectURL(url);
          } catch (e) {
            console.warn(`Error revoking URL for ${key}:`, e);
          }
        }
      });
    };
  }, [audioSources]);

  return (
    <div className={styles.audioContainer}>
      <h1 className={styles.pageTitle}>Audio Library</h1>

      {loading && <p className={styles.loadingState}>Loading audio files...</p>}

      {error && !loading && (
        <div className={styles.errorAlert} role="alert">
          <p>{error}</p>
          <p className="mt-2">Showing sample data instead.</p>
        </div>
      )}

      <div className={styles.audioList}>
        {audioFiles.map((audio) => (
          <div
            key={audio.id}
            className={`${styles.audioCard} ${expandedTrack === audio.id ? styles.expanded : ''}`}
          >
            <div className={styles.audioHeader} onClick={() => toggleTrack(audio.id)}>
              <div className={styles.audioInfo}>
                <button className={styles.toggleButton}>
                  <Music size={20} />
                </button>
                <div>
                  <h3 className={styles.audioTitle}>{audio.title}</h3>
                  <p className={styles.audioArtist}>{audio.artist}</p>
                </div>
              </div>
              <div className={styles.audioActions}>
                <span className={styles.audioDuration}>{audio.duration}</span>
                <button
                  onClick={(e) => {
                    //prevent this event travel up the parent elements in the DOM.
                    e.stopPropagation();
                    handleDownload(audio.fileName, audio.title);
                  }}
                  className={styles.downloadButton}
                >
                  <Download size={18} />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(audio.fileName);
                  }}
                  className={styles.deleteButton}
                >
                  <Trash size={18} />
                </button>
              </div>
            </div>

            {expandedTrack === audio.id && (
              <div className={styles.expandedContent}>
                {/* Added metadata section */}
                <div className={styles.metadataSection}>
                  {audio.description && (
                    <div className={styles.metadataItem}>
                      <span className={styles.metadataLabel}>Description:</span>
                      <span className={styles.metadataValue}>{audio.description}</span>
                    </div>
                  )}
                  {audio.audio_category && (
                    <div className={styles.metadataItem}>
                      <span className={styles.metadataLabel}>Category:</span>
                      <span className={styles.metadataValue}>{audio.audio_category}</span>
                    </div>
                  )}
                  {audio.filePath && (
                    <div className={styles.metadataItem}>
                      <span className={styles.metadataLabel}>File path:</span>
                      <span className={styles.metadataValue}>{audio.filePath}</span>
                    </div>
                  )}
                </div>

                <div className={styles.playerWrapper}>
                  {fetchingAudio && !audioSources[audio.fileName] ? (
                    <div className={styles.loadingState}>Loading audio...</div>
                  ) : audioSources[audio.fileName] ? (
                    <AudioPlayer
                      ref={audioElementRef}
                      src={audioSources[audio.fileName]}
                      onPlay={e => console.log("Playing:", audio.title)}
                      onError={e => handlePlayError(e, audio.fileName)}
                      autoPlay
                      className={styles.individualPlayer}
                      showJumpControls={false}
                      customAdditionalControls={[]}
                      layout="horizontal-reverse"
                    />
                  ) : (
                    <div className={styles.loadingState}>
                      Preparing audio player...
                      <button
                        onClick={() => fetchAudioSource(audio.fileName)}
                        className={styles.retryButton}
                      >
                        Click to load audio
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {audioFiles.length === 0 && !loading && (
        <div className={styles.emptyState}>
          <Music size={48} className={styles.emptyStateIcon} />
          <p>No audio files found</p>
        </div>
      )}
    </div>
  );
};

export default AudioFilesPage;