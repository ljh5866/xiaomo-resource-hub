"use server";

import { revalidatePath } from "next/cache";
import { deleteResource, setStatus } from "./actions";

export async function setStatusForm(formData: FormData) {
  const id = Number(formData.get("id"));
  const status = String(formData.get("status") ?? "");
  if (!Number.isFinite(id) || !status) return;
  await setStatus(id, status);
  revalidatePath("/admin/resources");
}

export async function deleteResourceForm(formData: FormData) {
  const id = Number(formData.get("id"));
  if (!Number.isFinite(id)) return;
  await deleteResource(id);
  revalidatePath("/admin/resources");
}

export async function handleReportForm(formData: FormData) {
  const id = Number(formData.get("id"));
  const status = String(formData.get("status") ?? "");
  if (!Number.isFinite(id) || !status) return;
  const { handleReport } = await import("./actions");
  await handleReport(id, status);
  revalidatePath("/admin/reports");
}

export async function acceptSubmissionForm(formData: FormData) {
  const id = Number(formData.get("id"));
  if (!Number.isFinite(id)) return;
  const { acceptSubmission } = await import("./actions");
  await acceptSubmission(id);
  revalidatePath("/admin/submissions");
}

export async function rejectSubmissionForm(formData: FormData) {
  const id = Number(formData.get("id"));
  if (!Number.isFinite(id)) return;
  const { rejectSubmission } = await import("./actions");
  await rejectSubmission(id);
  revalidatePath("/admin/submissions");
}
