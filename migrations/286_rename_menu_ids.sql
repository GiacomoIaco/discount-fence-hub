-- Rename messaging menu IDs for consistent naming
-- message-center → contact-center (admin SMS tool)
-- direct-messages → inbox (personal unified inbox)

UPDATE menu_visibility SET menu_id = 'contact-center' WHERE menu_id = 'message-center';
UPDATE menu_visibility SET menu_id = 'inbox' WHERE menu_id = 'direct-messages';
