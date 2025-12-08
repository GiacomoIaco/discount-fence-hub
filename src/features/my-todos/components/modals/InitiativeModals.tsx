import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Lock, Globe, Loader2, Building2, MoreVertical, Pencil, Archive } from 'lucide-react';
import { useCreatePersonalInitiative, useUpdatePersonalInitiative } from '../../hooks/useMyTodos';
import { useFunctionsQuery, useAreasQuery, useCreateInitiative } from '../../../leadership/hooks/useLeadershipQuery';
import { headerColorOptions } from '../../utils/todoHelpers';

type InitiativeType = 'personal' | 'organizational';

interface NewInitiativeModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

// New initiative modal - supports both personal and organizational initiatives
export function NewInitiativeModal({ onClose, onSuccess }: NewInitiativeModalProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [headerColor, setHeaderColor] = useState('blue-900');
  const [initiativeType, setInitiativeType] = useState<InitiativeType>('personal');
  const [selectedFunctionId, setSelectedFunctionId] = useState<string>('');
  const [selectedAreaId, setSelectedAreaId] = useState<string>('');

  const createPersonalInitiative = useCreatePersonalInitiative();
  const createOrgInitiative = useCreateInitiative();
  const { data: functions = [], isLoading: functionsLoading } = useFunctionsQuery();
  const { data: areas = [], isLoading: areasLoading } = useAreasQuery(selectedFunctionId || undefined);

  const inputRef = useRef<HTMLInputElement>(null);

  const isCreating = createPersonalInitiative.isPending || createOrgInitiative.isPending;

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Reset area when function changes
  useEffect(() => {
    setSelectedAreaId('');
  }, [selectedFunctionId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    try {
      if (initiativeType === 'personal') {
        await createPersonalInitiative.mutateAsync({
          title: title.trim(),
          description: description.trim() || undefined,
          is_private: true, // Personal initiatives are always private
          header_color: headerColor,
        });
      } else {
        // Organizational initiative - requires area_id
        if (!selectedAreaId) {
          alert('Please select an area');
          return;
        }
        await createOrgInitiative.mutateAsync({
          area_id: selectedAreaId,
          title: title.trim(),
          description: description.trim() || undefined,
        });
      }
      onSuccess();
      onClose();
    } catch (err) {
      console.error('Failed to create initiative:', err);
      alert('Failed to create initiative');
    }
  };

  const selectedFunction = functions.find(f => f.id === selectedFunctionId);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4" onClick={(e) => e.stopPropagation()}>
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">New Initiative</h2>
          <p className="text-sm text-gray-500 mt-1">Create a personal or organizational initiative</p>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Initiative Type Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Initiative Type</label>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setInitiativeType('personal')}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 transition-all ${
                  initiativeType === 'personal'
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-gray-200 hover:border-gray-300 text-gray-600'
                }`}
              >
                <Lock className="w-4 h-4" />
                <span className="font-medium">Personal</span>
              </button>
              <button
                type="button"
                onClick={() => setInitiativeType('organizational')}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 transition-all ${
                  initiativeType === 'organizational'
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-gray-200 hover:border-gray-300 text-gray-600'
                }`}
              >
                <Globe className="w-4 h-4" />
                <span className="font-medium">Organizational</span>
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              {initiativeType === 'personal'
                ? 'Personal initiatives are private and only visible to you'
                : 'Organizational initiatives are linked to a Function > Area and visible to team members'}
            </p>
          </div>

          {/* Function & Area Selection (only for organizational) */}
          {initiativeType === 'organizational' && (
            <div className="space-y-3 p-4 bg-gray-50 rounded-lg border border-gray-200">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Function</label>
                {functionsLoading ? (
                  <div className="flex items-center gap-2 text-gray-500 text-sm py-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Loading functions...
                  </div>
                ) : functions.length === 0 ? (
                  <p className="text-sm text-gray-500 py-2">No functions available. You need access to at least one function.</p>
                ) : (
                  <select
                    value={selectedFunctionId}
                    onChange={(e) => setSelectedFunctionId(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                  >
                    <option value="">Select a function...</option>
                    {functions.map((func) => (
                      <option key={func.id} value={func.id}>
                        {func.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {selectedFunctionId && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Area</label>
                  {areasLoading ? (
                    <div className="flex items-center gap-2 text-gray-500 text-sm py-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Loading areas...
                    </div>
                  ) : areas.length === 0 ? (
                    <p className="text-sm text-gray-500 py-2">
                      No areas in this function. Create areas in the Leadership Hub first.
                    </p>
                  ) : (
                    <select
                      value={selectedAreaId}
                      onChange={(e) => setSelectedAreaId(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                    >
                      <option value="">Select an area...</option>
                      {areas.map((area) => (
                        <option key={area.id} value={area.id}>
                          {area.name}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              )}

              {selectedAreaId && selectedFunction && (
                <div className="flex items-center gap-2 text-sm text-blue-600 bg-blue-50 px-3 py-2 rounded-lg">
                  <Building2 className="w-4 h-4" />
                  <span>
                    {selectedFunction.name} / {areas.find(a => a.id === selectedAreaId)?.name}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
            <input
              ref={inputRef}
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={initiativeType === 'personal' ? 'e.g., Q4 Personal Goals' : 'e.g., Improve Customer Onboarding'}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              required
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description (optional)</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description..."
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
            />
          </div>

          {/* Header Color (only for personal initiatives) */}
          {initiativeType === 'personal' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Header Color</label>
              <div className="flex flex-wrap gap-2">
                {headerColorOptions.map((color) => (
                  <button
                    key={color.value}
                    type="button"
                    onClick={() => setHeaderColor(color.value)}
                    className={`w-8 h-8 rounded-lg ${color.bg} ${
                      headerColor === color.value ? 'ring-2 ring-offset-2 ring-blue-500' : ''
                    }`}
                    title={color.label}
                  />
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={
                isCreating ||
                !title.trim() ||
                (initiativeType === 'organizational' && !selectedAreaId)
              }
              className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
            >
              {isCreating && <Loader2 className="w-4 h-4 animate-spin" />}
              Create Initiative
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

interface InitiativeSettingsMenuProps {
  initiativeId: string;
  initiativeTitle: string;
  isPrivate: boolean;
  headerColor: string | null;
  onEdit: () => void;
  onArchive: () => void;
}

// Initiative settings menu (edit, color, archive) - using portal for proper positioning
export function InitiativeSettingsMenu({
  onEdit,
  onArchive,
}: InitiativeSettingsMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        buttonRef.current && !buttonRef.current.contains(e.target as Node) &&
        menuRef.current && !menuRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const toggleMenu = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setPosition({
        top: rect.bottom + 4,
        left: rect.right - 160, // Align right edge
      });
    }
    setIsOpen(!isOpen);
  };

  return (
    <>
      <button
        ref={buttonRef}
        onClick={toggleMenu}
        className="p-1 text-white/70 hover:text-white hover:bg-white/10 rounded transition-colors"
        title="Initiative settings"
      >
        <MoreVertical className="w-4 h-4" />
      </button>
      {isOpen && createPortal(
        <div
          ref={menuRef}
          className="fixed z-[9999] w-40 bg-white border border-gray-200 rounded-lg shadow-lg py-1"
          style={{ top: position.top, left: position.left }}
        >
          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsOpen(false);
              onEdit();
            }}
            className="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
          >
            <Pencil className="w-4 h-4" />
            Edit Initiative
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsOpen(false);
              onArchive();
            }}
            className="w-full px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
          >
            <Archive className="w-4 h-4" />
            Archive
          </button>
        </div>,
        document.body
      )}
    </>
  );
}

interface EditInitiativeModalProps {
  initiative: { id: string; title: string; isPrivate: boolean; headerColor: string | null };
  onClose: () => void;
  onSuccess: () => void;
}

// Edit initiative modal
export function EditInitiativeModal({ initiative, onClose, onSuccess }: EditInitiativeModalProps) {
  const [title, setTitle] = useState(initiative.title);
  const [isPrivate, setIsPrivate] = useState(initiative.isPrivate);
  const [headerColor, setHeaderColor] = useState(initiative.headerColor || 'blue-900');
  const updateInitiative = useUpdatePersonalInitiative();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    try {
      await updateInitiative.mutateAsync({
        id: initiative.id,
        title: title.trim(),
        is_private: isPrivate,
        header_color: headerColor,
      });
      onSuccess();
      onClose();
    } catch (err) {
      console.error('Failed to update initiative:', err);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4" onClick={(e) => e.stopPropagation()}>
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Edit Initiative</h2>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
            <input
              ref={inputRef}
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              required
            />
          </div>

          {/* Header Color */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Header Color</label>
            <div className="flex flex-wrap gap-2">
              {headerColorOptions.map((color) => (
                <button
                  key={color.value}
                  type="button"
                  onClick={() => setHeaderColor(color.value)}
                  className={`w-8 h-8 rounded-lg ${color.bg} ${
                    headerColor === color.value ? 'ring-2 ring-offset-2 ring-blue-500' : ''
                  }`}
                  title={color.label}
                />
              ))}
            </div>
          </div>

          {/* Private Toggle */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setIsPrivate(!isPrivate)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                isPrivate ? 'bg-blue-600' : 'bg-gray-200'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  isPrivate ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
            <div className="flex items-center gap-2">
              <Lock className={`w-4 h-4 ${isPrivate ? 'text-blue-600' : 'text-gray-400'}`} />
              <span className="text-sm text-gray-700">Private initiative</span>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={updateInitiative.isPending || !title.trim()}
              className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
            >
              {updateInitiative.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
