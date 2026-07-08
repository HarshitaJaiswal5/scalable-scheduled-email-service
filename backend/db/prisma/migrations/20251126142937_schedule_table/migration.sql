-- CreateTable
CREATE TABLE "schedule" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "reminderTime" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "schedule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "schedule_email_key" ON "schedule"("email");
