-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('admin', 'recruiter');

-- CreateEnum
CREATE TYPE "CandidateStatus" AS ENUM ('new', 'contacted', 'interview', 'offer', 'hired', 'rejected');

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('open', 'done', 'cancelled');

-- CreateEnum
CREATE TYPE "TaskPriority" AS ENUM ('low', 'medium', 'high');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'recruiter',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vacancies" (
    "id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "department" TEXT,
    "city" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "vacancies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "candidates" (
    "id" UUID NOT NULL,
    "full_name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "city" TEXT,
    "source" TEXT NOT NULL DEFAULT 'other',
    "status" "CandidateStatus" NOT NULL DEFAULT 'new',
    "vacancy_id" UUID,
    "assigned_recruiter_id" UUID NOT NULL,
    "last_contact_at" TIMESTAMPTZ(6),
    "next_follow_up_at" TIMESTAMPTZ(6),
    "comment" TEXT,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "candidates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "candidate_status_history" (
    "id" UUID NOT NULL,
    "candidate_id" UUID NOT NULL,
    "from_status" "CandidateStatus",
    "to_status" "CandidateStatus" NOT NULL,
    "changed_by_user_id" UUID NOT NULL,
    "changed_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reason" TEXT,

    CONSTRAINT "candidate_status_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "candidate_notes" (
    "id" UUID NOT NULL,
    "candidate_id" UUID NOT NULL,
    "author_user_id" UUID NOT NULL,
    "note_text" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "candidate_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tasks" (
    "id" UUID NOT NULL,
    "candidate_id" UUID,
    "assignee_user_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "due_at" TIMESTAMPTZ(6) NOT NULL,
    "status" "TaskStatus" NOT NULL DEFAULT 'open',
    "priority" "TaskPriority" NOT NULL DEFAULT 'medium',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activity_log" (
    "id" UUID NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" UUID NOT NULL,
    "action" TEXT NOT NULL,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "actor_user_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activity_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "idx_candidates_status" ON "candidates"("status");

-- CreateIndex
CREATE INDEX "idx_candidates_recruiter" ON "candidates"("assigned_recruiter_id");

-- CreateIndex
CREATE INDEX "idx_candidates_followup" ON "candidates"("next_follow_up_at");

-- CreateIndex
CREATE INDEX "idx_candidates_created_at" ON "candidates"("created_at");

-- CreateIndex
CREATE INDEX "idx_candidates_active" ON "candidates"("is_deleted", "status");

-- CreateIndex
CREATE INDEX "idx_history_candidate_changed_at" ON "candidate_status_history"("candidate_id", "changed_at");

-- CreateIndex
CREATE INDEX "idx_notes_candidate_created_at" ON "candidate_notes"("candidate_id", "created_at");

-- CreateIndex
CREATE INDEX "idx_tasks_assignee_status_due" ON "tasks"("assignee_user_id", "status", "due_at");

-- CreateIndex
CREATE INDEX "idx_activity_entity" ON "activity_log"("entity_type", "entity_id", "created_at");

-- AddForeignKey
ALTER TABLE "candidates" ADD CONSTRAINT "candidates_vacancy_id_fkey" FOREIGN KEY ("vacancy_id") REFERENCES "vacancies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "candidates" ADD CONSTRAINT "candidates_assigned_recruiter_id_fkey" FOREIGN KEY ("assigned_recruiter_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "candidate_status_history" ADD CONSTRAINT "candidate_status_history_candidate_id_fkey" FOREIGN KEY ("candidate_id") REFERENCES "candidates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "candidate_status_history" ADD CONSTRAINT "candidate_status_history_changed_by_user_id_fkey" FOREIGN KEY ("changed_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "candidate_notes" ADD CONSTRAINT "candidate_notes_candidate_id_fkey" FOREIGN KEY ("candidate_id") REFERENCES "candidates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "candidate_notes" ADD CONSTRAINT "candidate_notes_author_user_id_fkey" FOREIGN KEY ("author_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_candidate_id_fkey" FOREIGN KEY ("candidate_id") REFERENCES "candidates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_assignee_user_id_fkey" FOREIGN KEY ("assignee_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_log" ADD CONSTRAINT "activity_log_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
