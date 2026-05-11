# Submission Readiness Checklist

Use this checklist as final QA before submitting and presenting your project.

Legend:
- [x] Done
- [ ] Not done yet
- [~] Need verification / evidence

---

## 1) Repository Management

- [x] Separate frontend and backend repositories exist.
- [x] Folder structure is clean and modular.
- [x] Commit messages are descriptive and specific.
- [~] No accidental secrets committed (`.env`, API keys, tokens).
- [~] Main branch is up to date and push is successful.

---

## 2) Documentation (FE + BE)

### Core docs
- [~] Project description is clear (problem, users, goals).
- [~] Feature list is complete and grouped by role.
- [~] Tech stack list is complete (FE, BE, DB, deployment tools).
- [~] Installation and usage instructions are complete and reproducible.

### Delivery docs
- [~] Frontend deployment link included and accessible.
- [~] Backend deployment link included and accessible.
- [~] API endpoint list (request/response examples) is included.
- [~] ERD link/image is included and readable.
- [~] Screenshots/GIF/demo assets are included.

### Quality docs
- [~] Error handling behavior is documented (examples of bad request/unauthorized).
- [~] Testing section is documented (how to run tests + current results).

---

## 3) Frontend Application (Mandatory)

- [~] Built with modern JS framework (React/Next/Vue/etc).
- [~] Responsive UI for all main pages.
- [~] At least 2 distinct roles implemented in UI (e.g., Admin vs Patient/Physio).
- [~] Proper loading and error states for async actions.
- [~] Form validation implemented.
- [~] CRUD views integrated with backend API (not mock data).
- [~] Frontend deployed and usable from public link.

---

## 4) Backend Development (Mandatory)

- [x] Built with web framework and modular routing (NestJS).
- [x] Follows RESTful API conventions.
- [x] Full CRUD on at least 3 main entities.
- [x] Proper validation and status code handling.
- [x] ORM-based DB connection (Prisma).
- [~] Backend deployed and reachable from public link.

---

## 5) Database Connection (Mandatory)

- [x] Uses relational DB (PostgreSQL).
- [x] At least 3 entities with valid relationships.
- [x] ERD exists (tables, relationships, keys/constraints).
- [x] Seed/sample data is meaningful (not placeholder only).

---

## 6) Authentication & Authorization (Mandatory)

- [x] Sign-up and login flow works.
- [x] Role-based authorization middleware/guards implemented.
- [x] Protected backend routes enforced by auth.
- [x] Public routes explicitly marked.
- [~] Unauthorized/forbidden responses are user-friendly and consistent.

---

## 7) Core Feature Implementation (Mandatory)

- [x] At least one full flow per user role includes data create/read/update/delete.
- [x] User interaction flow implemented (consultation -> booking -> status updates).
- [x] Tracking/status flow exists (booking + consultation + transaction statuses).
- [x] Update/cancel action supported where relevant.
- [x] Browse/search/filter exists (e.g., physiotherapists/categories/slots).
- [x] Dashboard/analytics exists for admin.

---

## 8) Presentation Readiness

- [~] Project overview is clear and structured.
- [~] Demo script for key features is prepared.
- [~] Demo includes at least 2 roles and role-based access differences.
- [~] Explanation includes why technical decisions were chosen.
- [~] Explanation ties implementation to user needs and project goals.
- [~] Backup plan prepared if deployment/network fails (local demo fallback).

---

## 9) Backend Testing Readiness

- [x] Unit tests exist for major BE modules.
- [x] Controller delegation tests exist for key modules.
- [x] E2E-lite smoke tests exist for selected protected/public endpoints.
- [x] Real integration tests (no service mocks) exist and cover positive + negative RBAC/ownership flows.
- [x] `npm test` passes.
- [x] `npm run build` passes.
- [x] `npm run test:integration` passes (latest local run: 22 tests, 1 suite).
- [~] Coverage metrics are measurable and can be shown (if assessor requests percentage) via Jest coverage run.

---

## 10) Optional Features (Score Booster, after mandatory stable)

- [x] Chat/messaging system (REST-based).
- [x] Notification system implemented.
- [ ] Real-time notifications (WebSocket).
- [ ] OAuth login (Google/GitHub/etc).
- [ ] File upload feature.
- [ ] Export (CSV/PDF).
- [ ] Dark mode / multi-language (mostly FE scope).

---

## Final Go / No-Go Gate (Before Submission)

- [~] All mandatory backend rubric points are either Done or have proof.
- [~] FE link and BE link are both healthy and tested on another network/device.
- [~] README / docs include all required links and artifacts.
- [x] Backend demo flow tested end-to-end once without debugging pauses (integration test suite).
- [~] Submission package reviewed once by checklist owner and once by peer (if possible).

If any item in this section is unchecked, postpone submission and fix first.
