import { Router, type Response } from "express";
import { asyncHandler } from "../../core/asyncHandler.js";
import { rateLimit } from "../../middleware/rateLimit.js";
import { validate } from "../../middleware/validate.js";
import {
  clearCrmCookie,
  crmActor,
  getCrmCookie,
  loginCrm,
  refreshCrmSession,
  requireCrmAdmin,
  requireCrmUser,
  setCrmCookie
} from "./crm.auth.js";
import { issueLoginDetails } from "./crm.conversion.js";
import { connectMeta, disconnectMeta, getMetaStatus, listMetaForms, setMetaForms, syncMetaLeads } from "./crm.meta.js";
import {
  crmLoginSchema,
  createLeadSchema,
  createTeamMemberSchema,
  invoiceIdParamSchema,
  leadIdParamSchema,
  leadListQuerySchema,
  linkIdParamSchema,
  metaConnectSchema,
  metaFormsSchema,
  noteSchema,
  paymentLinkSchema,
  paymentsQuerySchema,
  proformaIdParamSchema,
  proformaSchema,
  updateLeadSchema,
  updateTeamMemberSchema,
  userIdParamSchema
} from "./crm.schemas.js";
import {
  addNote,
  cancelProforma,
  createLead,
  createLeadPaymentLink,
  createTeamMember,
  getLead,
  issueProforma,
  listCrmPayments,
  listLeads,
  listSellablePlans,
  listTeam,
  recordLinkShared,
  renderLeadInvoicePdf,
  renderProformaPdf,
  retryOnboarding,
  revokeLeadPaymentLink,
  updateLead,
  updateTeamMember
} from "./crm.service.js";

/**
 * The sales CRM. Bearer-authenticated like the super admin portal, with its own
 * httpOnly cookie only for restoring the session after a page refresh.
 */
export const crmRouter = Router();

function sendPdf(res: Response, buffer: Buffer, filename: string) {
  res.set({
    "Content-Type": "application/pdf",
    "Content-Disposition": `attachment; filename="${filename}"`,
    "Content-Length": buffer.length.toString()
  });
  res.send(buffer);
}

crmRouter.post(
  "/login",
  rateLimit({ windowMs: 15 * 60 * 1000, max: 10, keyPrefix: "crm-login" }),
  validate({ body: crmLoginSchema }),
  asyncHandler(async (req, res) => {
    const result = await loginCrm(req.body.email, req.body.password, req.ip ?? "unknown");
    setCrmCookie(res, result.accessToken);
    res.json(result);
  })
);

crmRouter.get(
  "/session",
  asyncHandler(async (req, res) => {
    res.json(await refreshCrmSession(getCrmCookie(req)));
  })
);

crmRouter.post(
  "/logout",
  asyncHandler(async (_req, res) => {
    clearCrmCookie(res);
    res.status(204).send();
  })
);

crmRouter.use(requireCrmUser);

crmRouter.get("/me", (_req, res) => {
  res.json(crmActor(res));
});

crmRouter.get(
  "/plans",
  asyncHandler(async (_req, res) => {
    res.json(await listSellablePlans());
  })
);

// --- Team (admins) -------------------------------------------------------------

crmRouter.get(
  "/team",
  requireCrmAdmin,
  asyncHandler(async (_req, res) => {
    res.json(await listTeam());
  })
);

crmRouter.post(
  "/team",
  requireCrmAdmin,
  validate({ body: createTeamMemberSchema }),
  asyncHandler(async (req, res) => {
    res.status(201).json(await createTeamMember(req.body));
  })
);

crmRouter.patch(
  "/team/:userId",
  requireCrmAdmin,
  validate({ params: userIdParamSchema, body: updateTeamMemberSchema }),
  asyncHandler(async (req, res) => {
    res.json(await updateTeamMember(crmActor(res), req.params.userId, req.body));
  })
);

// --- Leads ---------------------------------------------------------------------

crmRouter.get(
  "/leads",
  validate({ query: leadListQuerySchema }),
  asyncHandler(async (req, res) => {
    res.json(await listLeads(crmActor(res), req.query));
  })
);

crmRouter.post(
  "/leads",
  validate({ body: createLeadSchema }),
  asyncHandler(async (req, res) => {
    res.status(201).json(await createLead(crmActor(res), req.body));
  })
);

crmRouter.get(
  "/leads/:leadId",
  validate({ params: leadIdParamSchema }),
  asyncHandler(async (req, res) => {
    res.json(await getLead(crmActor(res), req.params.leadId));
  })
);

crmRouter.patch(
  "/leads/:leadId",
  validate({ params: leadIdParamSchema, body: updateLeadSchema }),
  asyncHandler(async (req, res) => {
    res.json(await updateLead(crmActor(res), req.params.leadId, req.body));
  })
);

crmRouter.post(
  "/leads/:leadId/notes",
  validate({ params: leadIdParamSchema, body: noteSchema }),
  asyncHandler(async (req, res) => {
    res.status(201).json(await addNote(crmActor(res), req.params.leadId, req.body.text));
  })
);

crmRouter.post(
  "/leads/:leadId/proformas",
  validate({ params: leadIdParamSchema, body: proformaSchema }),
  asyncHandler(async (req, res) => {
    res.status(201).json(await issueProforma(crmActor(res), req.params.leadId, req.body));
  })
);

crmRouter.post(
  "/leads/:leadId/onboarding/retry",
  validate({ params: leadIdParamSchema }),
  asyncHandler(async (req, res) => {
    res.json(await retryOnboarding(crmActor(res), req.params.leadId));
  })
);

crmRouter.post(
  "/leads/:leadId/login-details",
  validate({ params: leadIdParamSchema }),
  asyncHandler(async (req, res) => {
    // Scope check first: issueLoginDetails trusts its caller with the lead.
    await getLead(crmActor(res), req.params.leadId);
    res.json(await issueLoginDetails(req.params.leadId, crmActor(res)));
  })
);

// --- Proformas & payment links ---------------------------------------------------

crmRouter.post(
  "/proformas/:proformaId/cancel",
  validate({ params: proformaIdParamSchema }),
  asyncHandler(async (req, res) => {
    await cancelProforma(crmActor(res), req.params.proformaId);
    res.status(204).send();
  })
);

crmRouter.get(
  "/proformas/:proformaId/pdf",
  validate({ params: proformaIdParamSchema }),
  asyncHandler(async (req, res) => {
    const { buffer, number } = await renderProformaPdf(crmActor(res), req.params.proformaId);
    sendPdf(res, buffer, `proforma-${number}.pdf`);
  })
);

crmRouter.post(
  "/proformas/:proformaId/payment-links",
  validate({ params: proformaIdParamSchema, body: paymentLinkSchema }),
  asyncHandler(async (req, res) => {
    res.status(201).json(await createLeadPaymentLink(crmActor(res), req.params.proformaId, req.body));
  })
);

crmRouter.post(
  "/payment-links/:linkId/revoke",
  validate({ params: linkIdParamSchema }),
  asyncHandler(async (req, res) => {
    await revokeLeadPaymentLink(crmActor(res), req.params.linkId);
    res.status(204).send();
  })
);

crmRouter.post(
  "/payment-links/:linkId/shared",
  validate({ params: linkIdParamSchema }),
  asyncHandler(async (req, res) => {
    await recordLinkShared(crmActor(res), req.params.linkId);
    res.status(204).send();
  })
);

// --- Payments ------------------------------------------------------------------

crmRouter.get(
  "/payments",
  validate({ query: paymentsQuerySchema }),
  asyncHandler(async (req, res) => {
    const query = req.query as unknown as { from: Date; to: Date; q?: string };
    res.json(await listCrmPayments(crmActor(res), query));
  })
);

crmRouter.get(
  "/invoices/:invoiceId/pdf",
  validate({ params: invoiceIdParamSchema }),
  asyncHandler(async (req, res) => {
    const { buffer, number } = await renderLeadInvoicePdf(crmActor(res), req.params.invoiceId);
    sendPdf(res, buffer, `invoice-${number}.pdf`);
  })
);

// --- Meta lead ads (admins) ----------------------------------------------------------

crmRouter.get(
  "/integrations/meta",
  requireCrmAdmin,
  asyncHandler(async (_req, res) => {
    res.json(await getMetaStatus());
  })
);

crmRouter.put(
  "/integrations/meta",
  requireCrmAdmin,
  validate({ body: metaConnectSchema }),
  asyncHandler(async (req, res) => {
    res.json(await connectMeta(crmActor(res), req.body));
  })
);

crmRouter.delete(
  "/integrations/meta",
  requireCrmAdmin,
  asyncHandler(async (_req, res) => {
    await disconnectMeta();
    res.status(204).send();
  })
);

crmRouter.get(
  "/integrations/meta/forms",
  requireCrmAdmin,
  asyncHandler(async (_req, res) => {
    res.json(await listMetaForms());
  })
);

crmRouter.put(
  "/integrations/meta/forms",
  requireCrmAdmin,
  validate({ body: metaFormsSchema }),
  asyncHandler(async (req, res) => {
    res.json(await setMetaForms(req.body.formIds));
  })
);

crmRouter.post(
  "/integrations/meta/sync",
  requireCrmAdmin,
  asyncHandler(async (_req, res) => {
    res.json(await syncMetaLeads());
  })
);
