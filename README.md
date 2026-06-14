<img width="845" height="411" alt="Screenshot 2026-06-14 150737" src="https://github.com/user-attachments/assets/e25f69ee-0de2-43a4-96fc-0377b3bdfeec" />

# Circles

A private social media platform for the people who actually matter. Circles lets you organise your life into separate groups — family, close friends, colleagues — and share photos and videos exclusively within each one. No algorithm, no ads, no strangers.

<img alt="full" src="https://github.com/user-attachments/assets/8a79456b-d02a-4a1c-b7d1-66de6714777e" />

## Features

- **Circle-based sharing** — Create circles for different groups and post to each one independently
- **Photo & video posts** — Attach media to posts with direct-to-cloud uploads (no server bottleneck)
- **Friends system** — Find people by email, send friend requests, invite friends into your circles
- **Private by default** — Content is only visible to members of the circle it was posted to
- **Email confirmation** — Accounts are verified before they can be used
- **Session auth** — Cookie-based authentication with a 7-day sliding expiry

## Tech Stack

| Layer         | Technology                                                      |
| ------------- | --------------------------------------------------------------- |
| Orchestration | [.NET Aspire](https://learn.microsoft.com/en-us/dotnet/aspire/) |
| Backend       | .NET Core 10 (Minimal APIs)                                  |
| Auth          | ASP.NET Core Identity                                           |
| Database      | MS SQL Server + Entity Framework Core                           |
| Cache         | Redis (output caching)                                          |
| Storage       | Azure Blob Storage                                              |
| Email         | MailKit + SMTP                                                  |
| Frontend      | React 19 + TypeScript + Vite                                    |
| Styling       | Tailwind CSS + Radix UI                                         |
| Routing       | TanStack Router                                                 |

## Architecture

Aspire orchestrates all services. In development, everything runs locally — SQL Server, Redis, and Azure Blob Storage spin up as Docker containers automatically. Mailpit catches all outgoing emails locally so you never need a real email service to develop.

```
circles.AppHost       ← Aspire orchestration (wires everything together)
circles.Server        ← .NET Core API
circles.Frontend      ← React/Vite app (proxied through the server in dev)
```

When the app starts, the frontend dev server is proxied through the API server, so there are no CORS issues and the cookie auth just works.

## Prerequisites

- [.NET 10 SDK](https://dotnet.microsoft.com/download/dotnet/10.0)
- [Node.js](https://nodejs.org/) (v20 or later)
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (running — Aspire uses it to spin up SQL Server, Redis, and Azurite)

## Getting Started

**1. Clone the repo**

```bash
git clone https://github.com/liamethanroodt/circles.git
cd circles
```

**2. Install frontend dependencies**

```bash
cd circles.Frontend
npm install
cd ..
```

**3. Run the app**

```bash
dotnet run --project circles.AppHost
```

Aspire will start everything: SQL Server, Redis, Azure Blob Storage (via Azurite), Mailpit, the API, and the Vite dev server. The Aspire dashboard opens automatically and shows the status and logs of every service.

Alternatively, open the solution in Visual Studio 2022 and press **F5**.

**4. Open the app**

Once everything is running, navigate to the frontend URL shown in the Aspire dashboard (typically `https://localhost:5173`).

To inspect outgoing emails (registration confirmations, friend request notifications), open the Mailpit UI — its URL is also shown in the dashboard.

## Project Structure

```
circles.AppHost/
  AppHost.cs              ← Service registration and wiring

circles.Server/
  Program.cs              ← Middleware, auth, DI setup
  Data/
    CirclesDbContext.cs   ← EF Core context
    Migrations/           ← Database migrations
  Models/                 ← Entity models (User, Circle, Post, Friendship, etc.)
  Endpoints/              ← Minimal API route handlers

circles.Frontend/
  src/
    routes/               ← TanStack Router file-based routes
    components/           ← Shared UI components
    components/ui/        ← Radix UI primitives (shadcn/ui)
```

## Author

Built by [Liam Roodt](https://www.linkedin.com/in/liamroodt) — a side project built after hours, shared in the open.
