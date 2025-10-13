# [Feature Name]

## Overview
Brief description of what this feature does and why it exists.

## Architecture

### External Dependencies
List what this feature depends on from outside its folder:
- **Authentication**: [specific imports]
- **Database**: [specific imports]
- **Other Features**: [if any]

### Database Schema
- **Migration**: `migrations/XXX_feature_name.sql`
- **Tables**: List tables
- **Views/Functions**: List any

### Entry Point
- **Main Component**: `FeatureName.tsx`
- **Route**: `/feature-route`
- **Access**: [roles/permissions]

## File Structure

```
feature_name/
├── README.md                 # This file
├── FEATURE_MANIFEST.json     # Machine-readable metadata
├── index.ts                  # Public API
├── FeatureName.tsx          # Main component
├── types.ts                  # Application types
├── database.types.ts         # Database types (if needed)
├── components/               # UI components
├── hooks/                    # Custom hooks
├── services/                 # Business logic
├── utils/                    # Utilities
├── database/                 # Migrations (if feature has DB)
└── __tests__/               # Tests

```

## Key Concepts
Explain the main concepts and business logic unique to this feature.

## Development

### Getting Started
Steps to work on this feature locally.

### Adding New Functionality
Common tasks and where to make changes.

### Testing
How to test this feature.

## Future Enhancements
- [ ] Planned feature 1
- [ ] Planned feature 2

## Notes
Any important notes, gotchas, or context.
