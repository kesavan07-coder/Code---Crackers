# 🖥️ Code Crackers — Technical Quiz Portal

<div align="center">

![Code Crackers](https://img.shields.io/badge/Code%20Crackers-Technical%20Quiz%20Portal-black?style=for-the-badge&logo=code&logoColor=white)
![Next.js](https://img.shields.io/badge/Next.js-15-black?style=for-the-badge&logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=for-the-badge&logo=typescript)
![Node.js](https://img.shields.io/badge/Node.js-Express-339933?style=for-the-badge&logo=node.js)
![Vercel](https://img.shields.io/badge/Deployed-Vercel-black?style=for-the-badge&logo=vercel)

**A fully dynamic, multi-round technical quiz competition platform built for NEXUS'26 Symposium**

[🌐 Live Demo](https://code-crackers-six.vercel.app) · [📁 Repository](https://github.com/kesavan07-coder/Code---Crackers) · [🐛 Report Bug](https://github.com/kesavan07-coder/Code---Crackers/issues)

</div>

---

## 📋 Table of Contents

- [Overview](#-overview)
- [Features](#-features)
- [Tech Stack](#-tech-stack)
- [Project Structure](#-project-structure)
- [Getting Started](#-getting-started)
- [Environment Variables](#-environment-variables)
- [Role-Based Access](#-role-based-access)
- [Portal Workflow](#-portal-workflow)
- [API Reference](#-api-reference)
- [Deployment](#-deployment)
- [Screenshots](#-screenshots)

---

## 🎯 Overview

**Code Crackers** is a fully dynamic, multi-round online technical quiz competition portal developed for the **Department of Computer Science & Business Systems** at **Muthayammal Engineering College (Autonomous)** as part of the **NEXUS'26 Symposium**.

The platform supports **unlimited competition rounds**, **dynamic branding**, **real-time leaderboards**, **anti-cheat monitoring**, and a complete **Super Admin control center** — all without ever touching the source code.

> 🏆 Built for reusability: The same portal can be reused for any department, symposium, or event simply by changing settings in the Super Admin dashboard.

---

## ✨ Features

### 🔐 Authentication & Role System
- **Super Admin** — Full portal control, isolated dashboard
- **Admin** — Competition management with permission-based access
- **Participant** — Multi-round quiz experience with real-time feedback
- JWT-based authentication with secure token storage
- Role-based route protection on both frontend and backend

### 🏛️ Super Admin Dashboard
- **Institution Management** — Edit college name, department, symposium, event, logos, contact details
- **Dynamic Round Manager** — Create, edit, reorder, clone, enable/disable unlimited rounds
- **Admin Management** — Create and configure admin accounts with granular permissions
- **Portal Branding** — Browser title, favicon, login banner, loading screen message
- **Security Settings** — Anti-cheat rules, tab-switch limits, fullscreen enforcement
- **Leaderboard Control** — Publish/hide leaderboards per round
- **Activity Logs** — System-wide event tracking

### 👨‍💼 Admin Dashboard
- Live competition control (open → start → pause → close per round)
- Real-time participant monitoring
- Question management per round (MCQ, Coding, Debug)
- Bulk participant generation & credential export
- PDF reports with dynamic institution header
- Security violation monitoring

### 👤 Participant Portal
- Animated loading screen with dynamic event branding
- Credential-based login (Year → Username → Password flow)
- Round-specific waiting rooms with live countdown
- **Round 1** — 30-question timed MCQ quiz with fullscreen enforcement
- **Round 2** — Competitive coding with Monaco Editor (multi-language)
- **Round 3** — Bug Hunter — find and fix code errors
- Waiting for Evaluation room with real-time status updates
- Anti-cheat: tab-switch detection, clipboard protection, fullscreen enforcement

### 📊 Dynamic Content System
- Every page pulls branding from Super Admin settings automatically
- Changes to Event Name, College, Logos, Round Names propagate **instantly** across all 15+ pages
- No hardcoded strings — zero code changes needed to rebrand for a new event

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | Next.js 15 (App Router), TypeScript, Tailwind CSS |
| **Animations** | Framer Motion |
| **Code Editor** | Monaco Editor (VS Code engine) |
| **Backend** | Node.js, Express.js, TypeScript |
| **Database** | LowDB (JSON flat-file, zero infrastructure) |
| **Auth** | JWT (jsonwebtoken), bcryptjs |
| **PDF Generation** | jsPDF + autoTable |
| **Deployment** | Vercel (frontend), Render (backend) |
| **Icons** | Lucide React |

---

## 📁 Project Structure

```
Code - Crackers/
├── frontend/                        # Next.js 15 App
│   └── src/
│       ├── app/
│       │   ├── login/               # Login page (credential flow)
│       │   ├── dashboard/           # Participant dashboard + waiting rooms
│       │   ├── round1/              # MCQ Round
│       │   ├── round2/              # Coding Round (Monaco Editor)
│       │   ├── round3/              # Bug Hunter Round
│       │   ├── admin/               # Admin dashboard & sub-pages
│       │   │   ├── page.tsx         # Admin dashboard (dynamic rounds)
│       │   │   ├── participants/    # Participant management
│       │   │   ├── questions/       # Question management (MCQ/Coding/Debug)
│       │   │   ├── portal/          # Portal Management settings
│       │   │   ├── reports/         # PDF report generation
│       │   │   └── security/        # Anti-cheat settings
│       │   └── super-admin/         # Super Admin isolated dashboard
│       ├── lib/
│       │   ├── auth.tsx             # Auth context + JWT hooks
│       │   └── portalContext.tsx    # Global portal settings context
│       ├── components/
│       │   ├── LoadingScreen.tsx    # Animated loading screen
│       │   ├── CountdownOverlay.tsx # Round countdown overlay
│       │   └── ClientLayout.tsx     # Client-side layout wrapper
│       └── hooks/
│           └── useAntiCheat.ts      # Tab-switch & fullscreen detection
│
└── backend/                         # Express.js API
    └── src/
        ├── config/
│       │   └── database.ts          # LowDB schema + Competition model
        ├── middleware/
│       │   └── auth.ts              # JWT verify + role guards
        └── routes/
            ├── auth.ts              # POST /api/auth/login, /register
            ├── competition.ts       # Round open/start/pause/close/leaderboard
            ├── round1.ts            # MCQ question serve + submission
            ├── round2.ts            # Coding problem serve + evaluation
            ├── round3.ts            # Debug problem serve + submission
            ├── adminParticipants.ts # Participant CRUD + bulk ops
            ├── adminQuestions.ts    # MCQ question management
            ├── adminQuestionsCoding.ts # Coding question management
            ├── adminQuestionsDebug.ts  # Debug question management
            ├── adminManagement.ts   # Admin account CRUD
            └── portalManagement.ts  # Portal settings + dynamic rounds CRUD
```

---

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ 
- npm or yarn

### 1. Clone the Repository

```bash
git clone https://github.com/kesavan07-coder/Code---Crackers.git
cd "Code---Crackers"
```

### 2. Setup Backend

```bash
cd backend
npm install
```

Create a `.env` file in `backend/`:
```env
JWT_SECRET=your_super_secret_jwt_key_here
PORT=5000
```

Start the backend:
```bash
npm run dev
```

Backend runs at: `http://localhost:5000`

### 3. Setup Frontend

```bash
cd frontend
npm install
```

Create a `.env.local` file in `frontend/`:
```env
NEXT_PUBLIC_API_URL=http://localhost:5000
```

Start the frontend:
```bash
npm run dev
```

Frontend runs at: `http://localhost:3000`

---

## 🔐 Environment Variables

### Frontend (`frontend/.env.local`)
| Variable | Description | Example |
|----------|-------------|---------|
| `NEXT_PUBLIC_API_URL` | Backend API base URL | `http://localhost:5000` |

### Backend (`backend/.env`)
| Variable | Description | Example |
|----------|-------------|---------|
| `JWT_SECRET` | Secret key for JWT signing | `my_secret_key_2026` |
| `PORT` | Server port | `5000` |

---

## 👥 Role-Based Access

| Role | Login Redirect | Capabilities |
|------|---------------|--------------|
| `super_admin` | `/super-admin` | Full portal control, round management, admin creation |
| `admin` | `/admin` | Competition control, participant management, reports |
| `participant` | `/dashboard` | Quiz participation, round access |

### Default Super Admin Credentials
```
Username: superadmin
Password: superadmin123
```
> ⚠️ Change these immediately after first login via the Admin Management tab.

---

## 🔄 Portal Workflow

```
Super Admin Login
      │
      ▼
Portal Management → Set Event Name, College, Department, Logos
      │
      ▼
Round Manager → Configure Rounds (MCQ / Coding / Bug Hunter / Custom)
      │
      ▼
Question Management → Add questions per round
      │
      ▼
Generate Participants → Bulk create with auto credentials
      │
      ▼
Competition Day:
  Admin opens Round 1 → Participants enter waiting room
  Admin starts Round 1 → Participants take quiz
  Admin closes Round 1 → Scores calculated
  Admin opens Round 2 → Qualifying participants proceed
      │
      ▼
Leaderboard Published → Super Admin publishes results
      │
      ▼
Reports → Export PDF with dynamic institution header
```

---

## 📡 API Reference

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/auth/login` | Login (all roles) |
| `POST` | `/api/auth/register` | Register participant |

### Competition Control (Admin)
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/competition/open-round` | Open round for participants |
| `POST` | `/api/competition/start-round` | Start round timer |
| `POST` | `/api/competition/pause-round` | Pause round |
| `POST` | `/api/competition/close-round` | Close round |
| `GET` | `/api/competition/status` | Get competition state |
| `GET` | `/api/competition/leaderboard` | Get dynamic leaderboard |

### Portal Management (Super Admin)
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET/PATCH` | `/api/portal/settings` | Portal branding & config |
| `GET` | `/api/portal/public-info` | Public portal info (no auth) |
| `GET/POST` | `/api/portal/rounds` | List / create dynamic rounds |
| `PUT/DELETE` | `/api/portal/rounds/:id` | Update / delete a round |
| `PATCH` | `/api/portal/security` | Security settings |
| `PATCH` | `/api/portal/round-durations` | Round time limits |

### Participants (Admin)
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/admin/participants` | List all participants |
| `POST` | `/api/admin/participants/bulk-generate` | Bulk create participants |
| `DELETE` | `/api/admin/participants/:id` | Delete participant |
| `POST` | `/api/admin/participants/export-credentials` | Export CSV credentials |

---

## 🚢 Deployment

### Frontend — Vercel
The frontend is deployed on **Vercel** with automatic deployments on every push to `main`.

- **Live URL**: [https://code-crackers-six.vercel.app](https://code-crackers-six.vercel.app)
- Set `NEXT_PUBLIC_API_URL` to your backend URL in Vercel Environment Variables.

### Backend — Render
The backend is configured for **Render** via `render.yaml`.

```yaml
# render.yaml is pre-configured
# Just connect your GitHub repo to Render and it deploys automatically
```

Set the following environment variable in Render:
- `JWT_SECRET` = your secret key

---

## 🖼️ Screenshots

| Page | Description |
|------|-------------|
| Login | Animated credential-based login with year selection |
| Loading Screen | Branded loading animation with event name |
| Participant Dashboard | Round cards with live status indicators |
| MCQ Round | 30-question timed quiz with question navigator |
| Coding Round | Monaco Editor with multi-language support |
| Bug Hunter | Code diff viewer with error detection |
| Admin Dashboard | Live round control with participant stats |
| Super Admin | Full portal management command center |
| Leaderboard | Real-time ranked scoreboard |
| Reports | PDF export with college branding |

---

## 👨‍💻 Developed By

**Department of Computer Science & Business Systems**  
Muthayammal Engineering College (Autonomous)  
NEXUS'26 Symposium — Code Crackers Technical Quiz

---

## 📄 License

This project is developed for internal use at Muthayammal Engineering College.  
All rights reserved © 2026 CSBS Department.

---

<div align="center">
Made with ❤️ for NEXUS'26 | Code Crackers Technical Quiz Portal
</div>
