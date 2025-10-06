import { useState, useEffect } from 'react';
import {
  FolderOpen,
  FileText,
  Upload,
  Star,
  Search,
  Plus,
  Archive,
  Eye,
  X,
  ArrowLeft,
  Film,
  Image as ImageIcon,
  File,
  Edit
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { showError } from '../lib/toast';

interface SalesResourcesProps {
  onBack: () => void;
  userRole: 'sales' | 'operations' | 'sales-manager' | 'admin';
  viewMode?: 'mobile' | 'desktop'; // Reserved for future use
}

interface Folder {
  id: string;
  name: string;
  created_by: string;
  created_at: string;
  archived: boolean;
}

interface ResourceFile {
  id: string;
  folder_id: string;
  name: string;
  description?: string;
  file_type: string;
  file_size: number;
  storage_path: string;
  uploaded_by: string;
  uploaded_at: string;
  archived: boolean;
  archived_at?: string;
  archived_by?: string;
  view_count: number;
  is_favorited?: boolean;
  is_new?: boolean; // Added within last 7 days
}

const SalesResources = ({ onBack, userRole }: SalesResourcesProps) => {
  const [folders, setFolders] = useState<Folder[]>([]);
  const [files, setFiles] = useState<ResourceFile[]>([]);
  const [archivedFiles, setArchivedFiles] = useState<ResourceFile[]>([]);
  const [selectedFolder, setSelectedFolder] = useState<Folder | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showNewFolderModal, setShowNewFolderModal] = useState(false);
  const [showArchivedFiles, setShowArchivedFiles] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingFile, setEditingFile] = useState<ResourceFile | null>(null);
  const [editFileName, setEditFileName] = useState('');
  const [editFileDescription, setEditFileDescription] = useState('');
  const [newFolderName, setNewFolderName] = useState('');
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);

  const canEdit = userRole === 'sales-manager' || userRole === 'admin';
  const isAdmin = userRole === 'admin';

  useEffect(() => {
    loadFolders();
  }, []);

  useEffect(() => {
    if (selectedFolder) {
      loadFiles(selectedFolder.id);
    }
  }, [selectedFolder]);

  const loadFolders = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('sales_resources_folders')
        .select('*')
        .eq('archived', false)
        .order('name');

      if (error) throw error;
      setFolders(data || []);
    } catch (error) {
      console.error('Error loading folders:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadFiles = async (folderId: string) => {
    try {
      setLoading(true);
      const userId = localStorage.getItem('userId') || '00000000-0000-0000-0000-000000000001';

      // Get files
      const { data: filesData, error: filesError } = await supabase
        .from('sales_resources_files')
        .select('*')
        .eq('folder_id', folderId)
        .eq('archived', false)
        .order('uploaded_at', { ascending: false });

      if (filesError) throw filesError;

      // Get favorites for current user
      const { data: favoritesData } = await supabase
        .from('sales_resources_favorites')
        .select('file_id')
        .eq('user_id', userId);

      const favoriteIds = new Set(favoritesData?.map(f => f.file_id) || []);

      // Mark files as favorited and new (within 7 days)
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const enrichedFiles = filesData?.map(file => ({
        ...file,
        is_favorited: favoriteIds.has(file.id),
        is_new: new Date(file.uploaded_at) > sevenDaysAgo
      })) || [];

      setFiles(enrichedFiles);
    } catch (error) {
      console.error('Error loading files:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateFolder = async () => {
    if (!newFolderName.trim() || !canEdit) return;

    try {
      const userId = localStorage.getItem('userId') || '00000000-0000-0000-0000-000000000001';
      const { error } = await supabase
        .from('sales_resources_folders')
        .insert({
          name: newFolderName,
          created_by: userId
        });

      if (error) throw error;

      setNewFolderName('');
      setShowNewFolderModal(false);
      loadFolders();
    } catch (error) {
      console.error('Error creating folder:', error);
      showError('Failed to create folder');
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !selectedFolder || !canEdit) return;

    const file = e.target.files[0];
    const maxSize = 20 * 1024 * 1024; // 20MB

    if (file.size > maxSize) {
      showError('File size must be less than 20MB');
      return;
    }

    // Validate file type
    const allowedTypes = [
      'application/pdf',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'image/jpeg',
      'image/png',
      'image/gif',
      'video/mp4',
      'video/quicktime'
    ];

    if (!allowedTypes.includes(file.type)) {
      showError('Invalid file type. Allowed: PDF, PPT, PPTX, Images, Videos');
      return;
    }

    try {
      setUploading(true);
      const userId = localStorage.getItem('userId') || '00000000-0000-0000-0000-000000000001';

      // Check for duplicate filename in current folder
      const { data: existingFiles, error: checkError } = await supabase
        .from('sales_resources_files')
        .select('id, name, archived')
        .eq('folder_id', selectedFolder.id)
        .eq('name', file.name)
        .eq('archived', false);

      if (checkError) throw checkError;

      if (existingFiles && existingFiles.length > 0) {
        const shouldReplace = confirm(
          `A file named "${file.name}" already exists in this folder.\n\n` +
          `Do you want to archive the existing file and upload the new one?`
        );

        if (!shouldReplace) {
          setUploading(false);
          setShowUploadModal(false);
          return;
        }

        // Archive the existing file
        await supabase
          .from('sales_resources_files')
          .update({
            archived: true,
            archived_at: new Date().toISOString(),
            archived_by: userId
          })
          .eq('id', existingFiles[0].id);
      }

      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}.${fileExt}`;
      const filePath = `${selectedFolder.id}/${fileName}`;

      console.log('📤 Uploading file:', {
        fileName: file.name,
        fileType: file.type,
        fileSize: file.size,
        filePath,
        folderId: selectedFolder.id,
        userId
      });

      // Upload to storage with proper content type for inline viewing
      const { error: uploadError, data: uploadData } = await supabase.storage
        .from('sales-resources')
        .upload(filePath, file, {
          contentType: file.type,
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) {
        console.error('❌ Storage upload error:', uploadError);
        throw uploadError;
      }

      console.log('✅ Storage upload successful:', uploadData);

      // Get file type category
      let fileType = 'file';
      if (file.type.startsWith('image/')) fileType = 'image';
      else if (file.type.startsWith('video/')) fileType = 'video';
      else if (file.type.includes('pdf')) fileType = 'pdf';
      else if (file.type.includes('presentation')) fileType = 'ppt';

      // Save metadata to database
      console.log('💾 Saving to database:', {
        folder_id: selectedFolder.id,
        name: file.name,
        file_type: fileType,
        file_size: file.size,
        storage_path: filePath,
        uploaded_by: userId
      });

      const { error: dbError, data: dbData } = await supabase
        .from('sales_resources_files')
        .insert({
          folder_id: selectedFolder.id,
          name: file.name,
          file_type: fileType,
          file_size: file.size,
          storage_path: filePath,
          uploaded_by: userId
        });

      if (dbError) {
        console.error('❌ Database insert error:', dbError);
        throw dbError;
      }

      console.log('✅ Database insert successful:', dbData);

      setShowUploadModal(false);
      loadFiles(selectedFolder.id);
    } catch (error) {
      console.error('Error uploading file:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      showError(`Failed to upload file: ${errorMessage}`);
    } finally {
      setUploading(false);
    }
  };

  const handleToggleFavorite = async (file: ResourceFile) => {
    try {
      const userId = localStorage.getItem('userId') || '00000000-0000-0000-0000-000000000001';

      if (file.is_favorited) {
        // Remove favorite
        await supabase
          .from('sales_resources_favorites')
          .delete()
          .eq('file_id', file.id)
          .eq('user_id', userId);
      } else {
        // Add favorite
        await supabase
          .from('sales_resources_favorites')
          .insert({
            file_id: file.id,
            user_id: userId
          });
      }

      // Reload files
      if (selectedFolder) {
        loadFiles(selectedFolder.id);
      }
    } catch (error) {
      console.error('Error toggling favorite:', error);
    }
  };

  const handleViewFile = async (file: ResourceFile) => {
    try {
      // Track view
      const userId = localStorage.getItem('userId') || '00000000-0000-0000-0000-000000000001';
      await supabase
        .from('sales_resources_views')
        .insert({
          file_id: file.id,
          user_id: userId
        });

      // Increment view count
      await supabase
        .from('sales_resources_files')
        .update({ view_count: file.view_count + 1 })
        .eq('id', file.id);

      // Use public URL for inline viewing (bucket must be public)
      const { data } = supabase.storage
        .from('sales-resources')
        .getPublicUrl(file.storage_path);

      if (data?.publicUrl) {
        window.open(data.publicUrl, '_blank');
      }
    } catch (error) {
      console.error('Error viewing file:', error);
    }
  };

  const loadArchivedFiles = async () => {
    if (!isAdmin) return;

    try {
      setLoading(true);
      const userId = localStorage.getItem('userId') || '00000000-0000-0000-0000-000000000001';

      // Get archived files from all folders
      const { data: filesData, error: filesError } = await supabase
        .from('sales_resources_files')
        .select('*')
        .eq('archived', true)
        .order('archived_at', { ascending: false });

      if (filesError) throw filesError;

      // Get favorites for current user
      const { data: favoritesData } = await supabase
        .from('sales_resources_favorites')
        .select('file_id')
        .eq('user_id', userId);

      const favoriteIds = new Set(favoritesData?.map(f => f.file_id) || []);

      const enrichedFiles = filesData?.map(file => ({
        ...file,
        is_favorited: favoriteIds.has(file.id),
        is_new: false
      })) || [];

      setArchivedFiles(enrichedFiles);
    } catch (error) {
      console.error('Error loading archived files:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleArchiveFile = async (file: ResourceFile) => {
    if (!canEdit) return;

    try {
      const userId = localStorage.getItem('userId') || '00000000-0000-0000-0000-000000000001';
      await supabase
        .from('sales_resources_files')
        .update({
          archived: true,
          archived_at: new Date().toISOString(),
          archived_by: userId
        })
        .eq('id', file.id);

      if (selectedFolder) {
        loadFiles(selectedFolder.id);
      }
    } catch (error) {
      console.error('Error archiving file:', error);
      showError('Failed to archive file');
    }
  };

  const handlePermanentDelete = async (file: ResourceFile) => {
    if (!isAdmin) return;

    if (!confirm(`Permanently delete "${file.name}"? This cannot be undone.`)) return;

    try {
      // Delete from storage
      const { error: storageError } = await supabase.storage
        .from('sales-resources')
        .remove([file.storage_path]);

      if (storageError) throw storageError;

      // Delete from database
      const { error: dbError } = await supabase
        .from('sales_resources_files')
        .delete()
        .eq('id', file.id);

      if (dbError) throw dbError;

      loadArchivedFiles();
    } catch (error) {
      console.error('Error deleting file:', error);
      showError('Failed to delete file permanently');
    }
  };

  const handleRestoreFile = async (file: ResourceFile) => {
    if (!isAdmin) return;

    try {
      await supabase
        .from('sales_resources_files')
        .update({
          archived: false,
          archived_at: null,
          archived_by: null
        })
        .eq('id', file.id);

      loadArchivedFiles();
    } catch (error) {
      console.error('Error restoring file:', error);
      showError('Failed to restore file');
    }
  };

  const handleEditFile = (file: ResourceFile) => {
    if (!canEdit) return;
    setEditingFile(file);

    // Extract filename without extension for editing
    const lastDotIndex = file.name.lastIndexOf('.');
    const nameWithoutExt = lastDotIndex > 0 ? file.name.substring(0, lastDotIndex) : file.name;

    setEditFileName(nameWithoutExt);
    setEditFileDescription(file.description || '');
    setShowEditModal(true);
  };

  const handleSaveFileEdit = async () => {
    if (!editingFile || !canEdit) return;

    if (!editFileName.trim()) {
      showError('File name cannot be empty');
      return;
    }

    try {
      // Get the original file extension
      const lastDotIndex = editingFile.name.lastIndexOf('.');
      const extension = lastDotIndex > 0 ? editingFile.name.substring(lastDotIndex) : '';

      // Construct new full name with original extension
      const newFullName = editFileName.trim() + extension;

      // Check if new name conflicts with existing files (excluding current file)
      if (newFullName !== editingFile.name) {
        const { data: existingFiles, error: checkError } = await supabase
          .from('sales_resources_files')
          .select('id')
          .eq('folder_id', editingFile.folder_id)
          .eq('name', newFullName)
          .eq('archived', false)
          .neq('id', editingFile.id);

        if (checkError) throw checkError;

        if (existingFiles && existingFiles.length > 0) {
          showError(`A file named "${newFullName}" already exists in this folder`);
          return;
        }
      }

      const { error } = await supabase
        .from('sales_resources_files')
        .update({
          name: newFullName,
          description: editFileDescription.trim() || null
        })
        .eq('id', editingFile.id);

      if (error) throw error;

      setShowEditModal(false);
      setEditingFile(null);

      if (selectedFolder) {
        loadFiles(selectedFolder.id);
      } else if (showArchivedFiles) {
        loadArchivedFiles();
      }
    } catch (error) {
      console.error('Error updating file:', error);
      showError('Failed to update file');
    }
  };

  const getFileIcon = (fileType: string) => {
    switch (fileType) {
      case 'pdf':
        return <FileText className="w-6 h-6 text-red-500" />;
      case 'ppt':
        return <FileText className="w-6 h-6 text-orange-500" />;
      case 'image':
        return <ImageIcon className="w-6 h-6 text-blue-500" />;
      case 'video':
        return <Film className="w-6 h-6 text-purple-500" />;
      default:
        return <File className="w-6 h-6 text-gray-500" />;
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const filteredFiles = files.filter(file => {
    const matchesSearch = file.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = filterType === 'all' || file.file_type === filterType;
    return matchesSearch && matchesFilter;
  });

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-gray-200 p-4 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <button
            onClick={() => {
              if (showArchivedFiles) {
                setShowArchivedFiles(false);
              } else {
                onBack();
              }
            }}
            className="text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          <FolderOpen className="w-6 h-6 text-blue-600" />
          <h1 className="text-xl font-bold text-gray-900">
            {showArchivedFiles ? 'Archived Files' : (selectedFolder ? selectedFolder.name : 'Sales Resources')}
          </h1>
        </div>
        <div className="flex items-center space-x-2">
          {isAdmin && !selectedFolder && !showArchivedFiles && (
            <button
              onClick={() => {
                setShowArchivedFiles(true);
                loadArchivedFiles();
              }}
              className="px-4 py-2 bg-orange-100 text-orange-700 border border-orange-300 rounded-lg hover:bg-orange-200 flex items-center space-x-2"
            >
              <Archive className="w-4 h-4" />
              <span>Archived</span>
            </button>
          )}
          {canEdit && !showArchivedFiles && (
            <>
              {!selectedFolder && (
                <button
                  onClick={() => setShowNewFolderModal(true)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center space-x-2"
                >
                  <Plus className="w-4 h-4" />
                  <span>New Folder</span>
                </button>
              )}
              {selectedFolder && (
                <button
                  onClick={() => setShowUploadModal(true)}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center space-x-2"
                >
                  <Upload className="w-4 h-4" />
                  <span>Upload File</span>
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Folder view */}
      {!selectedFolder && (
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="text-center py-12">Loading folders...</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {folders.map((folder, index) => {
                // Assign different colors to folders
                const colors = [
                  'bg-gradient-to-br from-blue-500 to-blue-600',
                  'bg-gradient-to-br from-purple-500 to-purple-600',
                  'bg-gradient-to-br from-green-500 to-green-600',
                  'bg-gradient-to-br from-orange-500 to-orange-600',
                  'bg-gradient-to-br from-pink-500 to-pink-600',
                  'bg-gradient-to-br from-indigo-500 to-indigo-600',
                  'bg-gradient-to-br from-teal-500 to-teal-600',
                  'bg-gradient-to-br from-red-500 to-red-600'
                ];
                const colorClass = colors[index % colors.length];

                return (
                  <button
                    key={folder.id}
                    onClick={() => setSelectedFolder(folder)}
                    className={`${colorClass} rounded-2xl p-8 shadow-lg hover:shadow-xl transition-all transform hover:scale-105 flex flex-col items-center space-y-4 text-white relative overflow-hidden`}
                  >
                    {/* Background pattern */}
                    <div className="absolute inset-0 opacity-10">
                      <div className="absolute top-0 right-0 w-32 h-32 bg-white rounded-full -mr-16 -mt-16"></div>
                      <div className="absolute bottom-0 left-0 w-24 h-24 bg-white rounded-full -ml-12 -mb-12"></div>
                    </div>

                    {/* Folder icon */}
                    <div className="bg-white/20 p-4 rounded-xl backdrop-blur-sm relative z-10">
                      <FolderOpen className="w-12 h-12" />
                    </div>

                    {/* Folder name */}
                    <span className="font-bold text-lg text-center relative z-10">{folder.name}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Files view */}
      {selectedFolder && (
        <div className="flex-1 overflow-y-auto">
          {/* Search and filters */}
          <div className="bg-white border-b border-gray-200 p-4 flex items-center space-x-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search files..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Types</option>
              <option value="pdf">PDF</option>
              <option value="ppt">PowerPoint</option>
              <option value="image">Images</option>
              <option value="video">Videos</option>
            </select>
            <button
              onClick={() => setSelectedFolder(null)}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
            >
              Back to Folders
            </button>
          </div>

          {/* Files list */}
          <div className="p-6">
            {loading ? (
              <div className="text-center py-12">Loading files...</div>
            ) : filteredFiles.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                No files found. {canEdit && 'Upload your first file!'}
              </div>
            ) : (
              <div className="space-y-4">
                {filteredFiles.map(file => (
                  <div
                    key={file.id}
                    className="bg-white rounded-xl p-5 shadow hover:shadow-lg transition-all border border-gray-200"
                  >
                    {/* Top section: Icon, Name, and Badge */}
                    <div className="flex items-start space-x-4 mb-4">
                      <div className="flex-shrink-0">
                        {getFileIcon(file.file_type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between mb-2">
                          <h3 className="font-semibold text-gray-900 text-base break-words pr-2">
                            {file.name}
                          </h3>
                          {file.is_new && (
                            <span className="px-2 py-1 bg-green-100 text-green-800 text-xs font-semibold rounded flex-shrink-0">
                              NEW
                            </span>
                          )}
                        </div>

                        {/* Description */}
                        {file.description && (
                          <p className="text-sm text-gray-600 italic mb-2">"{file.description}"</p>
                        )}

                        {/* File metadata */}
                        <div className="flex flex-wrap items-center gap-3 text-sm text-gray-500">
                          <span className="flex items-center space-x-1">
                            <span className="font-medium">{formatFileSize(file.file_size)}</span>
                          </span>
                          <span>•</span>
                          <span>{new Date(file.uploaded_at).toLocaleDateString()}</span>
                          <span>•</span>
                          <span className="flex items-center space-x-1">
                            <Eye className="w-4 h-4" />
                            <span>{file.view_count} views</span>
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Bottom section: Action buttons */}
                    <div className="flex items-center space-x-2 pt-3 border-t border-gray-100">
                      <button
                        onClick={() => handleToggleFavorite(file)}
                        className={`flex-1 px-4 py-2.5 rounded-lg font-medium transition-colors ${
                          file.is_favorited
                            ? 'bg-yellow-50 text-yellow-700 hover:bg-yellow-100 border border-yellow-200'
                            : 'bg-gray-50 text-gray-600 hover:bg-gray-100 border border-gray-200'
                        }`}
                      >
                        <div className="flex items-center justify-center space-x-2">
                          <Star className={`w-4 h-4 ${file.is_favorited ? 'fill-current' : ''}`} />
                          <span className="text-sm">{file.is_favorited ? 'Favorited' : 'Favorite'}</span>
                        </div>
                      </button>

                      <button
                        onClick={() => handleViewFile(file)}
                        className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors"
                      >
                        <div className="flex items-center justify-center space-x-2">
                          <Eye className="w-4 h-4" />
                          <span className="text-sm">View</span>
                        </div>
                      </button>

                      {canEdit && (
                        <>
                          <button
                            onClick={() => handleEditFile(file)}
                            className="px-4 py-2.5 bg-gray-50 text-gray-700 hover:bg-gray-100 rounded-lg border border-gray-300 font-medium transition-colors"
                            title="Edit name and description"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleArchiveFile(file)}
                            className="px-4 py-2.5 bg-orange-50 text-orange-600 hover:bg-orange-100 rounded-lg border border-orange-200 font-medium transition-colors"
                            title="Archive file"
                          >
                            <Archive className="w-4 h-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Archived Files View */}
      {showArchivedFiles && (
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="text-center py-12">Loading archived files...</div>
          ) : archivedFiles.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              No archived files
            </div>
          ) : (
            <div className="space-y-4">
              {archivedFiles.map(file => (
                <div
                  key={file.id}
                  className="bg-orange-50 rounded-xl p-5 shadow hover:shadow-lg transition-all border-2 border-orange-200"
                >
                  {/* Top section: Icon, Name, and Badge */}
                  <div className="flex items-start space-x-4 mb-4">
                    <div className="flex-shrink-0">
                      {getFileIcon(file.file_type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between mb-2">
                        <h3 className="font-semibold text-gray-900 text-base break-words pr-2">
                          {file.name}
                        </h3>
                        <span className="px-2 py-1 bg-orange-200 text-orange-800 text-xs font-semibold rounded flex-shrink-0">
                          ARCHIVED
                        </span>
                      </div>

                      {/* File metadata */}
                      <div className="flex flex-wrap items-center gap-3 text-sm text-gray-600 mb-3">
                        <span className="font-medium">{formatFileSize(file.file_size)}</span>
                        <span>•</span>
                        <span>Archived: {new Date(file.archived_at || file.uploaded_at).toLocaleDateString()}</span>
                        <span>•</span>
                        <span className="flex items-center space-x-1">
                          <Eye className="w-4 h-4" />
                          <span>{file.view_count} views</span>
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Bottom section: Action buttons */}
                  <div className="flex items-center space-x-2 pt-3 border-t border-orange-200">
                    <button
                      onClick={() => handleViewFile(file)}
                      className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors"
                    >
                      <div className="flex items-center justify-center space-x-2">
                        <Eye className="w-4 h-4" />
                        <span className="text-sm">View</span>
                      </div>
                    </button>

                    <button
                      onClick={() => handleRestoreFile(file)}
                      className="flex-1 px-4 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium transition-colors"
                    >
                      <div className="flex items-center justify-center space-x-2">
                        <Upload className="w-4 h-4 rotate-180" />
                        <span className="text-sm">Restore</span>
                      </div>
                    </button>

                    <button
                      onClick={() => handlePermanentDelete(file)}
                      className="px-4 py-2.5 bg-red-600 text-white hover:bg-red-700 rounded-lg font-medium transition-colors"
                    >
                      <div className="flex items-center justify-center space-x-2">
                        <X className="w-4 h-4" />
                        <span className="text-sm">Delete</span>
                      </div>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold">Upload File</h3>
              <button onClick={() => setShowUploadModal(false)}>
                <X className="w-5 h-5" />
              </button>
            </div>
            <input
              type="file"
              onChange={handleFileUpload}
              disabled={uploading}
              accept=".pdf,.ppt,.pptx,.jpg,.jpeg,.png,.gif,.mp4,.mov"
              className="w-full"
            />
            <p className="text-sm text-gray-500 mt-2">
              Max size: 20MB. Allowed: PDF, PPT, Images, Videos
            </p>
          </div>
        </div>
      )}

      {/* New Folder Modal */}
      {showNewFolderModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold">Create New Folder</h3>
              <button onClick={() => setShowNewFolderModal(false)}>
                <X className="w-5 h-5" />
              </button>
            </div>
            <input
              type="text"
              placeholder="Folder name"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 mb-4"
            />
            <div className="flex space-x-3">
              <button
                onClick={handleCreateFolder}
                disabled={!newFolderName.trim()}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                Create
              </button>
              <button
                onClick={() => setShowNewFolderModal(false)}
                className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit File Modal */}
      {showEditModal && editingFile && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold">Edit File</h3>
              <button onClick={() => setShowEditModal(false)}>
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  File Name
                </label>
                <div className="flex items-center space-x-2">
                  <input
                    type="text"
                    placeholder="File name"
                    value={editFileName}
                    onChange={(e) => setEditFileName(e.target.value)}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="text-gray-500 font-medium">
                    {editingFile.name.substring(editingFile.name.lastIndexOf('.'))}
                  </span>
                </div>
                <p className="text-xs text-gray-500 mt-1">Extension will be kept automatically</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description (optional, 1-2 lines)
                </label>
                <textarea
                  placeholder="Brief description of the file..."
                  value={editFileDescription}
                  onChange={(e) => setEditFileDescription(e.target.value)}
                  rows={2}
                  maxLength={200}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 resize-none"
                />
                <p className="text-xs text-gray-500 mt-1">{editFileDescription.length}/200 characters</p>
              </div>
            </div>
            <div className="flex space-x-3 mt-6">
              <button
                onClick={handleSaveFileEdit}
                disabled={!editFileName.trim()}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                Save Changes
              </button>
              <button
                onClick={() => setShowEditModal(false)}
                className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SalesResources;
