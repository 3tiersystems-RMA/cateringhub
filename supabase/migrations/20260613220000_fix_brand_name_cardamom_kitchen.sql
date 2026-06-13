-- Fix brand name: update form_header_title from 'Cardamom Central Kitchen' to 'Cardamom Kitchen'
UPDATE correspondence_settings
SET form_header_title = 'Cardamom Kitchen'
WHERE form_header_title = 'Cardamom Central Kitchen';
