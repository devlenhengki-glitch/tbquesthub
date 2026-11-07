CREATE TABLE `academic_editor_sessions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tokenHash` varchar(64) NOT NULL,
	`expiresAt` timestamp NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `academic_editor_sessions_id` PRIMARY KEY(`id`),
	CONSTRAINT `academic_editor_sessions_tokenHash_unique` UNIQUE(`tokenHash`)
);
