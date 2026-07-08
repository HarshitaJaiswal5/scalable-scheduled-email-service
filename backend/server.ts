import express from "express";
import type { Request, Response } from "express";
import morgan from "morgan";
import dotenv from "dotenv";
dotenv.config();
import { prisma } from "./db/prisma.js";
import { scheduleReminderLambda } from "./services/scheduler.js";

interface CreateScheduleBody {
  email?: string;
  reminderTime?: string;
}

const app = express();

app.use(morgan("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get("/", (req: Request, res: Response) => {
  return res.status(200).send("Hello world");
});

app.post(
  "/api/create-schedule",
  async (
    req: Request<Record<string, never>, any, CreateScheduleBody>,
    res: Response
  ) => {
    try {
      const { email, reminderTime } = req.body ?? {};

      if (!email || !reminderTime) {
        return res.status(400).json({
          message: "email and reminderTime are required",
        });
      }

      const reminderDate = new Date(reminderTime);
      if (isNaN(reminderDate.getTime())) {
        return res.status(400).json({
          message: "reminderTime must be a valid date",
        });
      }

      const reminderUtcISO = reminderDate.toISOString();

      const reminder = await prisma.schedule.create({
        data: {
          email,
          reminderTime: reminderUtcISO,
        },
      });

      await scheduleReminderLambda(reminder);

      return res.status(201).json({
        message: "Reminder created",
        reminder,
      });

    } catch (err) {
      console.error("Error creating reminder:", err);
      return res.status(500).json({
        message: "Internal server error",
      });
    }
  }
);

const PORT = Number(process.env.PORT) || 8080;

async function startServer() {
  try {
    console.log(process.env.DATABASE_URL||"NO")
    await prisma.$connect();
    console.log("Database connected");

    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });

  } catch (err) {
    console.error("DB connection failed:", err);
    process.exit(1);
  }
}

startServer();
