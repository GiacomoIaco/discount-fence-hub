# Testing Refactored PhotoGallery Component

## Overview
The PhotoGallery component has been refactored from a 2,696-line monolith into a clean, feature-based architecture with:
- **8 custom hooks** (1,106 lines)
- **7 UI components** (1,101 lines)
- **1 orchestrator** (489 lines) - 82% reduction!

## Testing Strategy

### Phase 1: Manual Integration Testing (Recommended First)

#### Step 1: Integrate Refactored Component

1. **Temporarily replace the old component** in App.tsx
2. **Test in development mode**
3. **Verify all functionality works**
4. **Check for any console errors**

#### Step 2: Manual Testing Checklist

##### For All Users (Sales Role):
- [ ] **Gallery Tab**
  - [ ] View published photos grid
  - [ ] Open photo in full-screen lightbox
  - [ ] Navigate photos with arrows (desktop) or swipe (mobile)
  - [ ] Toggle favorite on photo
  - [ ] Toggle like on photo
  - [ ] Toggle client selection flag
  - [ ] See photo tags at bottom
  - [ ] Close lightbox

- [ ] **Filters**
  - [ ] Open filter sidebar
  - [ ] Filter by product type
  - [ ] Filter by material
  - [ ] Filter by style
  - [ ] Filter by favorites
  - [ ] Filter by liked
  - [ ] See filter count badge
  - [ ] Clear all filters
  - [ ] Close filter sidebar

- [ ] **Photo Upload**
  - [ ] Click + FAB button
  - [ ] Open upload modal
  - [ ] Choose "Take Photo"
  - [ ] Choose "Choose from Library"
  - [ ] Select multiple photos
  - [ ] See AI analysis in progress
  - [ ] Photos saved to pending tab
  - [ ] Thumbnails optimized (check network tab)

##### For Managers/Admins Only:
- [ ] **Pending Review Tab**
  - [ ] See all pending photos
  - [ ] See AI confidence badges
  - [ ] Click photo to open review modal
  - [ ] See AI-suggested tags
  - [ ] See quality score
  - [ ] Add/remove tags
  - [ ] Adjust quality slider
  - [ ] Add review notes
  - [ ] Click "Auto-Enhance"
  - [ ] Toggle Original/Enhanced view
  - [ ] Publish photo (moves to Gallery)
  - [ ] Save as draft (keeps in Pending)
  - [ ] Save for later (moves to Saved)
  - [ ] Archive photo (moves to Archived)

- [ ] **Saved Tab**
  - [ ] View saved photos
  - [ ] Click photo to review
  - [ ] Update tags/notes
  - [ ] Publish from saved
  - [ ] Archive from saved

- [ ] **Archived Tab**
  - [ ] View archived photos
  - [ ] Permanent delete (admin only)
  - [ ] See "admin only" message (managers)

- [ ] **Flagged Tab**
  - [ ] View flagged photos
  - [ ] See flag count badges
  - [ ] Click to view flag details

- [ ] **Bulk Edit Mode**
  - [ ] Click "Select" button
  - [ ] Select individual photos
  - [ ] Select All
  - [ ] Select AI Recommended (pending tab)
  - [ ] Deselect All
  - [ ] Move to Published
  - [ ] Move to Saved
  - [ ] Move to Archived
  - [ ] Bulk Enhance (admin, TODO)
  - [ ] Bulk Delete (admin)
  - [ ] Cancel edit mode

- [ ] **Tag Management (Admin Only)**
  - [ ] Open "Manage Tags" modal
  - [ ] See built-in tags (read-only)
  - [ ] Add custom product type
  - [ ] Add custom material
  - [ ] Add custom style
  - [ ] Delete custom tag
  - [ ] See tag counts
  - [ ] Close modal

- [ ] **Analytics**
  - [ ] Click "Analytics" button
  - [ ] View photo analytics dashboard
  - [ ] Navigate back to gallery

##### Desktop-Specific Features:
- [ ] Tabs visible in header
- [ ] Sidebar navigation works
- [ ] Desktop layout (3-4 column grid)
- [ ] Arrow navigation in lightbox
- [ ] Bulk edit toolbar positioning

##### Mobile-Specific Features:
- [ ] Mobile layout (2 column grid)
- [ ] Swipe navigation in lightbox
- [ ] Touch-friendly buttons
- [ ] FAB buttons at bottom
- [ ] Upload modal from bottom

### Phase 2: Automated Testing (Optional)

#### Hook Unit Tests

Create test files for each hook:

```typescript
// Example: usePhotoFilters.test.ts
import { renderHook, act } from '@testing-library/react-hooks';
import { usePhotoFilters } from '../hooks/usePhotoFilters';

describe('usePhotoFilters', () => {
  const mockPhotos = [
    { id: '1', tags: ['Chain Link'], isFavorite: true, likes: 5 },
    { id: '2', tags: ['Wood'], isFavorite: false, likes: 0 },
  ];

  it('should initialize with empty filters', () => {
    const { result } = renderHook(() => usePhotoFilters(mockPhotos));
    expect(result.current.filteredPhotos.length).toBe(2);
    expect(result.current.activeFilterCount).toBe(0);
  });

  it('should filter by favorites', () => {
    const { result } = renderHook(() => usePhotoFilters(mockPhotos));
    act(() => {
      result.current.toggleFilter('showFavorites', true);
    });
    expect(result.current.filteredPhotos.length).toBe(1);
    expect(result.current.activeFilterCount).toBe(1);
  });
});
```

#### Component Integration Tests

```typescript
// Example: PhotoGrid.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { PhotoGrid } from '../components/PhotoGrid';

describe('PhotoGrid', () => {
  const mockPhotos = [
    { id: '1', url: 'test1.jpg', thumbnailUrl: 'thumb1.jpg', /* ... */ },
  ];

  it('should render photo grid', () => {
    render(<PhotoGrid photos={mockPhotos} /* ... */ />);
    expect(screen.getByAltText('Gallery')).toBeInTheDocument();
  });

  it('should call onPhotoClick when photo is clicked', () => {
    const onPhotoClick = jest.fn();
    render(<PhotoGrid photos={mockPhotos} onPhotoClick={onPhotoClick} /* ... */ />);
    fireEvent.click(screen.getByRole('img'));
    expect(onPhotoClick).toHaveBeenCalledWith(mockPhotos[0], 0);
  });
});
```

### Phase 3: Performance Testing

#### Metrics to Check:
- [ ] **Initial load time** - Should be faster with lazy loading
- [ ] **Memory usage** - Check for memory leaks
- [ ] **Network requests** - Verify image optimization working
- [ ] **Render performance** - No jank when scrolling grid

#### Tools:
- Chrome DevTools Performance tab
- React DevTools Profiler
- Network tab (check thumbnail sizes ~20KB vs 4MB)

### Phase 4: Browser/Device Testing

#### Browsers:
- [ ] Chrome/Edge (Desktop)
- [ ] Firefox (Desktop)
- [ ] Safari (Desktop)
- [ ] Chrome (Mobile)
- [ ] Safari (iOS)

#### Screen Sizes:
- [ ] 320px (Small mobile)
- [ ] 768px (Tablet)
- [ ] 1024px (Desktop)
- [ ] 1920px (Large desktop)

### Phase 5: Error Scenarios

- [ ] **No photos** - Shows empty state
- [ ] **Network failure** - Falls back to localStorage
- [ ] **Upload failure** - Shows error toast
- [ ] **Supabase offline** - Graceful degradation
- [ ] **AI analysis failure** - Photo still uploads without tags

## Known TODOs

The refactored component has these intentional TODOs:
1. **Photo flags functionality** - Not yet implemented
2. **Bulk AI enhance** - Not yet implemented
3. **Select AI Recommended** - Not yet implemented

These can be added incrementally without refactoring the entire component again.

## Rollback Plan

If issues are found:
1. Keep refactored code in `src/features/photos/`
2. Revert App.tsx to use old PhotoGalleryWithBulkUpload
3. Fix issues in refactored version
4. Re-test and re-integrate

## Success Criteria

✅ **Pass Criteria:**
- All manual checklist items pass
- No console errors
- Photos load and display correctly
- All user actions work as expected
- Mobile and desktop layouts work
- Performance is equal or better than old version

## Next Steps After Testing

Once testing passes:
1. Remove old PhotoGallery.tsx
2. Update all imports to use PhotoGalleryRefactored
3. Rename PhotoGalleryRefactored.tsx to PhotoGallery.tsx
4. Apply same refactoring pattern to RequestDetail (1,299 lines)
