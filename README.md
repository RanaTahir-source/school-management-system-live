# School Management System

A comprehensive school management system built with modern web technologies.

## Project Structure

```
school-management-system/
├── backend/          # Backend API
├── frontend/         # Frontend Application
├── voice-agent-service/  # Voice Agent Service
└── database/         # Database configurations
```

## Getting Started

### Prerequisites
- Node.js 18+
- npm or yarn
- Docker (optional)

### Installation

```bash
# Clone the repository
git clone https://github.com/Das-Jandanwala/school-management-system.git
cd school-management-system

# Install backend dependencies
cd backend
npm install

# Install frontend dependencies
cd ../frontend
npm install
```

## File Storage (Documents & Certificates)

Uploaded documents and generated certificate PDFs are stored on local disk
under `backend/uploads/` (not committed to git). Set `UPLOADS_DIR` in
`backend/.env` to point at a persistent path if you want it outside the
project folder - important on a Hostinger VPS if `uploads/` isn't already on
a volume that survives redeploys. Files are never served statically; every
download goes through an authenticated, role-checked API endpoint.

## Contributing

Pull requests are welcome. For major changes, please open an issue first to discuss what you would like to change.

## License

MIT
