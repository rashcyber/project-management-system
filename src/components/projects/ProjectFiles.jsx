import React, { useState, useEffect } from 'react';
import {
  File as FileIcon,
  FileText,
  Video,
  Music,
  Table,
  Archive,
  Download,
  Trash2,
  Plus,
  Upload,
  Eye,
  Paperclip
} from 'lucide-react';
import { Button, Loading, Avatar, DeleteConfirmModal } from '../common';
import useProjectStore from '../../store/projectStore';
import { toast } from '../../store/toastStore';
import { supabase } from '../../lib/supabase';
import './ProjectFiles.css';

const ProjectFiles = ({ projectId }) => {
  const { fetchProjectFiles, uploadProjectFile, deleteProjectFile } = useProjectStore();
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [deletingFileId, setDeletingFileId] = useState(null);
  const [fileUrls, setFileUrls] = useState({});
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [fileToDelete, setFileToDelete] = useState(null);

  const loadFiles = async () => {
    setLoading(true);
    const { data, error } = await fetchProjectFiles(projectId);
    if (error) {
      toast.error('Failed to load project files');
    } else {
      setFiles(data || []);
      // Generate URLs in parallel
      const urls = {};
      const promises = (data || []).map(async (file) => {
        const { data: { publicUrl } } = supabase.storage
          .from('project-files')
          .getPublicUrl(file.file_path);
        return { id: file.id, url: publicUrl };
      });

      const results = await Promise.all(promises);
      results.forEach(({ id, url }) => {
        urls[id] = url;
      });
      setFileUrls(urls);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (projectId) {
      loadFiles();
    }
  }, [projectId]);

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploading(true);
    const { error } = await uploadProjectFile(projectId, file);

    if (error) {
      console.error('Upload error:', error);
      toast.error('Failed to upload file: ' + error);
    } else {
      toast.success('File uploaded successfully');
      loadFiles();
    }
    setUploading(false);
    e.target.value = '';
  };

  const handleDeleteClick = (fileId) => {
    const file = files.find(f => f.id === fileId);
    setFileToDelete(file);
    setShowDeleteModal(true);
  };

  const handleDeleteConfirm = async () => {
    if (!fileToDelete) return;

    setDeletingFileId(fileToDelete.id);
    const { error } = await deleteProjectFile(projectId, fileToDelete.id);

    if (error) {
      toast.error('Failed to delete file');
    } else {
      toast.success('File deleted');
      setFiles(files.filter(f => f.id !== fileToDelete.id));
      setShowDeleteModal(false);
      setFileToDelete(null);
    }
    setDeletingFileId(null);
  };

  const handleDownloadFile = async (file) => {
    try {
      const response = await fetch(fileUrls[file.id]);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = file.name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      toast.error('Failed to download file');
    }
  };

  const handlePreviewFile = (file) => {
    window.open(fileUrls[file.id], '_blank');
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const getFileIcon = (mimeType) => {
    if (!mimeType) return <FileIcon size={40} />;
    if (mimeType.startsWith('image/')) return <FileIcon size={40} />;
    if (mimeType.startsWith('video/')) return <Video size={40} />;
    if (mimeType.startsWith('audio/')) return <Music size={40} />;
    if (mimeType.startsWith('application/pdf')) return <FileText size={40} />;
    if (mimeType.includes('word') || mimeType.includes('document')) return <FileText size={40} />;
    if (mimeType.includes('excel') || mimeType.includes('sheet')) return <Table size={40} />;
    if (mimeType.includes('zip') || mimeType.includes('rar')) return <Archive size={40} />;
    return <FileIcon size={40} />;
  };

  if (loading) return <Loading text="Loading files..." />;

  return (
    <div className="project-files">
      <div className="files-header">
        <div className="files-header-info">
          <h2>Project Files</h2>
          <p>{files.length} resource{files.length !== 1 ? 's' : ''} shared with team</p>
        </div>
        <div className="files-actions-header">
          <input
            type="file"
            id="project-file-upload"
            className="hidden-input"
            onChange={handleFileUpload}
            disabled={uploading}
          />
          <Button
            variant="primary"
            icon={<Upload size={18} />}
            onClick={() => document.getElementById('project-file-upload').click()}
            loading={uploading}
          >
            Upload File
          </Button>
        </div>
      </div>

      {files.length === 0 ? (
        <div className="empty-files">
          <div className="empty-files-icon">
            <Paperclip size={48} />
          </div>
          <h3>No files yet</h3>
          <p>Upload project documents, assets, or resources to share with your team.</p>
          <Button
            variant="outline"
            onClick={() => document.getElementById('project-file-upload').click()}
          >
            Upload your first file
          </Button>
        </div>
      ) : (
        <div className="files-grid">
          {files.map((file) => (
            <div key={file.id} className="file-card">
              <div className="file-card-preview">
                {file.mime_type?.startsWith('image/') ? (
                  <img src={fileUrls[file.id]} alt={file.name} className="file-thumb" />
                ) : (
                  <div className="file-icon-large">
                    {getFileIcon(file.mime_type)}
                  </div>
                )}
                <div className="file-card-overlay">
                  <button className="overlay-btn" onClick={() => handlePreviewFile(file)} title="Preview">
                    <Eye size={18} />
                  </button>
                  <button className="overlay-btn" onClick={() => handleDownloadFile(file)} title="Download">
                    <Download size={18} />
                  </button>
                </div>
              </div>
              <div className="file-card-info">
                <span className="file-card-name" title={file.name}>{file.name}</span>
                <div className="file-card-meta">
                  <span>{formatFileSize(file.file_size)}</span>
                  <span className="dot">•</span>
                  <div className="file-uploader-info">
                    <Avatar
                      src={file.uploader?.avatar_url}
                      name={file.uploader?.full_name}
                      size="xsmall"
                    />
                    <span>{file.uploader?.full_name || 'System'}</span>
                  </div>
                </div>
              </div>
              <button
                className="file-card-delete"
                onClick={() => handleDeleteClick(file.id)}
                disabled={deletingFileId === file.id}
              >
                {deletingFileId === file.id ? '...' : <Trash2 size={14} />}
              </button>
            </div>
          ))}
        </div>
      )}

      <DeleteConfirmModal
        isOpen={showDeleteModal}
        onClose={() => {
          setShowDeleteModal(false);
          setFileToDelete(null);
        }}
        onConfirm={handleDeleteConfirm}
        title="Delete File"
        message={`Are you sure you want to delete "${fileToDelete?.name}"? This action cannot be undone.`}
        isLoading={deletingFileId === fileToDelete?.id}
      />
    </div>
  );
};

export default ProjectFiles;
