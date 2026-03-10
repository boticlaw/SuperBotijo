'use client';

import { useState, useEffect } from 'react';
import { X, FileText, FolderOpen, Brain } from 'lucide-react';

interface MemoryModalProps {
  onClose: () => void;
}

interface MemoryFile {
  name: string;
  path: string;
  modified: string;
  size: number;
}

export function MemoryModal({ onClose }: MemoryModalProps) {
  const [memoryFiles, setMemoryFiles] = useState<MemoryFile[]>([]);
  const [workspaceFiles, setWorkspaceFiles] = useState<MemoryFile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMemoryFiles = async () => {
      try {
        // Fetch memory files
        const res = await fetch('/api/memory');
        const data = await res.json();
        
        if (data.files) {
          setMemoryFiles(data.files.slice(0, 5));
        }
        
        // For workspace, we could fetch /api/files but for now show placeholder
        setWorkspaceFiles([]);
      } catch (error) {
        console.error('Failed to fetch memory files:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchMemoryFiles();
  }, []);

  const formatDate = (dateStr: string): string => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  return (
    <div className="absolute inset-0 bg-black/80 flex items-center justify-center z-50">
      <div className="bg-neutral-900 border border-warning rounded-lg p-6 max-w-lg w-full mx-4 shadow-2xl">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-warning flex items-center gap-2">
            <Brain className="w-6 h-6" />
            Memory Browser
          </h2>
          <button
            onClick={onClose}
            className="text-neutral-400 hover:text-white text-2xl leading-none"
          >
            ×
          </button>
        </div>

        {loading ? (
          <div className="text-center py-8 text-neutral-400">Loading...</div>
        ) : (
          <div className="space-y-4">
            {/* Recent Memory Files */}
            <div className="bg-neutral-800 p-4 rounded-lg border border-neutral-700">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-neutral-300 flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  Recent Memory Files
                </h3>
                <a href="/memory" className="text-xs text-warning hover:underline">
                  View all →
                </a>
              </div>
              
              {memoryFiles.length > 0 ? (
                <div className="space-y-2">
                  {memoryFiles.map((file) => (
                    <a
                      key={file.path}
                      href={`/memory?file=${encodeURIComponent(file.path)}`}
                      className="flex items-center justify-between p-2 bg-neutral-700/50 rounded hover:bg-neutral-700 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-neutral-400" />
                        <span className="text-sm text-neutral-200 truncate max-w-[200px]">
                          {file.name}
                        </span>
                      </div>
                      <span className="text-xs text-neutral-500">
                        {formatDate(file.modified)}
                      </span>
                    </a>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-neutral-500 text-center py-4">
                  No memory files found
                </p>
              )}
            </div>

            {/* Quick Links */}
            <div className="bg-neutral-800 p-4 rounded-lg border border-neutral-700">
              <h3 className="text-sm font-semibold text-neutral-300 flex items-center gap-2 mb-3">
                <FolderOpen className="w-4 h-4" />
                Quick Links
              </h3>
              <div className="grid grid-cols-2 gap-2">
                <a
                  href="/memory"
                  className="flex items-center gap-2 p-3 bg-neutral-700/50 rounded hover:bg-neutral-700 transition-colors"
                >
                  <Brain className="w-5 h-5 text-warning" />
                  <span className="text-sm">Memory Browser</span>
                </a>
                <a
                  href="/files"
                  className="flex items-center gap-2 p-3 bg-neutral-700/50 rounded hover:bg-neutral-700 transition-colors"
                >
                  <FolderOpen className="w-5 h-5 text-info" />
                  <span className="text-sm">File Explorer</span>
                </a>
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-neutral-800 p-3 rounded-lg border border-neutral-700 text-center">
                <p className="text-2xl font-bold text-warning">{memoryFiles.length}</p>
                <p className="text-xs text-neutral-400">Memory Files</p>
              </div>
              <div className="bg-neutral-800 p-3 rounded-lg border border-neutral-700 text-center">
                <p className="text-2xl font-bold text-info">-</p>
                <p className="text-xs text-neutral-400">Workspace Files</p>
              </div>
            </div>
          </div>
        )}

        <button
          onClick={onClose}
          className="mt-6 w-full bg-warning hover:bg-warning/90 text-black font-bold py-2 rounded transition-colors"
        >
          Close
        </button>
      </div>
    </div>
  );
}
