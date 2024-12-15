import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { v4 as uuidv4 } from 'uuid';
import { DropZone } from './DropZone';
import { AudioWaveform } from './AudioWaveform';
import { VideoPlayer } from './VideoPlayer';
import { ControlPanel } from './ControlPanel';
import { Toolbar } from './Toolbar';
import { TranscriptContainer } from './TranscriptContainer';
import { FindReplaceModal } from './FindReplaceModal';
import { loadProject, saveProject } from '../utils/storage';
import { useAutoSaveStore } from '../store/autoSaveStore';
import { useHotkeys } from '../hooks/useHotkeys';
import { useTranscription } from '../hooks/useTranscription';
import { PlaybackSettings, TranscriptionProject } from '../types/types';
import { useSettingsStore } from '../store/settingsStore';
import { RecentProjects } from './RecentProjects';
import { motion, AnimatePresence } from 'framer-motion';
import { TranscriptStats } from './TranscriptStats';
import { TranscriptFormatType } from '../types/transcriptFormats';
import { formatTranscript } from '../utils/transcriptFormatter';
import { SettingsModal } from './SettingsModal';

// Move API key to environment variable or configuration file
const ASSEMBLY_API_KEY = import.meta.env.VITE_ASSEMBLY_API_KEY;

if (!ASSEMBLY_API_KEY) {
  console.error('AssemblyAI API key is not set. Please set VITE_ASSEMBLY_API_KEY in your environment variables.');
}

interface SpeakerMap {
  [key: string]: string;
}

const getSpeakerLabel = (speakerId: string): string => {
  const speakerNumber = parseInt(speakerId.replace('speaker_', '')) - 1;
  return `Speaker ${String.fromCharCode(65 + speakerNumber)}`;
};

export const EditorView = () => {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const [file, setFile] = useState<File | null>(null);
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [transcriptContent, setTranscriptContent] = useState('');
  const [isFindReplaceOpen, setIsFindReplaceOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const lastSaved = useAutoSaveStore(state => state.lastSaved);
  const setLastSaved = useAutoSaveStore(state => state.setLastSaved);
  const { defaultPlaybackSpeed, defaultVolume } = useSettingsStore();
  
  const {
    transcribeAudio,
    status: transcriptionStatus,
    progress: transcriptionProgress,
    error: transcriptionError,
    result: transcriptionResult
  } = useTranscription(ASSEMBLY_API_KEY);

  const [playbackSettings, setPlaybackSettings] = useState<PlaybackSettings>({
    speed: defaultPlaybackSpeed,
    volume: defaultVolume
  });

  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [selectedFormat, setSelectedFormat] = useState<TranscriptFormatType>('iScribe+');
  const [selectedText, setSelectedText] = useState('');

  // Add function to get selected text
  const getSelectedText = () => {
    const selection = window.getSelection();
    return selection ? selection.toString() : '';
  };

  // Handle transcription result
  useEffect(() => {
    if (transcriptionResult) {
      let formattedTranscript = '';
      
      if (transcriptionResult.utterances) {
        formattedTranscript = formatTranscript(transcriptionResult.utterances, selectedFormat);
      } else {
        formattedTranscript = transcriptionResult.text;
      }

      setTranscriptContent(formattedTranscript);
      
      if (projectId) {
        try {
          const project = loadProject(projectId);
          if (project) {
            saveProject({
              ...project,
              content: formattedTranscript,
              transcriptFormat: selectedFormat,
              transcriptionResult: {
                text: transcriptionResult.text,
                utterances: transcriptionResult.utterances,
                status: transcriptionResult.status || 'completed'
              },
              lastModified: Date.now()
            });
          }
        } catch (error) {
          console.error('Error saving transcription result:', error);
          setError('Failed to save transcription result');
        }
      }
    }
  }, [transcriptionResult, projectId, selectedFormat]);

  // Handle transcription errors
  useEffect(() => {
    if (transcriptionError) {
      setError(`Transcription error: ${transcriptionError}`);
    }
  }, [transcriptionError]);

  // Update transcription status
  useEffect(() => {
    setIsTranscribing(transcriptionStatus === 'uploading' || transcriptionStatus === 'transcribing');
  }, [transcriptionStatus]);

  // Seek functions
  const seekBackward = (seconds: number) => {
    const newTime = Math.max(currentTime - seconds, 0);
    setCurrentTime(newTime);
    if (videoRef.current) videoRef.current.currentTime = newTime;
    if (audioRef.current) audioRef.current.currentTime = newTime;
  };

  const seekForward = (seconds: number) => {
    const maxDuration = videoRef.current?.duration || audioRef.current?.duration || 0;
    const newTime = Math.min(currentTime + seconds, maxDuration);
    setCurrentTime(newTime);
    if (videoRef.current) videoRef.current.currentTime = newTime;
    if (audioRef.current) audioRef.current.currentTime = newTime;
  };

  // Playback speed cycling (0.5x -> 1x -> 1.5x -> 2x)
  const cyclePlaybackSpeed = () => {
    const speeds = [0.5, 1, 1.5, 2];
    const currentIndex = speeds.indexOf(playbackSpeed);
    const nextIndex = (currentIndex + 1) % speeds.length;
    const newSpeed = speeds[nextIndex];
    setPlaybackSpeed(newSpeed);
    setPlaybackSettings(prev => ({ ...prev, speed: newSpeed }));
  };

  // Use the hotkeys hook with all shortcuts
  useHotkeys({
    onPlayPause: () => setIsPlaying(!isPlaying),
    onSeekBackward5: () => seekBackward(5),
    onSeekForward5: () => seekForward(5),
    onCyclePlaybackSpeed: cyclePlaybackSpeed,
    onFindReplace: (e: KeyboardEvent) => {
      e.preventDefault();
      const selected = getSelectedText();
      setSelectedText(selected);
      setIsFindReplaceOpen(prev => !prev);
    },
    onInsertTimestamp: (e: KeyboardEvent) => {
      e.preventDefault();
      const time = currentTime;
      const hours = Math.floor(time / 3600).toString().padStart(2, '0');
      const minutes = Math.floor((time % 3600) / 60).toString().padStart(2, '0');
      const seconds = Math.floor(time % 60).toString().padStart(2, '0');
      const timestamp = `[${hours}:${minutes}:${seconds}] `;

      const editor = document.querySelector('[contenteditable="true"]') as HTMLElement;
      if (editor) {
        const selection = window.getSelection();
        const range = selection?.getRangeAt(0);
        if (range) {
          const textNode = document.createTextNode(timestamp);
          range.insertNode(textNode);
          range.collapse(false);
          selection?.removeAllRanges();
          selection?.addRange(range);

          handleContentUpdate(editor.innerText);
        }
      }
    },
    onExport: () => {
      const exportButton = document.querySelector('[data-export-button]') as HTMLButtonElement;
      if (exportButton) exportButton.click();
    },
    onSeekBackward1: () => seekBackward(1)
  });

  // Handle file selection for new projects
  const handleFileSelect = async (selectedFile: File | null, skipTranscription: boolean, format: TranscriptFormatType) => {
    // Clean up existing file URL
    if (fileUrl) {
      URL.revokeObjectURL(fileUrl);
    }

    setSelectedFormat(format);

    // Handle empty editor case
    if (!selectedFile && skipTranscription) {
      // Create new empty project for direct editing
      const newProject: TranscriptionProject = {
        id: projectId || uuidv4(),
        name: 'New Project',
        fileName: 'New Project',
        content: '',
        lastModified: Date.now(),
        segments: [],
        mediaType: 'audio',
        duration: 0,
        transcriptFormat: format
      };

      // Save project
      saveProject(newProject);
      
      if (!projectId) {
        navigate(`/editor/${newProject.id}`);
      }

      // Set empty state
      setFile(null);
      setFileUrl(null);
      setTranscriptContent('');
      return;
    }

    // Handle file upload case
    if (selectedFile) {
      // Check if file is a supported audio/video format
      const supportedFormats = [
        // Video formats
        'video/mp4', 'video/webm', 'video/ogg',
        // Audio formats
        'audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/ogg', 'audio/m4a', 'audio/webm'
      ];

      if (!supportedFormats.includes(selectedFile.type)) {
        setError('Unsupported file format. Please use a common audio or video format.');
        return;
      }

      // Create object URL for the file
      const url = URL.createObjectURL(selectedFile);
      
      // Update state with the new file
      setFile(selectedFile);
      setFileUrl(url);

      if (projectId) {
        // For existing projects, preserve the transcription
        const existingProject = loadProject(projectId);
        if (existingProject) {
          saveProject({
            ...existingProject,
            fileName: selectedFile.name,
            mediaType: selectedFile.type.startsWith('video/') ? 'video' : 'audio',
            lastModified: Date.now(),
            transcriptFormat: format
          });
        }
      } else {
        // Create new project
        const newProject: TranscriptionProject = {
          id: uuidv4(),
          name: selectedFile.name.replace(/\.[^/.]+$/, ''),
          fileName: selectedFile.name,
          content: '',
          lastModified: Date.now(),
          segments: [],
          mediaType: selectedFile.type.startsWith('video/') ? 'video' : 'audio',
          duration: 0,
          transcriptFormat: format
        };

        // Save project
        saveProject(newProject);
        navigate(`/editor/${newProject.id}`);
      }

      // Start transcription only if not skipped and it's a new project
      if (!skipTranscription && !projectId) {
        try {
          await transcribeAudio(selectedFile);
        } catch (error) {
          console.error('Transcription error:', error);
          // Error is already handled by the useTranscription hook
        }
      }
    }
  };

  // Load existing project
  useEffect(() => {
    if (projectId) {
      try {
        const project = loadProject(projectId);
        if (project) {
          // Set the saved content first
          setTranscriptContent(project.content || '');
          
          // Set the project's format
          if (project.transcriptFormat) {
            setSelectedFormat(project.transcriptFormat);
          }
          
          // If there's a saved file, load it
          if (project.fileName !== 'New Project' && file) {
            // Just update the file URL
            if (fileUrl) {
              URL.revokeObjectURL(fileUrl); // Clean up old URL
            }
            const url = URL.createObjectURL(file);
            setFileUrl(url);
          }
          
          // Only use transcription result if there's no saved content
          if (!project.content && project.transcriptionResult?.status === 'completed') {
            let formattedTranscript = '';
            
            if (project.transcriptionResult.utterances) {
              formattedTranscript = formatTranscript(
                project.transcriptionResult.utterances,
                project.transcriptFormat || selectedFormat
              );
            } else {
              formattedTranscript = project.transcriptionResult.text;
            }

            setTranscriptContent(formattedTranscript);
          }
        } else {
          setError('Project not found');
        }
      } catch (error) {
        console.error('Error loading project:', error);
        setError('Failed to load project');
      }
    }
  }, [projectId, file]);

  // Clean up file URLs on unmount
  useEffect(() => {
    return () => {
      if (fileUrl) {
        URL.revokeObjectURL(fileUrl);
      }
    };
  }, [fileUrl]);

  // Handle transcript content updates
  const handleContentUpdate = (content: string) => {
    setTranscriptContent(content);
    if (projectId) {
      try {
        const project = loadProject(projectId);
        if (project) {
          saveProject({
            ...project,
            content,
            lastModified: Date.now()
          });
          // Update last saved timestamp
          setLastSaved(new Date());
        }
      } catch (error) {
        console.error('Error saving project:', error);
        setError('Failed to save project');
      }
    }
  };

  const onOpenSettings = () => {
    setIsSettingsOpen(true);
  };

  return (
    <div className="fixed inset-0 flex flex-col overflow-hidden">
      {/* Fixed Control Panel below header */}
      {file && (
        <div className="fixed top-16 left-0 right-0 z-40 bg-gray-900/95 backdrop-blur-sm border-b border-gray-800">
          <div className="px-4 py-1 md:px-6 lg:px-8">
            <ControlPanel
              isPlaying={isPlaying}
              onPlayPause={() => setIsPlaying(!isPlaying)}
              onReset={() => setCurrentTime(0)}
              fileName={file.name}
              isTranscribing={isTranscribing}
              transcriptionProgress={transcriptionProgress}
            />
          </div>
        </div>
      )}

      {/* Main content area */}
      <div className="flex-1">
        <AnimatePresence>
          {error && (
            <motion.div 
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="fixed top-32 left-4 right-4 z-30 p-3 mx-4 mb-4 bg-red-500/10 border border-red-500 rounded-lg text-red-500 text-sm shadow-lg"
            >
              {error}
            </motion.div>
          )}
        </AnimatePresence>

        {!file ? (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="fixed top-16 left-0 right-0 bottom-0 overflow-hidden"
          >
            <div className="h-full flex items-center justify-center">
              <div className="w-full max-w-[1200px] px-4">
                <motion.div 
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.1 }}
                >
                  <DropZone 
                    onFileSelect={handleFileSelect} 
                    isExistingProject={Boolean(projectId && loadProject(projectId))} 
                  />
                </motion.div>
                {!projectId && (
                  <motion.div 
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.2 }}
                    className="mt-8"
                  >
                    <RecentProjects />
                  </motion.div>
                )}
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="fixed top-32 left-0 right-0 bottom-16 overflow-hidden"
          >
            <div className="h-full mx-auto w-full max-w-[1920px] px-4 md:px-6 lg:px-8 pt-[1px] border-t border-gray-800">
              {/* Main content grid */}
              <div className="grid grid-cols-1 lg:grid-cols-[65%_35%] gap-6">
                {/* Left side - Transcript */}
                <motion.div 
                  initial={{ x: -20, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ delay: 0.1 }}
                  className="flex flex-col h-full"
                >
                  <TranscriptContainer
                    content={transcriptContent}
                    onContentChange={handleContentUpdate}
                    currentTime={currentTime}
                    onOpenFindReplace={() => setIsFindReplaceOpen(true)}
                    onSavingStateChange={setIsSaving}
                  />
                </motion.div>

                {/* Right side - Media Player and Stats */}
                <motion.div 
                  initial={{ x: 20, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ delay: 0.2 }}
                  className="flex flex-col space-y-4"
                >
                  {/* Media Player */}
                  <div className="bg-gray-900 rounded-lg p-4 shadow-xl">
                    {file && file.type.startsWith('video/') ? (
                      <VideoPlayer
                        ref={videoRef}
                        videoUrl={fileUrl!}
                        isPlaying={isPlaying}
                        currentTime={currentTime}
                        playbackSettings={playbackSettings}
                        onTimeUpdate={setCurrentTime}
                      />
                    ) : (
                      <AudioWaveform
                        ref={audioRef}
                        audioUrl={fileUrl!}
                        isPlaying={isPlaying}
                        currentTime={currentTime}
                        playbackSettings={playbackSettings}
                        onTimeUpdate={setCurrentTime}
                      />
                    )}
                  </div>

                  {/* Transcript Statistics */}
                  <motion.div
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.3 }}
                  >
                    <TranscriptStats 
                      content={transcriptContent}
                      transcriptionResult={transcriptionResult ? {
                        text: transcriptionResult.text,
                        utterances: transcriptionResult.utterances,
                        status: transcriptionResult.status || 'unknown'
                      } : undefined}
                      duration={videoRef.current?.duration || audioRef.current?.duration || 0}
                    />
                  </motion.div>
                </motion.div>
              </div>
            </div>

            {/* Toolbar */}
            <motion.div 
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              className="fixed bottom-0 left-0 right-0 bg-gray-900/95 backdrop-blur-sm border-t border-gray-800 shadow-2xl"
            >
              <Toolbar
                playbackSettings={playbackSettings}
                setPlaybackSettings={setPlaybackSettings}
                fileName={file?.name || ''}
                lastSaved={lastSaved ? lastSaved.getTime() : null}
                isSaving={isSaving}
                content={transcriptContent}
                transcriptFormat={selectedFormat}
                onOpenSettings={onOpenSettings}
              />
            </motion.div>

            <FindReplaceModal
              isOpen={isFindReplaceOpen}
              onClose={() => setIsFindReplaceOpen(false)}
              content={transcriptContent}
              onContentChange={handleContentUpdate}
              initialSearchText={selectedText}
            />

            <SettingsModal
              isOpen={isSettingsOpen}
              onClose={() => setIsSettingsOpen(false)}
              playbackSettings={playbackSettings}
              onPlaybackSettingsChange={setPlaybackSettings}
            />
          </motion.div>
        )}
      </div>
    </div>
  );
};
