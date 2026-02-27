import { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import TodoLayout from './TodoLayout';
import TodoListView from './TodoListView';
import MyWorkView from './MyWorkView';
import { NewListModal, EditListModal, ManageListMembersModal } from './modals/TodoModals';
import { useEnsureDefaultList, useTodoListsQuery, useArchiveTodoList } from '../hooks/useMyTodos';

interface MyTodosProps {
  onBack: () => void;
}

export default function MyTodos({ onBack: _ }: MyTodosProps) {
  const [selectedListId, setSelectedListId] = useState<string | null>(null);
  const [showMyWork, setShowMyWork] = useState(true);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  // Modals
  const [showNewListModal, setShowNewListModal] = useState(false);
  const [editingList, setEditingList] = useState<{ id: string; title: string; description: string | null; visibility: string; color: string } | null>(null);
  const [managingMembersListId, setManagingMembersListId] = useState<string | null>(null);

  // Ensure default list exists on first load
  const ensureDefault = useEnsureDefaultList();
  const { data: lists, isLoading: listsLoading } = useTodoListsQuery();
  const archiveList = useArchiveTodoList();

  useEffect(() => {
    ensureDefault.mutate();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-select first list when lists load and no selection
  useEffect(() => {
    if (lists && lists.length > 0 && !selectedListId && !showMyWork) {
      setSelectedListId(lists[0].id);
    }
  }, [lists, selectedListId, showMyWork]);

  const handleSelectList = (listId: string) => {
    setSelectedListId(listId);
    setShowMyWork(false);
  };

  const handleMyWorkClick = () => {
    setShowMyWork(true);
    setSelectedListId(null);
  };

  const handleArchiveList = async () => {
    if (!selectedListId) return;
    const list = lists?.find(l => l.id === selectedListId);
    if (!list) return;
    if (!window.confirm(`Archive "${list.title}"? Tasks will be hidden but not deleted.`)) return;
    await archiveList.mutateAsync(selectedListId);
    setSelectedListId(null);
    setShowMyWork(true);
  };

  const handleEditList = () => {
    if (!selectedListId) return;
    const list = lists?.find(l => l.id === selectedListId);
    if (!list) return;
    setEditingList({
      id: list.id,
      title: list.title,
      description: list.description,
      visibility: list.visibility,
      color: list.color,
    });
  };

  // Content
  let content;
  if (listsLoading) {
    content = (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  } else if (showMyWork) {
    content = <MyWorkView />;
  } else if (selectedListId) {
    content = (
      <TodoListView
        listId={selectedListId}
        onEditList={handleEditList}
        onManageMembers={() => setManagingMembersListId(selectedListId)}
        onArchiveList={handleArchiveList}
      />
    );
  } else {
    content = (
      <div className="flex items-center justify-center py-16 text-gray-500">
        Select a list or view "My Work"
      </div>
    );
  }

  return (
    <>
      <TodoLayout
        selectedListId={selectedListId}
        showMyWork={showMyWork}
        onSelectList={handleSelectList}
        onMyWorkClick={handleMyWorkClick}
        onNewListClick={() => setShowNewListModal(true)}
        isMobileSidebarOpen={isMobileSidebarOpen}
        onToggleMobileSidebar={() => setIsMobileSidebarOpen(!isMobileSidebarOpen)}
      >
        {content}
      </TodoLayout>

      {/* Modals */}
      {showNewListModal && (
        <NewListModal
          onClose={() => setShowNewListModal(false)}
          onSuccess={(listId) => {
            setShowNewListModal(false);
            if (listId) handleSelectList(listId);
          }}
        />
      )}

      {editingList && (
        <EditListModal
          list={editingList}
          onClose={() => setEditingList(null)}
          onSuccess={() => setEditingList(null)}
        />
      )}

      {managingMembersListId && (
        <ManageListMembersModal
          listId={managingMembersListId}
          onClose={() => setManagingMembersListId(null)}
        />
      )}
    </>
  );
}
