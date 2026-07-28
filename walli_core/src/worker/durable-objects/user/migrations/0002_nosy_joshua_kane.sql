CREATE VIRTUAL TABLE `messages_fts` USING fts5(
  `message_id` UNINDEXED,
  `session_id` UNINDEXED,
  `role` UNINDEXED,
  `content`,
  tokenize = 'trigram'
);
--> statement-breakpoint
INSERT INTO `messages_fts` (`message_id`, `session_id`, `role`, `content`)
SELECT
  `id`,
  `session_id`,
  'message',
  CASE
    WHEN json_valid(`content`) THEN coalesce(json_extract(`content`, '$.content'), `content`)
    ELSE `content`
  END
FROM `messages`
WHERE length(trim(
  CASE
    WHEN json_valid(`content`) THEN coalesce(json_extract(`content`, '$.content'), `content`)
    ELSE `content`
  END
)) > 0;
