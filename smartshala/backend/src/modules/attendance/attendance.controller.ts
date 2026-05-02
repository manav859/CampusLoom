import type { Request, Response } from "express";
import type { AttendanceStatus } from "@prisma/client";
import { asyncHandler } from "../../core/asyncHandler.js";
import * as attendanceService from "./attendance.service.js";

type MarkAttendanceBody = {
  classId: string;
  date: Date;
  notes?: string;
  records: {
    studentId: string;
    status: AttendanceStatus;
    remarks?: string;
  }[];
};

type ClassTodayParams = {
  classId: string;
};

type StudentMonthlyParams = {
  studentId: string;
};

type ClassMonthlyParams = {
  classId: string;
};

type ClassMonthlyQuery = {
  month: string;
};

type StudentMonthlyQuery = {
  month: string;
};

export const getRoster = asyncHandler(async (req: Request, res: Response) => {
  res.json(await attendanceService.getMarkingRoster(req.user!, req.query.classId as string, req.query.date ? new Date(req.query.date as string) : new Date()));
});

export const getClassTodayAttendance = asyncHandler<Request<ClassTodayParams>>(async (req, res) => {
  res.json(await attendanceService.getClassTodayAttendance(req.user!, req.params.classId));
});

export const getStudentMonthlyAttendance = asyncHandler<Request<StudentMonthlyParams, unknown, unknown, StudentMonthlyQuery>>(async (req, res) => {
  res.json(await attendanceService.getStudentMonthlyAttendance(req.user!, req.params.studentId, req.query.month));
});

export const getClassMonthlyAttendance = asyncHandler<Request<ClassMonthlyParams, unknown, unknown, ClassMonthlyQuery>>(async (req, res) => {
  res.json(await attendanceService.getClassMonthlyAttendance(req.user!, req.params.classId, req.query.month));
});

export const getAttendanceDashboard = asyncHandler(async (req: Request, res: Response) => {
  res.json(await attendanceService.getAttendanceDashboard(req.user!));
});

export const markAttendance = asyncHandler<Request<Record<string, never>, unknown, MarkAttendanceBody>>(async (req, res) => {
  const session = await attendanceService.markAttendance({
    classId: req.body.classId,
    date: req.body.date,
    notes: req.body.notes,
    records: req.body.records,
    user: req.user!
  });

  res.status(201).json(session);
});

export const dailyReport = asyncHandler(async (req: Request, res: Response) => {
  res.json(await attendanceService.dailyReport(req.user!, req.query.date ? new Date(req.query.date as string) : new Date()));
});

export const monthlyStudentReport = asyncHandler(async (req: Request, res: Response) => {
  res.json(await attendanceService.monthlyStudentReport(req.user!, req.params.studentId, req.query.month as string));
});
