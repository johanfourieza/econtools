-- Rename pubzub_yaml_detected column to kabbo_yaml_detected
ALTER TABLE activity_log RENAME COLUMN pubzub_yaml_detected TO kabbo_yaml_detected;
